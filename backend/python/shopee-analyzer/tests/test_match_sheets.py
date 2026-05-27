"""测试工作表名称匹配"""
import pytest
from analyzer import match_sheets, SHEET_SPECS

ACTUAL_NAMES = [
    "已下订单", "已付款订单",
    "流量来源（已下订单）", "来源分布（已下订单）", "商品分布（已下订单）",
    "流量来源（已付款的订单）", "来源分布（已付款订单）", "商品分布（已付款订单）",
]


class TestMatchSheets:
    def test_all_eight_matched(self):
        result = match_sheets(ACTUAL_NAMES)
        assert len(result) == 8
        assert result["orders"] == "已下订单"
        assert result["paid_orders"] == "已付款订单"
        assert result["traffic"] == "流量来源（已下订单）"
        assert result["source_dist"] == "来源分布（已下订单）"
        assert result["products"] == "商品分布（已下订单）"
        assert result["paid_traffic"] == "流量来源（已付款的订单）"
        assert result["paid_source"] == "来源分布（已付款订单）"
        assert result["paid_products"] == "商品分布（已付款订单）"

    def test_missing_sheet_raises(self):
        with pytest.raises(ValueError, match="未找到或匹配到多张"):
            match_sheets(["只有一张表"])

    def test_all_specs_have_three_parts(self):
        for spec in SHEET_SPECS:
            assert len(spec) == 3, f"SPEC {spec[0]} 必须有3个元素"
