"""
选品比价 API 路由 — 上传 Shopee Excel，批量以图搜货 + 成本计算

前端调用: POST /api/shopee/sourcing/search
          POST /api/shopee/sourcing/analyze
"""
import asyncio
import json as _json
import logging
import traceback
from io import BytesIO
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional

import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse, StreamingResponse

from aibuy_client import search_by_image, reset_session

logger = logging.getLogger("sourcing")

router = APIRouter(prefix="/api/sourcing", tags=["sourcing"])

MAX_FILE_SIZE = 10 * 1024 * 1024
MAX_CONCURRENCY = 6

# Excel 列名映射（中文 → 英文）
COL_MAP = {
    "产品ID": "product_id",
    "产品名称": "product_name",
    "产品主图": "image_url",
    "价格": "shopee_price_brl",
    "类目路径": "category_path",
    "月销量": "shopee_monthly_sales",
    "数据来源": "data_source",
}

# 默认成本参数
DEFAULT_COST = {
    "cny_per_brl": 1.7,
    "freight_brl": 5.0,
    "clearance_brl": 2.0,
    "other_brl": 1.0,
    "target_margin_rate": 0.15,
    "high_margin_rate": 0.30,
}


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


def _extract_fields(df: pd.DataFrame) -> pd.DataFrame:
    """重命名已有列，只保留能映射的"""
    available = {c: COL_MAP[c] for c in COL_MAP if c in df.columns}
    if not available:
        raise ValueError(f"Excel 列名不匹配，期望: {list(COL_MAP.keys())}")
    return df[list(available.keys())].rename(columns=available)


def _calc_cost(row, cost_cfg: dict) -> dict:
    """单行成本计算，返回可选字段 dict"""
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


@router.post("/search")
async def sourcing_search(
    file: UploadFile = File(...),
    page_size: int = Form(10),
    same_style_only: bool = Form(True),
):
    """上传 Shopee Excel，批量以图搜货，返回候选商品（不做成本计算）"""
    filename = file.filename or ""
    logger.info(f"[search] 收到: {filename}")
    if not filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "请上传 .xlsx 或 .xls 文件")
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(400, "文件超过10MB限制")

    try:
        df = _extract_fields(pd.read_excel(BytesIO(content)))
    except ValueError as e:
        raise HTTPException(400, str(e))

    df["product_id"] = df["product_id"].astype(str)
    products = df.to_dict(orient="records")
    logger.info(f"[search] {len(products)} 个产品, 开始搜图...")

    results = []

    with ThreadPoolExecutor(max_workers=MAX_CONCURRENCY) as ex:
        futures = {ex.submit(_search_one, p, page_size, same_style_only): p for p in products}
        for fut in as_completed(futures):
            pid, cands, err = fut.result()
            results.append({
                "product_id": pid,
                "candidates": cands,
                "total": len(cands),
                "error": err,
            })

    results.sort(key=lambda r: products.index(next(p for p in products if p["product_id"] == r["product_id"])))

    return {"products": products, "results": results}


@router.post("/analyze")
async def sourcing_analyze(
    file: UploadFile = File(...),
    page_size: int = Form(10),
    same_style_only: bool = Form(True),
    cny_per_brl: float = Form(1.7),
    freight_brl: float = Form(5.0),
    clearance_brl: float = Form(2.0),
    other_brl: float = Form(1.0),
    target_margin_rate: float = Form(0.15),
    high_margin_rate: float = Form(0.30),
):
    """上传 Shopee Excel → 搜图 + 成本计算 + 推荐，返回完整分析结果"""
    filename = file.filename or ""
    logger.info(f"[analyze] 收到: {filename}")
    if not filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "请上传 .xlsx 或 .xls 文件")
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(400, "文件超过10MB限制")

    try:
        df = _extract_fields(pd.read_excel(BytesIO(content)))
    except ValueError as e:
        raise HTTPException(400, str(e))

    df["product_id"] = df["product_id"].astype(str)
    products = df.to_dict(orient="records")
    logger.info(f"[analyze] {len(products)} 个产品")

    cost_cfg = {
        "cny_per_brl": cny_per_brl,
        "freight_brl": freight_brl,
        "clearance_brl": clearance_brl,
        "other_brl": other_brl,
        "target_margin_rate": target_margin_rate,
        "high_margin_rate": high_margin_rate,
    }

    # 并发搜图
    candidates_map = {}

    with ThreadPoolExecutor(max_workers=MAX_CONCURRENCY) as ex:
        futures = {ex.submit(_search_one, p, page_size, same_style_only): p for p in products}
        for fut in as_completed(futures):
            pid, cands, _ = fut.result()
            candidates_map[pid] = cands

    # 构建分析行
    rows = []
    for prod in products:
        pid = prod["product_id"]
        cands = candidates_map.get(pid, [])
        rows.append(_build_row(prod, cands, cost_cfg))

    summary = {
        "total_products": len(rows),
        "with_1688_data": sum(1 for r in rows if r["has_1688_data"]),
        "recommended": sum(1 for r in rows if r["recommendation"] == "推荐"),
        "consider": sum(1 for r in rows if r["recommendation"] == "可考虑"),
        "warning": sum(1 for r in rows if r["recommendation"] == "预警"),
        "incomplete": sum(1 for r in rows if r["recommendation"] == "待补全"),
    }

    return {"summary": summary, "rows": rows, "cost_config": cost_cfg}


def _sse(event: str, data: dict) -> str:
    """构建 SSE 事件帧"""
    return f"event: {event}\ndata: {_json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("/analyze-stream")
async def sourcing_analyze_stream(
    file: UploadFile = File(...),
    page_size: int = Form(10),
    same_style_only: bool = Form(True),
    cny_per_brl: float = Form(1.7),
    freight_brl: float = Form(5.0),
    clearance_brl: float = Form(2.0),
    other_brl: float = Form(1.0),
    target_margin_rate: float = Form(0.15),
    high_margin_rate: float = Form(0.30),
):
    """SSE 流式版 analyze — 实时推送每个产品的搜索进度 + 成本计算结果"""
    filename = file.filename or ""
    logger.info(f"[stream] 收到: {filename}")
    if not filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "请上传 .xlsx 或 .xls 文件")
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(400, "文件超过10MB限制")

    try:
        df = _extract_fields(pd.read_excel(BytesIO(content)))
    except ValueError as e:
        raise HTTPException(400, str(e))

    df["product_id"] = df["product_id"].astype(str)
    products = df.to_dict(orient="records")
    total = len(products)
    logger.info(f"[stream] {total} 个产品")

    cost_cfg = {
        "cny_per_brl": cny_per_brl,
        "freight_brl": freight_brl,
        "clearance_brl": clearance_brl,
        "other_brl": other_brl,
        "target_margin_rate": target_margin_rate,
        "high_margin_rate": high_margin_rate,
    }

    async def generate():
        yield _sse("phase", {"phase": "parsing", "message": f"已解析 {total} 个产品"})
        yield _sse("start", {"total": total, "message": f"开始并发搜图 ({MAX_CONCURRENCY} 线程)"})

        # 在独立线程池中跑阻塞搜图，不阻塞 event loop
        loop = asyncio.get_event_loop()
        executor = ThreadPoolExecutor(max_workers=MAX_CONCURRENCY)
        candidates_map = {}
        done = 0

        try:
            # 提交所有任务
            fut_map = {}
            for p in products:
                fut = loop.run_in_executor(executor, _search_one, p, page_size, same_style_only)
                fut_map[fut] = p

            # 逐个完成时推送进度
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

        # 构建结果
        rows = []
        for prod in products:
            pid = prod["product_id"]
            cands = candidates_map.get(pid, [])
            rows.append(_build_row(prod, cands, cost_cfg))

        summary = {
            "total_products": len(rows),
            "with_1688_data": sum(1 for r in rows if r["has_1688_data"]),
            "recommended": sum(1 for r in rows if r["recommendation"] == "推荐"),
            "consider": sum(1 for r in rows if r["recommendation"] == "可考虑"),
            "warning": sum(1 for r in rows if r["recommendation"] == "预警"),
            "incomplete": sum(1 for r in rows if r["recommendation"] == "待补全"),
        }

        yield _sse("complete", {
            "summary": summary,
            "rows": rows,
            "cost_config": cost_cfg,
        })

    return StreamingResponse(generate(), media_type="text/event-stream",
                             headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"})


@router.post("/refresh-session")
async def refresh_session():
    """强制刷新 1688 游客 session"""
    reset_session()
    return {"status": "ok", "message": "session 已重置"}
