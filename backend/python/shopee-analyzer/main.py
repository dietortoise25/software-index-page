# shopee-analyzer.service — Shopee 数据分析 (FastAPI, port 8000)
"""Shopee 店铺数据分析 API — app 装配 + 路由挂载（业务路由见 routers/）"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.sourcing import router as sourcing_router
from routers.shopee_store import router as store_router

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
app.include_router(sourcing_router)
app.include_router(store_router)
