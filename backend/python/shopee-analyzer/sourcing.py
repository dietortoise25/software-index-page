"""
选品比价 —— 纯计算 / 取数 / SSE 辅助 + 业务符号命名空间（MVC 的 Model/工具层）。

HTTP 路由已抽到 routers/sourcing.py；本模块保留：
  - 搜图/SKU 拉取/匹配编排的薄封装(_search_one/_fetch_skus_into/_match_all/_build_rows)
  - SSE 辅助(_sse/_heartbeat_frame/_run_with_heartbeat)
  - 文件校验/读取(_check_files/_read_files)
  - search_by_image / get_provider / make_client 等符号驻留此命名空间，
    既供 routers 以 `sourcing.xxx` 调用，也作为既有测试 patch("sourcing.xxx") 的入口。
"""
import asyncio
import json as _json
import logging
import os
import time
from io import BytesIO

import pandas as pd
from fastapi import HTTPException

from aibuy_client import (
    search_by_image,
    configure as configure_aibuy, warmup_session,
)
from config import load_sourcing_config
from sku_provider import get_provider
from services.cost_calculator import calc_cost, parse_shopee_price, to_cost_float
from services import sourcing_pipeline
from clients.http import make_client

logger = logging.getLogger("sourcing")


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
# 单一来源在 services.sourcing_pipeline，此处保留同名常量维持既有测试入口
_SKU_REQUEST_INTERVAL_SEC = sourcing_pipeline.SKU_REQUEST_INTERVAL_SEC

# 图文核对置信度阈值：< 此值的候选不准当 best_1688(Q13=B)
_DEFAULT_VERIFY_THRESHOLD = 0.5


def _llm_match_config() -> dict:
    """SKU 匹配 LLM 凭证/模型 —— 与 image_verify 共用同一中转渠道(env)。"""
    return {
        "api_key": os.environ.get("SKU_MATCH_API_KEY", ""),
        "base_url": os.environ.get("SKU_MATCH_BASE_URL", "https://api.openai.com/v1").rstrip("/"),
        "model": os.environ.get("SKU_MATCH_MODEL", "gpt-5.5"),
    }


_SKU_MATCH_TIMEOUT_SEC = float(os.environ.get("SKU_MATCH_TIMEOUT_SEC", "45"))


def _cost_cfg_from(cfg: dict, overrides: dict | None = None) -> dict:
    """从配置字典提取成本计算参数，支持端点参数覆盖"""
    c = cfg["cost"]
    t = cfg["thresholds"]
    result = {
        "cny_per_brl": c["cny_per_brl"],
        "cost_multiplier": c["cost_multiplier"],
        "target_margin_rate": t["target_margin_rate"],
        "high_margin_rate": t["high_margin_rate"],
        "verify_threshold": t.get("verify_threshold", _DEFAULT_VERIFY_THRESHOLD),
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

# 成本/利润/推荐等级 纯计算逻辑已抽到 services.cost_calculator。
# 此处保留同名薄封装，维持 sourcing 内部调用与既有测试入口不变。
_parse_shopee_price = parse_shopee_price
_to_cost_float = to_cost_float
_calc_cost = calc_cost


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
                    image_confidence: float | None = None,
                    match_score: dict | None = None) -> dict:
    """提取单个 1688 候选的全部字段。image_confidence 为图文核对得分(可 None)；
    match_score 为该候选的 STEP5 评分结果(可 None，供候选明细逐个展示)。"""
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
        "match_overall_score": match_score.get("overall_score") if match_score else None,
        "match_scores": match_score.get("scores") if match_score else None,
    }


def _select_matched_sku(enriched: list, match: dict | None) -> tuple:
    """决定哪个候选的哪个 SKU 作为成本基准。
    返回 (best_candidate, matched_sku, match_source)。
    match_source: "llm" | "llm_failed" | "llm_mismatch" | "no_sku_data" | "no_qualified" | "none"
    除 "llm" 外均表示需人工复核，不自动兜底。"""
    fail_reason = (match or {}).get("fail_reason")
    match_data = (match or {}).get("data")

    # LLM 选中 — 在全量候选里按 item_id + sku_id 定位
    if match_data:
        item_id = match_data.get("matched_item_id")
        sku_id = match_data.get("matched_sku_id")
        for cand in enriched:
            if cand.get("item_id") != item_id:
                continue
            for sku in cand.get("sku", {}).get("items", []):
                if sku.get("sku_id") == sku_id:
                    return cand, sku, "llm"
        return (enriched[0] if enriched else None), None, "llm_mismatch"

    # LLM 未返回数据 — 区分原因
    if fail_reason == "no_qualified_candidate":
        return (enriched[0] if enriched else None), None, "no_qualified"
    if fail_reason == "no_sku_data":
        return (enriched[0] if enriched else None), None, "no_sku_data"
    if fail_reason == "llm_call_failed":
        return (enriched[0] if enriched else None), None, "llm_failed"

    return (enriched[0] if enriched else None), None, "none"


def _build_row(prod: dict, cands: list, cost_cfg: dict, sku_cache: dict | None = None,
               match: dict | None = None, conf_map: dict | None = None) -> dict:
    """构建单产品分析行。match = {"data": ..., "fail_reason": ...} 或 None"""
    pid = prod["product_id"]
    sku_cache = sku_cache or {}
    pid_confs = (conf_map or {}).get(pid, {})
    candidate_scores = (match or {}).get("candidate_scores") or {}

    # 注入 SKU 数据和图文核对分数到候选
    enriched = []
    for c in cands:
        item_id = c.get("itemId", "")
        sku_data = sku_cache.get(item_id) or {}
        enriched.append(_pick_candidate(c, sku_data, image_confidence=pid_confs.get(item_id),
                                        match_score=candidate_scores.get(item_id)))
    cands = enriched  # type: ignore

    best_1688, matched_sku, match_source = _select_matched_sku(enriched, match)
    if best_1688 is not None:
        best_1688 = {**best_1688, "matched_sku": matched_sku}

    match_data = (match or {}).get("data")
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
        "match_reason": (match_data or {}).get("reason", "") if match_source == "llm" else "",
        "match_scores": (match_data or {}).get("scores") if match_source == "llm" else None,
        "match_overall_score": (match_data or {}).get("overall_score") if match_source == "llm" else None,
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
    """按出现顺序去重收集所有候选的 1688 offer_id（原始字段 itemId）。
    编排逻辑已搬到 services.sourcing_pipeline，此处薄封装维持既有调用/测试入口。"""
    return sourcing_pipeline.collect_offer_ids(candidates_map)


def _fetch_skus_into(provider, candidates_map: dict, sku_cache: dict):
    """串行经 provider 拉 SKU 填进 sku_cache；每拉完一个 offer yield 一条进度。
    实际编排在 services.sourcing_pipeline.fetch_skus；间隔取本模块常量以兼容现有测试
    (test_build_rows_provider 读 sourcing._SKU_REQUEST_INTERVAL_SEC 并 patch sourcing.time.sleep)。"""
    yield from sourcing_pipeline.fetch_skus(provider, candidates_map, sku_cache,
                                            interval=_SKU_REQUEST_INTERVAL_SEC)


def _match_all(products: list, candidates_map: dict, sku_cache: dict, matches: dict,
               conf_map: dict | None = None, on_token=None, on_retry=None,
               on_candidate_scored=None):
    """step5：逐货品、逐候选调本地 LLM(clients.llm_client.match_sku) 选最佳 SKU，
    按 overall_score 取最高。单候选/单货品失败不阻塞批次。
    编排在 services.sourcing_pipeline.match_all；本函数注入 httpx client + LLM 配置 +
    _pick_candidate，并复用同一 client 跑完整批后关闭。
    on_token(item_id, tok)/on_retry(item_id)/on_candidate_scored(item_id, score)：
    SSE 逐字透传回调，透传到 pipeline（按候选 item_id 绑定）。
    matches[pid] = {"data": ..., "fail_reason": ..., "candidate_scores": ...}"""
    cfg = _llm_match_config()
    client = make_client(read_timeout=_SKU_MATCH_TIMEOUT_SEC)
    try:
        yield from sourcing_pipeline.match_all(
            products, candidates_map, sku_cache, matches,
            client=client, api_key=cfg["api_key"], base_url=cfg["base_url"],
            model=cfg["model"], conf_map=conf_map, pick_candidate_fn=_pick_candidate,
            on_token=on_token, on_retry=on_retry, on_candidate_scored=on_candidate_scored)
    finally:
        client.close()


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


# SSE 心跳间隔：远小于 nginx 默认 proxy_read_timeout(60s)，慢阶段也不断流
_HEARTBEAT_INTERVAL_SEC = float(os.environ.get("SSE_HEARTBEAT_INTERVAL_SEC", "15"))


def _heartbeat_frame() -> str:
    """SSE 注释帧——前端 EventSource 自动忽略，仅用于重置 nginx 读超时计时器。"""
    return ": hb\n\n"


async def _run_with_heartbeat(loop, fn, *, interval: float = _HEARTBEAT_INTERVAL_SEC):
    """在线程池跑阻塞 fn，等待期间每 interval 秒 yield 一次 ("heartbeat", None)；
    完成后 yield ("result", 返回值)。任何单步 >interval 的阶段都不会帧间静默。"""
    fut = loop.run_in_executor(None, fn)
    while True:
        done, _pending = await asyncio.wait({fut}, timeout=interval)
        if fut in done:
            yield ("result", fut.result())
            return
        yield ("heartbeat", None)


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
        # 标准英文列用 copy 注入(供内部计算)，原始中文列保留(供导出透传，不再是空列)
        for orig, std in available.items():
            df_src[std] = df_src[orig]
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
