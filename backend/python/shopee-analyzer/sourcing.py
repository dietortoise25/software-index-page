"""
选品比价 API 路由 — 上传 Shopee Excel，批量以图搜货 + 成本计算

前端调用:
  POST  /api/shopee/sourcing/search          批量搜图
  POST  /api/shopee/sourcing/analyze         搜图 + 成本计算
  POST  /api/shopee/sourcing/analyze-stream  SSE 流式版
  GET   /api/shopee/sourcing/config          读取配置
  PUT   /api/shopee/sourcing/config          更新配置
"""
import asyncio
import json as _json
import logging
import os
import time
import traceback
from io import BytesIO
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Optional

import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse, StreamingResponse

from aibuy_client import (
    search_by_image,
    configure as configure_aibuy, warmup_session,
)
from config import load_sourcing_config, save_sourcing_config, reload_sourcing_config, deep_merge
from sku_provider import get_provider
from sku_match_client import match_sku_via_agent

logger = logging.getLogger("sourcing")

router = APIRouter(prefix="/api/sourcing", tags=["sourcing"])


def _provider_for_request(cfg: dict, requested: str):
    """按本次请求选择 SKU Provider。
    requested 为空 → 用服务器默认；"none" → 强制无；其他 → 覆盖 active。
    凭证始终取自服务器配置，运营只选用哪个源、绝不传密钥。
    不改动传入的 cfg。"""
    requested = (requested or "").strip()
    if not requested:
        return get_provider(cfg)
    active = "" if requested == "none" else requested
    sp = {**(cfg.get("sku_provider") or {}), "active": active}
    return get_provider({**cfg, "sku_provider": sp})


def _cfg():
    """快捷读取配置（内存缓存，YAML 变更后自动刷新）"""
    return load_sourcing_config()


# 万邦试用档约 1-3 秒/次，整批并发会被打 503；SKU 请求串行 + 此间隔
_SKU_REQUEST_INTERVAL_SEC = 1.5

# 图文核对置信度阈值：< 此值的候选不准当 best_1688(Q13=B)
_DEFAULT_VERIFY_THRESHOLD = 0.5


def _cost_cfg_from(cfg: dict, overrides: dict | None = None) -> dict:
    """从配置字典提取成本计算参数，支持端点参数覆盖"""
    c = cfg["cost"]
    t = cfg["thresholds"]
    result = {
        "cny_per_brl": c["cny_per_brl"],
        "cost_multiplier": c["cost_multiplier"],
        "target_margin_rate": t["target_margin_rate"],
        "high_margin_rate": t["high_margin_rate"],
    }
    if overrides:
        result.update(overrides)
    return result


# ========== 启动时注入 aibuy_client 配置 ==========
def _init_api_config():
    cfg = _cfg()
    configure_aibuy(cfg["api"])
    warmup_session()


_init_api_config()


# ========== 工具函数 ==========

def _parse_shopee_price(val) -> Optional[float]:
    """R$ 19,90 → 19.9"""
    if pd.isna(val):
        return None
    s = str(val).replace("R$", "").strip()
    parts = s.split("~")
    try:
        return float(parts[0].replace(",", ""))
    except (ValueError, IndexError):
        return None


def _to_cost_float(val) -> float | None:
    """SKU 单价字符串 → float，空/非法 → None"""
    if val is None or val == "":
        return None
    try:
        return float(str(val).replace(",", ""))
    except (TypeError, ValueError):
        return None


def _calc_cost(row: dict, cost_cfg: dict) -> dict:
    """采购成本 = 1688价(数值) × 倍率，直接标 R$（按老板要求不算汇率）"""
    mult = cost_cfg["cost_multiplier"]
    target = cost_cfg["target_margin_rate"]
    high = cost_cfg["high_margin_rate"]

    best_1688 = row.get("best_1688") or {}
    # 成本来自 step4 选中的 SKU 真实单价（弃用图搜 itemPrice/price_cny —— 无用且常空）
    matched_sku = best_1688.get("matched_sku") or {}
    sku_price = matched_sku.get("price")
    cost_cny = _to_cost_float(sku_price)
    cost_brl = (cost_cny * mult) if cost_cny is not None else None

    shopee_price = row.get("shopee_price_num")
    margin_brl = (shopee_price - cost_brl) if (shopee_price is not None and cost_brl is not None) else None
    margin_rate = (margin_brl / shopee_price) if (shopee_price and margin_brl is not None) else None

    if shopee_price is None or cost_cny is None:
        rec = "待补全"
    elif margin_rate is not None and margin_rate >= high:
        rec = "推荐"
    elif margin_rate is not None and margin_rate >= target:
        rec = "可考虑"
    else:
        rec = "预警"

    return {
        "cost_cny": round(cost_cny, 2) if cost_cny else None,
        "cost_brl": round(cost_brl, 2) if cost_brl else None,
        "cost_multiplier": mult,
        "total_cost_brl": round(cost_brl, 2) if cost_brl else None,
        "shopee_price_num": shopee_price,
        "margin_brl": round(margin_brl, 2) if margin_brl is not None else None,
        "margin_rate": round(margin_rate, 4) if margin_rate is not None else None,
        "recommendation": rec,
    }


def _search_one(prod: dict, page_size: int, same_style_only: bool):
    """单个产品搜图，返回 (pid, candidates_list, error_str)"""
    pid = prod["product_id"]
    img = prod.get("image_url", "")
    name = str(prod.get("product_name", ""))[:40]
    if not img or pd.isna(img):
        return pid, name, [], "no image_url"
    try:
        offers, _ = search_by_image(str(img), page_size=page_size, same_style_only=same_style_only)
        return pid, name, offers, None
    except Exception as e:
        logger.warning(f"[search] {pid} 失败: {e}")
        return pid, name, [], str(e)[:120]


def _pick_candidate(c: dict, sku_data: dict | None = None,
                    image_confidence: float | None = None) -> dict:
    """提取单个 1688 候选的全部字段。image_confidence 为图文核对得分(可 None)"""
    prov = c.get("providerInfo") or {}
    purch = c.get("purchaseInfos") or []
    sku_data = sku_data or {}
    return {
        "title": c.get("title", ""),
        "item_id": c.get("itemId", ""),
        "price_cny": c.get("itemPrice", ""),
        "link": c.get("link", ""),
        "detail_url": c.get("offerDetailUrl", ""),
        "image_url": c.get("imageUrl", ""),
        "sales": c.get("sales", ""),
        "sales_num": c.get("salesNum", 0),
        "shop_name": prov.get("companyName", ""),
        "shop_url": prov.get("factoryUrl", ""),
        "shop_member_id": prov.get("memberId", ""),
        "shop_login_id": prov.get("loginId", ""),
        "shop_low_resp": prov.get("isLowRespRate", False),
        "min_order": purch[0].get("value", "") if purch else "",
        "offer_tags": c.get("offerTags", []),
        "purchase_tags": c.get("purchaseTags", []),
        "purchase_infos": purch,
        "ai_attentions": c.get("aiAttentions", []),
        "core_attributes": c.get("coreAttributes", []),
        "sales_infos": c.get("salesInfos", []),
        "ship_infos": c.get("shipInfos", []),
        "large_image_base_infos": c.get("largeImageBaseInfos", []),
        "large_image_extra_infos": c.get("largeImageExtraInfos", []),
        "provider_tags": prov.get("providerTags", []),
        "provider_services": c.get("providerServices", []),
        "provider_custom_tags": c.get("providerKjCustomTags", []),
        "sku": {
            "count": sku_data.get("sku_count", 0),
            "min_price": sku_data.get("min_price"),
            "max_price": sku_data.get("max_price"),
            "min_price_spec": sku_data.get("min_price_spec"),
            "items": sku_data.get("skus", []),
            "error": sku_data.get("error"),
        },
        "image_confidence": image_confidence,
    }


def _qualified_candidates(candidates: list, threshold: float) -> list:
    """图文核对合格池：image_confidence 明确 < threshold 的踢掉；
    None(未评分/核对失败/未配 key)保留不惩罚。"""
    out = []
    for c in candidates:
        conf = c.get("image_confidence")
        if conf is not None and conf < threshold:
            continue
        out.append(c)
    return out


def _select_matched_sku(enriched: list, match: dict | None,
                        threshold: float = _DEFAULT_VERIFY_THRESHOLD) -> tuple:
    """决定哪个候选的哪个 SKU 作为成本基准。
    返回 (best_candidate, matched_sku, match_source)。
      - 先按图文核对阈值过滤出合格池(conf<threshold 的不准当 best)
      - match 指定且命中(且合格) → (该候选, 该SKU, "llm")
      - 否则合格池里全局最低价兜底 → (含最低价SKU的候选, 最低价SKU, "fallback")
      - 合格池无 SKU → (合格池[0] 或 None, None, "none")"""
    qualified = _qualified_candidates(enriched, threshold)

    # step4 LLM 选中：按 item_id + sku_id 命中（仅限合格候选）
    if match:
        item_id = match.get("matched_item_id")
        sku_id = match.get("matched_sku_id")
        for cand in qualified:
            if cand.get("item_id") != item_id:
                continue
            for sku in cand.get("sku", {}).get("items", []):
                if sku.get("sku_id") == sku_id:
                    return cand, sku, "llm"

    # 兜底：合格池里所有候选所有 SKU 取价格最低的
    best_cand = best_sku = None
    best_price = None
    for cand in qualified:
        for sku in cand.get("sku", {}).get("items", []):
            p = _to_cost_float(sku.get("price"))
            if p is not None and (best_price is None or p < best_price):
                best_price, best_cand, best_sku = p, cand, sku

    if best_sku is not None:
        return best_cand, best_sku, "fallback"

    # 合格池无 SKU 价
    return (qualified[0] if qualified else None), None, "none"


def _build_row(prod: dict, cands: list, cost_cfg: dict, sku_cache: dict | None = None,
               match: dict | None = None, conf_map: dict | None = None) -> dict:
    """构建单产品分析行。match 为 step4 LLM 选中结果(可为 None → 兜底)"""
    pid = prod["product_id"]
    sku_cache = sku_cache or {}
    pid_confs = (conf_map or {}).get(pid, {})

    # 注入 SKU 数据和图文核对分数到候选
    enriched = []
    for c in cands:
        item_id = c.get("itemId", "")
        sku_data = sku_cache.get(item_id) or {}
        enriched.append(_pick_candidate(c, sku_data, image_confidence=pid_confs.get(item_id)))
    cands = enriched  # type: ignore

    best_1688, matched_sku, match_source = _select_matched_sku(enriched, match)
    if best_1688 is not None:
        best_1688 = {**best_1688, "matched_sku": matched_sku}

    row = {
        "product_id": pid,
        "product_name": prod.get("product_name", ""),
        "data_source": prod.get("data_source", ""),
        "category_path": prod.get("category_path", ""),
        "shopee_price_brl": str(prod.get("shopee_price_brl", "")),
        "image_url": prod.get("image_url", ""),
        "shopee_monthly_sales": prod.get("shopee_monthly_sales", ""),
        "best_1688": best_1688,
        "candidates": enriched,
        "shopee_price_num": _parse_shopee_price(prod.get("shopee_price_brl")),
        "has_1688_data": len(cands) > 0,
        "match_source": match_source,
        "match_reason": (match or {}).get("reason", "") if match_source == "llm" else "",
        "match_scores": (match or {}).get("scores") if match_source == "llm" else None,
        "match_overall_score": (match or {}).get("overall_score") if match_source == "llm" else None,
    }
    # 透传原始 Excel 字段（中文列名），供前端 CSV 导出
    _known_keys = {"product_id", "product_name", "data_source", "category_path",
                   "shopee_price_brl", "image_url", "shopee_monthly_sales"}
    for k, v in prod.items():
        if k not in _known_keys and k not in row:
            row[k] = "" if pd.isna(v) else v
    row.update(_calc_cost(row, cost_cfg))
    return row


def _collect_offer_ids(candidates_map: dict) -> list:
    """按出现顺序去重收集所有候选的 1688 offer_id（原始字段 itemId）"""
    seen, ordered = set(), []
    for cands in candidates_map.values():
        for c in cands:
            oid = c.get("itemId", "")
            if oid and oid not in seen:
                seen.add(oid)
                ordered.append(oid)
    return ordered


def _fetch_skus_into(provider, candidates_map: dict, sku_cache: dict):
    """串行经 provider 拉 SKU 填进 sku_cache；每拉完一个 offer yield 一条进度。
    万邦试用档约 1-3 秒/次，整批并发会被打 503，故串行 + 请求间间隔。
    单个 offer 失败不阻塞后续。provider 未就绪或无 offer 时不拉取、不 yield。"""
    offer_ids = _collect_offer_ids(candidates_map)
    total = len(offer_ids)
    if not (offer_ids and provider.ready):
        return
    logger.info(f"[sku] provider={provider.name} 串行获取 {total} 个 offer 的 SKU 价格表（间隔 {_SKU_REQUEST_INTERVAL_SEC}s）...")
    for i, oid in enumerate(offer_ids):
        if i > 0:
            time.sleep(_SKU_REQUEST_INTERVAL_SEC)
        try:
            sku_cache[oid] = provider.fetch_sku(oid)
        except Exception as e:
            logger.warning(f"[sku] {oid} provider 异常: {e}")
            sku_cache[oid] = {"sku_count": 0, "min_price": None, "max_price": None,
                              "min_price_spec": None, "skus": [], "error": str(e)[:120]}
        yield {"current": i + 1, "total": total, "item_id": oid}


def _match_all(products: list, candidates_map: dict, sku_cache: dict, matches: dict,
               conf_map: dict | None = None):
    """step4：逐货品调 agent 选最佳 SKU，结果按 pid 写入 matches。
    conf_map 让 step4 只把合格候选喂给 agent（图文核对 <0.5 的不参与）。"""
    total = len(products)
    for i, prod in enumerate(products):
        pid = prod["product_id"]
        raw_cands = candidates_map.get(pid, [])
        pid_confs = (conf_map or {}).get(pid, {})
        enriched = [_pick_candidate(c, sku_cache.get(c.get("itemId", "")) or {},
                                    image_confidence=pid_confs.get(c.get("itemId", "")))
                    for c in raw_cands]
        # 只把合格候选喂给 agent（confidence<0.5 的不参与 step4 选择）
        qualified = _qualified_candidates(enriched, _DEFAULT_VERIFY_THRESHOLD)
        if not qualified:
            yield {"current": i + 1, "total": total, "item_id": pid}
            continue
        shopee = {
            "name": str(prod.get("product_name", "")),
            "category": str(prod.get("category_path", "")),
            "price_brl": _parse_shopee_price(prod.get("shopee_price_brl")),
        }
        match = match_sku_via_agent(shopee, qualified)
        if match is not None:
            matches[pid] = match
        yield {"current": i + 1, "total": total, "item_id": pid}


def _build_rows(products: list, candidates_map: dict, cost_cfg: dict,
                sku_cache: dict | None = None, matches: dict | None = None,
                conf_map: dict | None = None) -> list:
    """构建所有产品行；SKU 数据从预填好的 sku_cache 注入（不在此拉取）。
    matches[pid] 为 step4 选中结果；conf_map[pid][item_id] 为图文核对分数。"""
    sku_cache = sku_cache or {}
    matches = matches or {}
    return [
        _build_row(prod, candidates_map.get(prod["product_id"], []), cost_cfg, sku_cache,
                   match=matches.get(prod["product_id"]), conf_map=conf_map)
        for prod in products
    ]


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {_json.dumps(data, ensure_ascii=False)}\n\n"


def _check_files(files: list, max_mb: int):
    """校验上传文件列表"""
    if not files:
        raise HTTPException(400, "请至少上传一个文件")
    total_size = 0
    for f in files:
        fname = f.filename or ""
        if not fname.lower().endswith((".xlsx", ".xls")):
            raise HTTPException(400, f"'{fname}' 不是 Excel 文件，请上传 .xlsx 或 .xls")
    for f in files:
        f.file.seek(0, 2)
        total_size += f.file.tell()
        f.file.seek(0)
    if total_size > max_mb * 1024 * 1024:
        raise HTTPException(400, f"文件总大小超过 {max_mb}MB 限制")


def _read_files(files: list, col_map: dict) -> tuple[pd.DataFrame, list[str]]:
    """读取多个 Excel 并合并，文件名作为数据来源标签。
    返回 (df, raw_columns)：df 含标准字段 + 所有原始列；raw_columns 为原始列名列表。"""
    frames = []
    all_raw_cols: list[str] = []
    for f in files:
        f.file.seek(0)
        content = f.file.read()
        if len(content) == 0:
            raise HTTPException(400, f"'{f.filename}' 文件为空")
        df_src = pd.read_excel(BytesIO(content))
        available = {c: col_map[c] for c in col_map if c in df_src.columns}
        if not available:
            raise HTTPException(400,
                f"'{f.filename}' 列名不匹配，期望: {list(col_map.keys())}")
        # 记录所有原始列名(去重保序)
        for c in df_src.columns:
            if c not in all_raw_cols:
                all_raw_cols.append(c)
        # rename 匹配列，其余保留原始中文名
        df_src = df_src.rename(columns=available)
        df_src["data_source"] = f.filename or "unknown"
        frames.append(df_src)
    df = pd.concat(frames, ignore_index=True)
    df["product_id"] = df["product_id"].astype(str)
    return df, all_raw_cols


def _limit_products(products: list, limit: int) -> list:
    """仅保留前 limit 行(用户在前端可配)。limit<=0 视为不限制。"""
    if limit and limit > 0:
        return products[:limit]
    return products


# ========== 业务端点 ==========

@router.post("/search")
async def sourcing_search(
    files: List[UploadFile] = File(...),
    page_size: int = Form(0),
    same_style_only: bool = Form(True),
):
    """上传多个 Shopee Excel，批量以图搜货，返回候选商品（不做成本计算）"""
    cfg = _cfg()
    sc = cfg["search"]
    if page_size <= 0:
        page_size = sc["page_size"]

    _check_files(files, cfg["limits"]["max_file_size_mb"])
    df, _ = _read_files(files, cfg["columns"])
    products = df.to_dict(orient="records")
    logger.info(f"[search] {len(files)} 个文件, {len(products)} 个产品")

    results = []
    max_workers = sc["max_concurrency"]

    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        futures = {ex.submit(_search_one, p, page_size, same_style_only): p for p in products}
        for fut in as_completed(futures):
            pid, _name, cands, err = fut.result()
            results.append({
                "product_id": pid,
                "candidates": cands,
                "total": len(cands),
                "error": err,
            })

    results.sort(key=lambda r: next(
        i for i, p in enumerate(products) if p["product_id"] == r["product_id"]
    ))

    return {"products": products, "results": results}


@router.post("/analyze")
async def sourcing_analyze(
    files: List[UploadFile] = File(...),
    page_size: int = Form(0),
    same_style_only: bool = Form(True),
    cny_per_brl: float = Form(0),
    cost_multiplier: float = Form(-1),
    target_margin_rate: float = Form(-1),
    high_margin_rate: float = Form(-1),
):
    """上传多个 Shopee Excel → 搜图 + 成本计算 + 推荐"""
    cfg = _cfg()
    sc = cfg["search"]
    if page_size <= 0:
        page_size = sc["page_size"]

    _check_files(files, cfg["limits"]["max_file_size_mb"])
    df, _ = _read_files(files, cfg["columns"])
    products = df.to_dict(orient="records")
    logger.info(f"[analyze] {len(files)} 个文件, {len(products)} 个产品")

    # 成本参数：传了就用传的，没传就用配置默认值
    overrides = {}
    if cny_per_brl > 0: overrides["cny_per_brl"] = cny_per_brl
    if cost_multiplier >= 0: overrides["cost_multiplier"] = cost_multiplier
    if target_margin_rate >= 0: overrides["target_margin_rate"] = target_margin_rate
    if high_margin_rate >= 0: overrides["high_margin_rate"] = high_margin_rate
    cost_cfg = _cost_cfg_from(cfg, overrides if overrides else None)

    candidates_map = {}
    max_workers = sc["max_concurrency"]

    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        futures = {ex.submit(_search_one, p, page_size, same_style_only): p for p in products}
        for fut in as_completed(futures):
            pid, cands, _ = fut.result()
            candidates_map[pid] = cands

    # 串行拉 SKU（非流式：无进度，直接跑完）→ 用服务器默认 provider
    provider = get_provider(cfg)
    sku_cache: dict = {}
    for _ in _fetch_skus_into(provider, candidates_map, sku_cache):
        pass
    # step4：调 agent 为每个货品选最佳 SKU（失败/无 SKU 则上游兜底）
    matches: dict = {}
    for _ in _match_all(products, candidates_map, sku_cache, matches):
        pass
    rows = _build_rows(products, candidates_map, cost_cfg, sku_cache, matches)

    summary = {
        "total_products": len(rows),
        "with_1688_data": sum(1 for r in rows if r["has_1688_data"]),
        "recommended": sum(1 for r in rows if r["recommendation"] == "推荐"),
        "consider": sum(1 for r in rows if r["recommendation"] == "可考虑"),
        "warning": sum(1 for r in rows if r["recommendation"] == "预警"),
        "incomplete": sum(1 for r in rows if r["recommendation"] == "待补全"),
    }

    return {"summary": summary, "rows": rows, "cost_config": cost_cfg}


@router.post("/analyze-stream")
async def sourcing_analyze_stream(
    files: List[UploadFile] = File(...),
    page_size: int = Form(0),
    same_style_only: bool = Form(True),
    cny_per_brl: float = Form(0),
    cost_multiplier: float = Form(-1),
    target_margin_rate: float = Form(-1),
    high_margin_rate: float = Form(-1),
    sku_provider: str = Form(""),
    limit: int = Form(0),
):
    """SSE 流式版 — 实时推送每个产品的搜索进度 + 成本计算结果"""
    cfg = _cfg()
    sc = cfg["search"]
    if page_size <= 0:
        page_size = sc["page_size"]

    _check_files(files, cfg["limits"]["max_file_size_mb"])
    df, raw_columns = _read_files(files, cfg["columns"])
    products = df.to_dict(orient="records")
    products = _limit_products(products, limit)
    total = len(products)
    max_workers = sc["max_concurrency"]
    logger.info(f"[stream] {len(files)} 个文件, {total} 个产品")

    overrides = {}
    if cny_per_brl > 0: overrides["cny_per_brl"] = cny_per_brl
    if cost_multiplier >= 0: overrides["cost_multiplier"] = cost_multiplier
    if target_margin_rate >= 0: overrides["target_margin_rate"] = target_margin_rate
    if high_margin_rate >= 0: overrides["high_margin_rate"] = high_margin_rate
    cost_cfg = _cost_cfg_from(cfg, overrides if overrides else None)

    async def generate():
        yield _sse("phase", {"phase": "parsing", "message": f"已解析 {total} 个产品"})
        yield _sse("start", {"total": total, "message": f"开始并发搜图 ({max_workers} 线程)"})

        loop = asyncio.get_event_loop()
        executor = ThreadPoolExecutor(max_workers=max_workers)
        candidates_map = {}
        done = 0

        try:
            fut_map = {}
            for p in products:
                fut = loop.run_in_executor(executor, _search_one, p, page_size, same_style_only)
                fut_map[fut] = p

            for fut in asyncio.as_completed(fut_map):
                pid, name, cands, err = await fut
                done += 1
                candidates_map[pid] = cands
                yield _sse("progress", {
                    "current": done,
                    "total": total,
                    "product_id": pid,
                    "product_name": name,
                    "candidates_count": len(cands),
                    "error": err,
                })
        finally:
            executor.shutdown(wait=False)

        # 后端经 SKU Provider 获取价格表（不再依赖浏览器扩展回传）
        provider = _provider_for_request(cfg, sku_provider)
        offer_ids = _collect_offer_ids(candidates_map)
        offer_count = len(offer_ids)
        yield _sse("phase", {
            "phase": "fetching_sku",
            "message": f"经 {provider.name} 串行获取 {offer_count} 个候选的 SKU 价格表（约 {_SKU_REQUEST_INTERVAL_SEC}s/个）..."
                       if provider.ready else "未配置 SKU Provider，跳过 SKU 价格表",
            "provider": provider.name,
            "ready": provider.ready,
            "total": offer_count,
        })

        # 串行拉 SKU：每拉完一个 offer 推一条进度（sleep 在线程里跑，不阻塞 event loop）
        sku_cache: dict = {}
        if provider.ready and offer_ids:
            gen = _fetch_skus_into(provider, candidates_map, sku_cache)
            while True:
                prog = await loop.run_in_executor(None, lambda: next(gen, None))
                if prog is None:
                    break
                yield _sse("sku_progress", {
                    **prog,
                    "message": f"SKU 价格表 {prog['current']}/{prog['total']}",
                })

        # 图文核对：对每个货品的全部候选并发打图文分（gpt-5.5 vision）
        from image_verify import verify_candidates as _verify_candidates
        conf_map: dict = {}
        total_cands = sum(len(v) for v in candidates_map.values())
        yield _sse("phase", {
            "phase": "image_verify",
            "message": f"图文核对 {total_cands} 个候选（GPT vision）...",
            "total": len(products),
        })
        for idx, prod in enumerate(products, 1):
            pid = prod["product_id"]
            shopee_img = prod.get("image_url", "")
            raw_cands = candidates_map.get(pid, [])
            cand_structs = [{"item_id": c.get("itemId", ""), "image_url": c.get("imageUrl", ""),
                             "title": c.get("title", "")} for c in raw_cands]
            conf_map[pid] = await loop.run_in_executor(
                None, _verify_candidates, shopee_img, cand_structs)
            yield _sse("verify_progress", {
                "current": idx,
                "total": len(products),
                "message": f"图文核对 {idx}/{len(products)}",
            })

        # step4：调 agent 为每个货品智能匹配最佳 SKU（每货品一次，失败兜底）
        matches: dict = {}
        yield _sse("phase", {
            "phase": "matching_sku",
            "message": f"AI 智能匹配最佳 SKU（{len(products)} 个货品）...",
            "ready": True,
            "total": len(products),
        })
        mgen = _match_all(products, candidates_map, sku_cache, matches, conf_map=conf_map)
        while True:
            prog = await loop.run_in_executor(None, lambda: next(mgen, None))
            if prog is None:
                break
            yield _sse("match_progress", {
                **prog,
                "message": f"AI 匹配 SKU {prog['current']}/{prog['total']}",
            })

        rows = await loop.run_in_executor(None, _build_rows, products, candidates_map, cost_cfg, sku_cache, matches, conf_map)

        sku_ok = sum(1 for r in rows for c in r["candidates"] if c.get("sku", {}).get("count", 0) > 0)
        sku_failed = sum(1 for r in rows for c in r["candidates"] if c.get("sku", {}).get("count", 0) == 0)
        yield _sse("phase", {
            "phase": "costing",
            "message": f"SKU 价格表完成（{sku_ok} 成功 / {sku_failed} 无数据），汇总中...",
        })

        summary = {
            "total_products": len(rows),
            "with_1688_data": sum(1 for r in rows if r["has_1688_data"]),
            "recommended": sum(1 for r in rows if r["recommendation"] == "推荐"),
            "consider": sum(1 for r in rows if r["recommendation"] == "可考虑"),
            "warning": sum(1 for r in rows if r["recommendation"] == "预警"),
            "incomplete": sum(1 for r in rows if r["recommendation"] == "待补全"),
        }

        yield _sse("complete", {"summary": summary, "rows": rows, "cost_config": cost_cfg, "raw_columns": raw_columns})

    return StreamingResponse(generate(), media_type="text/event-stream",
                             headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"})


# ========== 配置 CRUD ==========

@router.get("/config")
async def get_config():
    """读取选品全局配置"""
    return {"config": _cfg()}


@router.put("/config")
async def update_config(body: dict):
    """更新选品全局配置（合并写入 YAML，热生效）"""
    partial = body.get("config", {})
    if not partial:
        raise HTTPException(400, "缺少 config 字段")
    try:
        current = _cfg()
        merged = deep_merge(current.copy(), partial)
        save_sourcing_config(merged)
        configure_aibuy(merged.get("api", {}))
        warmup_session()
        logger.info("[config] 配置已更新")
        return {"status": "ok", "config": merged}
    except Exception:
        logger.exception("[config] 保存失败")
        raise HTTPException(500, traceback.format_exc())


@router.get("/system")
async def get_system_config():
    """读取系统配置（proxy_url 等）"""
    cfg = _cfg()
    return {"system": cfg.get("system", {})}


@router.put("/system")
async def update_system_config(body: dict):
    """更新系统配置"""
    system_cfg = body.get("system", {})
    if not system_cfg:
        raise HTTPException(400, "缺少 system 字段")
    current = _cfg()
    merged = deep_merge(current.copy(), {"system": system_cfg})
    save_sourcing_config(merged)
    logger.info("[config] 系统配置已更新")
    return {"status": "ok", "system": merged.get("system", {})}


@router.post("/config/reload")
async def reload_config():
    """强制从 YAML 重新加载配置（清除缓存）"""
    cfg = reload_sourcing_config()
    configure_aibuy(cfg["api"])
    warmup_session()
    return {"status": "ok", "config": cfg}


# ========== SKU Provider 健康状态 ==========

@router.get("/sku-provider/status")
async def sku_provider_status():
    """当前 SKU Provider 名称 + 是否就绪，供前端指示灯展示"""
    provider = get_provider(_cfg())
    return {
        "provider": provider.name,
        "ready": provider.ready,
        "message": (f"SKU Provider「{provider.name}」已就绪" if provider.ready
                    else "未配置 SKU Provider，SKU 价格表将为空"),
    }
