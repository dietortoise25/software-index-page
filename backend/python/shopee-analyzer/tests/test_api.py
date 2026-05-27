"""测试 FastAPI 端点"""
import io
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

VALID_XLSX = None


def _get_valid_xlsx():
    global VALID_XLSX
    if VALID_XLSX is None:
        import openpyxl
        wb = openpyxl.Workbook()
        # 最小 8 张工作表
        sheet_keys = [
            ("已下订单", ["日期", "销售额 (BRL)", "销售额（扣除Shopee补贴）", "订单数",
                          "商品点击量", "访客数", "订单转化率", "买家数", "新买家数",
                          "现有买家数量", "潜在买家数", "已取消的订单", "已退货/退款的订单"]),
            ("已付款订单", ["日期", "销售额 (BRL)", "销售额（扣除Shopee补贴）", "订单数",
                           "商品点击量", "访客数", "订单转化率", "买家数", "新买家数",
                           "现有买家数量", "潜在买家数", "已取消的订单", "已退货/退款的订单"]),
            ("流量来源（已下订单）", ["流量来源", "销售 (BRL)", "销售占比", "商品曝光量", "商品点击量",
                                    "点击率", "订单转化率", "订单数"]),
            ("来源分布（已下订单）", ["流量来源", "日期", "商品曝光量", "商品点击量", "订单数"]),
            ("商品分布（已下订单）", ["商品编号", "商品", "销售 (BRL)", "销售占比", "商品曝光量",
                                    "商品点击量", "订单数", "点击率", "订单转化率"]),
            ("流量来源（已付款的订单）", ["流量来源", "销售 (BRL)", "销售占比", "商品曝光量", "商品点击量",
                                       "点击率", "订单转化率", "订单数"]),
            ("来源分布（已付款订单）", ["流量来源", "日期", "商品曝光量", "商品点击量", "订单数"]),
            ("商品分布（已付款订单）", ["商品编号", "商品", "销售 (BRL)", "销售占比", "商品曝光量",
                                     "商品点击量", "订单数", "点击率", "订单转化率"]),
        ]
        # 移除默认 sheet
        wb.remove(wb.active)
        for name, headers in sheet_keys:
            ws = wb.create_sheet(name)
            # 写标题行
            for c, h in enumerate(headers, 1):
                ws.cell(1, c, h)
            # 写一行日数据
            ws.cell(2, 1, "17/05/2026")
            for c in range(2, len(headers) + 1):
                ws.cell(2, c, "0")

        buf = io.BytesIO()
        wb.save(buf)
        VALID_XLSX = buf.getvalue()

    return VALID_XLSX


class TestHealth:
    def test_health(self):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


class TestAnalyzeEndpoint:
    def test_valid_xlsx(self):
        resp = client.post(
            "/api/analyze",
            files={"file": ("test.xlsx", _get_valid_xlsx(),
                   "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "orders" in data
        assert "paid_orders" in data
        assert "traffic" in data
        assert "products" in data
        assert "users" in data

    def test_invalid_extension(self):
        resp = client.post(
            "/api/analyze",
            files={"file": ("test.txt", b"not excel", "text/plain")},
        )
        assert resp.status_code == 400

    def test_empty_file(self):
        resp = client.post(
            "/api/analyze",
            files={"file": ("empty.xlsx", b"", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert resp.status_code == 400

    def test_not_excel_content(self):
        resp = client.post(
            "/api/analyze",
            files={"file": ("fake.xlsx", b"not a zip file at all",
                   "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert resp.status_code == 400

    def test_missing_sheets(self):
        """Excel 缺少必需工作表时返回 422"""
        import openpyxl
        wb = openpyxl.Workbook()
        wb.remove(wb.active)
        ws = wb.create_sheet("无关数据")
        ws.cell(1, 1, "随便")
        buf = io.BytesIO()
        wb.save(buf)
        resp = client.post(
            "/api/analyze",
            files={"file": ("bad.xlsx", buf.getvalue(),
                   "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert resp.status_code in (422, 500)
