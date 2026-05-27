"""测试指标计算函数"""
import pandas as pd
import pytest
from analyzer import compute_orders_data, compute_product_data, compute_user_data


def make_orders_df():
    return pd.DataFrame({
        "日期": pd.to_datetime(["17/05/2026", "18/05/2026"], format="%d/%m/%Y"),
        "销售额 (BRL)": [50.0, 76.24],
        "销售额（扣除Shopee补贴）": [47.5, 72.43],
        "订单数": [3, 4],
        "商品点击量": [100, 150],
        "访客数": [30, 45],
        "订单转化率": [0.03, 0.0267],
        "买家数": [2, 3],
        "新买家数": [2, 2],
        "现有买家数量": [0, 1],
        "潜在买家数": [5, 8],
        "已取消的订单": [0, 1],
        "已退货/退款的订单": [0, 0],
        "每个订单的销售额": [16.67, 19.06],
    })


class TestComputeOrdersData:
    def test_basic_metrics(self):
        df = make_orders_df()
        result = compute_orders_data(df)

        s = result["summary"]
        assert s["total_sales"] == pytest.approx(126.24)
        assert s["total_orders"] == 7
        assert s["aov"] == pytest.approx(18.03, abs=0.01)
        assert s["cancelled_orders"] == 1
        assert s["cancel_rate"] == pytest.approx(0.125, abs=0.01)
        assert s["sales_days"] == 2
        assert s["total_days"] == 2

    def test_empty_df(self):
        result = compute_orders_data(pd.DataFrame())
        assert result["summary"] == {}
        assert result["daily"] == []

    def test_daily_records(self):
        df = make_orders_df()
        result = compute_orders_data(df)
        assert len(result["daily"]) == 2
        assert result["daily"][0]["销售额 (BRL)"] == 50.0


class TestComputeProductData:
    def test_empty(self):
        result = compute_product_data(pd.DataFrame())
        assert result["items"] == []
        assert result["top1_share"] == 0

    def test_concentration(self):
        df = pd.DataFrame({
            "section": ["商品卡", "商品卡", "商品卡"],
            "商品编号": ["1", "2", "3"],
            "商品": ["A", "B", "C"],
            "Current Item Status": ["正常", "正常", "正常"],
            "销售 (BRL)": [100.0, 50.0, 25.0],
            "销售占比": [0.5714, 0.2857, 0.1429],
            "商品曝光量": [1000, 500, 200],
            "商品点击量": [100, 50, 20],
            "订单数": [10, 5, 2],
            "点击率": [0.1, 0.1, 0.1],
            "订单转化率": [0.1, 0.1, 0.1],
        })
        result = compute_product_data(df)
        assert result["product_count"] == 3
        assert result["top1_share"] == pytest.approx(0.5714, abs=0.001)
        assert len(result["items"]) == 3


class TestComputeUserData:
    def test_basic(self):
        df = pd.DataFrame({
            "买家数": [3, 4],
            "新买家数": [2, 3],
            "现有买家数量": [1, 1],
            "潜在买家数": [5, 6],
            "重复购买率": [0.1, 0.15],
        })
        result = compute_user_data(df)
        assert result["total_buyers"] == 7
        assert result["new_buyers"] == 5
        assert result["existing_buyers"] == 2
        assert result["potential_buyers"] == 11

    def test_empty(self):
        assert compute_user_data(pd.DataFrame()) == {}
