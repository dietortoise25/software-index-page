# shopee-analyzer.service — Shopee 数据分析 (FastAPI, port 8000)
"""Shopee 店铺数据分析 API — 接收文件上传，返回分析 + 诊断"""
import logging
import traceback
from io import BytesIO

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import yaml

from analyzer import analyze_excel
from extractors.shopee_ads import extract_ads_overall
from extractors.shopee_orders import extract_orders
from metrics.ad_metrics import compute_ad_summary
from metrics.cross_metrics import compute_product_from_orders
from diagnose import load_rules, run_diagnose, CONFIG_PATH
from simulate import run_simulation
from aibuy_client import search_by_image

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("api")

app = FastAPI(
    title="Shopee 店铺数据分析 API",
    description="上传 Shopee Excel + 广告CSV，返回店铺分析 + ROI诊断报告。",
    version="2.1.0",
    contact={"name": "Data Team"},
    docs_url="/api/docs",
)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

MAX_FILE_SIZE = 10 * 1024 * 1024


@app.post("/api/analyze")
async def analyze(file: UploadFile = File(...)):
    filename = file.filename or ""
    logger.info(f"收到上传: {filename}")
    if not filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "请上传 .xlsx 或 .xls 格式文件")
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(400, f"文件超过10MB限制")
    if len(content) == 0:
        raise HTTPException(400, "文件为空")
    if not content[:2] == b"PK":
        raise HTTPException(400, "无效的 Excel 文件格式")
    try:
        result = analyze_excel(BytesIO(content))
        return JSONResponse(result)
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception:
        logger.exception("分析失败")
        raise HTTPException(500, traceback.format_exc())


@app.post("/api/diagnose")
async def diagnose(
    store_file: UploadFile = File(None, description="店铺统计 Excel"),
    ad_file: UploadFile = File(None, description="广告整体 CSV"),
    order_file: UploadFile = File(None, description="订单明细 Excel"),
):
    """上传多个文件，返回店铺分析 + ROI诊断"""
    result = {}

    # Store Excel
    if store_file:
        content = await store_file.read()
        try:
            result["analysis"] = analyze_excel(BytesIO(content))
        except Exception:
            logger.exception("店铺分析失败")
            raise HTTPException(500, f"店铺分析失败：{traceback.format_exc()}")

    # Ad CSV
    ad_summary = None
    if ad_file:
        content = await ad_file.read()
        try:
            ad_df = extract_ads_overall(BytesIO(content))
            ad_summary = compute_ad_summary(ad_df)
            result["ad_metrics"] = ad_summary
        except Exception:
            logger.exception("广告分析失败")
            raise HTTPException(500, f"广告分析失败：{traceback.format_exc()}")

    # Order Excel — 补充商品矩阵（订单为可信数据源）
    if order_file:
        content = await order_file.read()
        try:
            order_df = extract_orders(BytesIO(content))
            if "analysis" in result:
                products = result["analysis"].get("products", {})
                paid_products = result["analysis"].get("paid_products", {})
                if not products.get("items"):
                    result["analysis"]["products"] = compute_product_from_orders(order_df)
                if not paid_products.get("items"):
                    result["analysis"]["paid_products"] = compute_product_from_orders(order_df)
        except Exception:
            logger.exception("订单分析失败")
            raise HTTPException(500, f"订单分析失败：{traceback.format_exc()}")

    # Diagnose
    analysis = result.get("analysis", {})
    orders = analysis.get("orders", {}).get("summary", {})
    users = analysis.get("users", {})

    diag_data = {
        "ad_total_spend": (ad_summary or {}).get("total_spend", 0),
        "ad_zero_conv_spend": (ad_summary or {}).get("zero_conv_spend", 0),
        "ad_zero_conv_count": (ad_summary or {}).get("zero_conv_count", 0),
        "ad_total_count": (ad_summary or {}).get("ad_count", 0),
        "ad_roas": (ad_summary or {}).get("roas", 0),
        "ad_ctr": (ad_summary or {}).get("ctr", 0),
        "ad_cvr": (ad_summary or {}).get("cvr", 0),
        "ad_total_sales": (ad_summary or {}).get("total_sales", 0),
        "store_cancel_rate": orders.get("cancel_rate", 0),
        "store_repeat_rate": users.get("repeat_rate", 0),
        "store_conversion_rate": orders.get("conversion_rate", 0),
        "store_product_top5_share": analysis.get("products", {}).get("top5_share", 0),
        "store_new_buyer_ratio": users.get("new_ratio", 0),
    }
    diag_result = run_diagnose(diag_data, load_rules())
    result["diagnose"] = {
        "overall_score": diag_result.overall_score,
        "health_checks": diag_result.health_checks,
        "problems": diag_result.problems,
        "ai_insights": diag_result.ai_insights,
    }

    return JSONResponse(result)


@app.get("/api/rules")
async def get_rules():
    """读取诊断规则配置"""
    try:
        rules = load_rules()
        return {"rules": rules}
    except Exception:
        raise HTTPException(500, traceback.format_exc())


@app.put("/api/rules")
async def update_rules(body: dict):
    """更新诊断规则配置（合并写入）"""
    try:
        new_rules = body.get("rules", [])
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)
        config["rules"] = new_rules
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            yaml.safe_dump(config, f, allow_unicode=True, sort_keys=False)
        return {"status": "ok"}
    except Exception:
        raise HTTPException(500, traceback.format_exc())


@app.post("/api/simulate")
async def simulate(body: dict):
    """预算重分配模拟：输入广告指标，返回 baseline vs optimized 对比"""
    try:
        pct = body.get("realloc_pct", 70)
        result = run_simulation(body.get("ad_metrics", {}), pct)
        return JSONResponse(result)
    except Exception:
        raise HTTPException(500, traceback.format_exc())


@app.post("/api/search-image")
async def search_image(body: dict):
    """以图搜货：传入图片 URL，返回 1688 候选商品"""
    image_url = body.get("image_url", "")
    if not image_url:
        raise HTTPException(400, "缺少 image_url 参数")
    try:
        offers, total = search_by_image(image_url, page_size=body.get("page_size", 10))
        return {"offers": offers, "total": total}
    except Exception:
        logger.exception("图搜失败")
        raise HTTPException(500, traceback.format_exc())


@app.get("/api/health")
async def health():
    return {"status": "ok"}
