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
import traceback
import urllib.request
from io import BytesIO
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Optional

import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse, StreamingResponse

from aibuy_client import (
    search_by_image, reset_session,
    configure as configure_aibuy, warmup_session,
    fetch_sku_prices, set_auth_cookie, get_auth_cookie,
)
from config import load_sourcing_config, save_sourcing_config, reload_sourcing_config, deep_merge

logger = logging.getLogger("sourcing")

_CONFIG_DIR = os.path.join(os.path.dirname(__file__), "config")

router = APIRouter(prefix="/api/sourcing", tags=["sourcing"])


def _cfg():
    """快捷读取配置（内存缓存，YAML 变更后自动刷新）"""
    return load_sourcing_config()


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


def _calc_cost(row: dict, cost_cfg: dict) -> dict:
    """采购成本 = 1688价CNY ÷ 汇率 × 倍率"""
    rate = cost_cfg["cny_per_brl"]
    mult = cost_cfg["cost_multiplier"]
    target = cost_cfg["target_margin_rate"]
    high = cost_cfg["high_margin_rate"]

    best_1688 = row.get("best_1688") or {}
    price_cny = best_1688.get("price_cny")
    cost_cny = float(price_cny) if price_cny is not None else None
    cost_brl = (cost_cny / rate * mult) if cost_cny is not None else None

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


def _pick_candidate(c: dict, sku_data: dict | None = None) -> dict:
    """提取单个 1688 候选的全部字段"""
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
        },
    }


def _build_row(prod: dict, cands: list, cost_cfg: dict, sku_cache: dict | None = None) -> dict:
    """构建单产品分析行"""
    pid = prod["product_id"]
    sku_cache = sku_cache or {}

    # 注入 SKU 数据到候选
    enriched = []
    for c in cands:
        item_id = c.get("itemId", "")
        sku_data = sku_cache.get(item_id) or {}
        enriched.append(_pick_candidate(c, sku_data))
    cands = enriched  # type: ignore

    best_1688 = enriched[0] if enriched else None

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
    }
    row.update(_calc_cost(row, cost_cfg))
    return row


def _build_rows(products: list, candidates_map: dict, cost_cfg: dict) -> list:
    """构建所有产品行，含 SKU 价格富化"""
    proxy_url = _get_proxy_url()

    # 收集所有 offer_id
    offer_ids = set()
    for cands in candidates_map.values():
        for c in cands:
            oid = c.get("itemId", "")
            if oid:
                offer_ids.add(oid)

    # 并发获取 SKU 数据
    sku_cache = {}
    if offer_ids and proxy_url:
        logger.info(f"[sku] 通过代理 {proxy_url} 获取 {len(offer_ids)} 个 offer 的 SKU 价格...")
        with ThreadPoolExecutor(max_workers=6) as ex:
            futures = {ex.submit(fetch_sku_prices, oid, proxy_url): oid for oid in offer_ids}
            for fut in as_completed(futures):
                oid = futures[fut]
                try:
                    sku_cache[oid] = fut.result()
                except Exception as e:
                    logger.warning(f"[sku] {oid} 失败: {e}")

    return [_build_row(prod, candidates_map.get(prod["product_id"], []), cost_cfg, sku_cache) for prod in products]


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


def _read_files(files: list, col_map: dict) -> pd.DataFrame:
    """读取多个 Excel 并合并，文件名作为数据来源标签"""
    frames = []
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
        df_src = df_src[list(available.keys())].rename(columns=available)
        df_src["data_source"] = f.filename or "unknown"
        frames.append(df_src)
    df = pd.concat(frames, ignore_index=True)
    df["product_id"] = df["product_id"].astype(str)
    return df


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
    df = _read_files(files, cfg["columns"])
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
    df = _read_files(files, cfg["columns"])
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

    rows = _build_rows(products, candidates_map, cost_cfg)

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
):
    """SSE 流式版 — 实时推送每个产品的搜索进度 + 成本计算结果"""
    cfg = _cfg()
    sc = cfg["search"]
    if page_size <= 0:
        page_size = sc["page_size"]

    _check_files(files, cfg["limits"]["max_file_size_mb"])
    df = _read_files(files, cfg["columns"])
    products = df.to_dict(orient="records")
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

        yield _sse("phase", {"phase": "costing", "message": "获取SKU价格 + 成本计算中..."})

        rows = _build_rows(products, candidates_map, cost_cfg)

        summary = {
            "total_products": len(rows),
            "with_1688_data": sum(1 for r in rows if r["has_1688_data"]),
            "recommended": sum(1 for r in rows if r["recommendation"] == "推荐"),
            "consider": sum(1 for r in rows if r["recommendation"] == "可考虑"),
            "warning": sum(1 for r in rows if r["recommendation"] == "预警"),
            "incomplete": sum(1 for r in rows if r["recommendation"] == "待补全"),
        }

        yield _sse("complete", {"summary": summary, "rows": rows, "cost_config": cost_cfg})

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


# ========== 1688 登录态 Cookie 管理 ==========

_COOKIE_PATH = os.path.join(_CONFIG_DIR, ".1688_auth_cookie")

def _load_cookie():
    if os.path.exists(_COOKIE_PATH):
        with open(_COOKIE_PATH, "r", encoding="utf-8") as f:
            return f.read().strip()
    return ""

def _save_cookie(cookie: str):
    with open(_COOKIE_PATH, "w", encoding="utf-8") as f:
        f.write(cookie)


# 启动时从文件加载 cookie
_stored_cookie = _load_cookie()
if _stored_cookie:
    set_auth_cookie(_stored_cookie)
    logger.info(f"[auth] 已加载 1688 登录 cookie ({len(_stored_cookie)} 字符)")


@router.get("/auth")
async def get_auth():
    """获取 1688 登录态 cookie 状态"""
    cookie = get_auth_cookie()
    return {
        "has_cookie": bool(cookie),
        "cookie_len": len(cookie),
        "sample": cookie[:30] + "..." if cookie else "",
    }


def _check_proxy_alive(proxy_url: str) -> bool:
    """检测本地代理是否在线"""
    try:
        r = urllib.request.urlopen(f"{proxy_url}/health", timeout=3)
        return r.status == 200
    except Exception:
        return False


@router.get("/proxy/healthcheck")
async def proxy_healthcheck():
    """检测本地代理 + SKU 连通性"""
    proxy_url = _get_proxy_url()
    if not proxy_url:
        return {"proxy": "not_configured", "message": "未配置本地代理地址"}

    alive = _check_proxy_alive(proxy_url)
    if not alive:
        return {"proxy": "offline", "message": f"无法连接到本地代理 {proxy_url}"}

    # 代理在线，测试 SKU API
    try:
        r = urllib.request.urlopen(f"{proxy_url}/api/sku/740919115663", timeout=10)
        data = _json.loads(r.read().decode("utf-8"))
        if data.get("prices"):
            return {
                "proxy": "ok",
                "sku": "ok",
                "message": f"本地代理已连接，SKU API 正常 ({len(data['prices'])} 个价格)",
                "sample_prices": data["prices"],
            }
        return {"proxy": "ok", "sku": "no_data", "message": "代理在线但 SKU API 未返回价格（cookie 可能过期）"}
    except Exception as e:
        return {"proxy": "ok", "sku": "error", "message": f"代理在线但 SKU 查询失败: {e}"}


def _get_proxy_url() -> str:
    return _cfg().get("system", {}).get("proxy_url", "")


@router.post("/auth/healthcheck")
async def auth_healthcheck():
    """测试 1688 登录态是否有效：用已存 cookie 调 SKU API"""
    cookie = get_auth_cookie()
    if not cookie:
        return {"status": "no_cookie", "message": "未配置 1688 登录态 cookie"}

    # 用测试 offer_id 调 SKU API，看是否返回 SUCCESS
    result = fetch_sku_prices("740919115663")

    if result.get("error"):
        return {
            "status": "failed",
            "message": f"SKU API 调用失败: {result['error']}",
            "cookie_len": len(cookie),
        }

    if result.get("sku_count", 0) > 0:
        return {
            "status": "ok",
            "message": f"登录态有效，成功获取 {result['sku_count']} 个 SKU 价格",
            "cookie_len": len(cookie),
            "sample_prices": {s["spec"]: s["price"] for s in result.get("skus", [])[:5]},
        }

    return {
        "status": "failed",
        "message": "cookie 存在但 SKU API 未返回数据（可能已过期）",
        "cookie_len": len(cookie),
    }


@router.put("/auth")
async def update_auth(body: dict):
    """更新 1688 登录态 cookie"""
    cookie = body.get("cookie", "")
    if not cookie:
        raise HTTPException(400, "缺少 cookie 字段")
    _save_cookie(cookie)
    set_auth_cookie(cookie)
    logger.info(f"[auth] cookie 已更新 ({len(cookie)} 字符)")
    return {"status": "ok", "cookie_len": len(cookie)}


@router.post("/refresh-session")
async def refresh_session():
    """强制刷新 1688 游客 session"""
    reset_session()
    return {"status": "ok", "message": "session 已重置"}
