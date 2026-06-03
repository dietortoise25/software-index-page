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
import traceback
from io import BytesIO
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Optional

import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse, StreamingResponse

from aibuy_client import search_by_image, reset_session, configure as configure_aibuy
from config import load_sourcing_config, save_sourcing_config, reload_sourcing_config, deep_merge

logger = logging.getLogger("sourcing")

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
        "freight_brl": c["freight_brl"],
        "clearance_brl": c["clearance_brl"],
        "other_brl": c["other_brl"],
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
    """单行成本计算"""
    rate = cost_cfg["cny_per_brl"]
    freight = cost_cfg["freight_brl"]
    clearance = cost_cfg["clearance_brl"]
    other = cost_cfg["other_brl"]
    target = cost_cfg["target_margin_rate"]
    high = cost_cfg["high_margin_rate"]

    price_cny = row.get("min_price_cny")
    cost_cny = float(price_cny) if price_cny is not None else None
    cost_brl = (cost_cny / rate) if cost_cny is not None else None
    total_cost = (cost_brl + freight + clearance + other) if cost_brl is not None else None

    shopee_price = row.get("shopee_price_num")
    margin_brl = (shopee_price - total_cost) if (shopee_price is not None and total_cost is not None) else None
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
        "freight_brl": freight,
        "clearance_brl": clearance,
        "other_brl": other,
        "total_cost_brl": round(total_cost, 2) if total_cost else None,
        "shopee_price_num": shopee_price,
        "margin_brl": round(margin_brl, 2) if margin_brl is not None else None,
        "margin_rate": round(margin_rate, 4) if margin_rate is not None else None,
        "recommendation": rec,
    }


def _search_one(prod: dict, page_size: int, same_style_only: bool):
    """单个产品搜图，返回 (pid, candidates_list, error_str)"""
    pid = prod["product_id"]
    img = prod.get("image_url", "")
    if not img or pd.isna(img):
        return pid, [], "no image_url"
    try:
        offers, _ = search_by_image(str(img), page_size=page_size, same_style_only=same_style_only)
        return pid, offers, None
    except Exception as e:
        logger.warning(f"[search] {pid} 失败: {e}")
        return pid, [], str(e)[:120]


def _build_row(prod: dict, cands: list, cost_cfg: dict) -> dict:
    """构建单产品分析行"""
    pid = prod["product_id"]
    best = cands[0] if cands else {}
    infos = best.get("purchaseInfos", [{}])

    row = {
        "product_id": pid,
        "product_name": prod.get("product_name", ""),
        "data_source": prod.get("data_source", ""),
        "category_path": prod.get("category_path", ""),
        "shopee_price_brl": str(prod.get("shopee_price_brl", "")),
        "image_url": prod.get("image_url", ""),
        "shopee_monthly_sales": prod.get("shopee_monthly_sales", ""),
        "min_price_cny": best.get("itemPrice"),
        "best_1688_title": best.get("title", ""),
        "best_1688_url": best.get("link", ""),
        "best_1688_shop": (best.get("providerInfo") or {}).get("companyName", ""),
        "min_order_qty": infos[0].get("value", ""),
        "best_1688_sales": best.get("sales", ""),
        "best_1688_tags": best.get("offerTags", []),
        "candidates": [
            {
                "title": c.get("title", ""),
                "price_cny": c.get("itemPrice", ""),
                "link": c.get("link", ""),
                "sales": c.get("sales", ""),
                "shop_name": (c.get("providerInfo") or {}).get("companyName", ""),
                "min_order": (c.get("purchaseInfos") or [{}])[0].get("value", ""),
                "offer_tags": c.get("offerTags", []),
            }
            for c in cands
        ],
        "shopee_price_num": _parse_shopee_price(prod.get("shopee_price_brl")),
        "has_1688_data": len(cands) > 0,
    }
    row.update(_calc_cost(row, cost_cfg))
    return row


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
            pid, cands, err = fut.result()
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
    freight_brl: float = Form(-1),
    clearance_brl: float = Form(-1),
    other_brl: float = Form(-1),
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
    if freight_brl >= 0: overrides["freight_brl"] = freight_brl
    if clearance_brl >= 0: overrides["clearance_brl"] = clearance_brl
    if other_brl >= 0: overrides["other_brl"] = other_brl
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

    rows = [_build_row(prod, candidates_map.get(prod["product_id"], []), cost_cfg) for prod in products]

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
    freight_brl: float = Form(-1),
    clearance_brl: float = Form(-1),
    other_brl: float = Form(-1),
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
    if freight_brl >= 0: overrides["freight_brl"] = freight_brl
    if clearance_brl >= 0: overrides["clearance_brl"] = clearance_brl
    if other_brl >= 0: overrides["other_brl"] = other_brl
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
                pid, cands, err = await fut
                done += 1
                candidates_map[pid] = cands
                yield _sse("progress", {
                    "current": done,
                    "total": total,
                    "product_id": pid,
                    "product_name": str(fut_map[fut].get("product_name", ""))[:40],
                    "candidates_count": len(cands),
                    "error": err,
                })
        finally:
            executor.shutdown(wait=False)

        yield _sse("phase", {"phase": "costing", "message": "成本计算中..."})

        rows = [_build_row(prod, candidates_map.get(prod["product_id"], []), cost_cfg) for prod in products]

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
        logger.info("[config] 配置已更新")
        return {"status": "ok", "config": merged}
    except Exception:
        logger.exception("[config] 保存失败")
        raise HTTPException(500, traceback.format_exc())


@router.post("/config/reload")
async def reload_config():
    """强制从 YAML 重新加载配置（清除缓存）"""
    cfg = reload_sourcing_config()
    configure_aibuy(cfg["api"])
    return {"status": "ok", "config": cfg}


@router.post("/refresh-session")
async def refresh_session():
    """强制刷新 1688 游客 session"""
    reset_session()
    return {"status": "ok", "message": "session 已重置"}
