"""广告指标计算测试"""
import pandas as pd
import pytest
from metrics.ad_metrics import compute_ad_summary


def make_ad_df():
    return pd.DataFrame({
        '花费': [3.0, 1.5, 0.5, 0.0],
        '销售金额': [30.0, 0.0, 5.0, 0.0],
        '展示次数': [1000, 500, 200, 10],
        '点击数': [50, 10, 8, 1],
        '转化': [2, 0, 1, 0],
        '广告支出回报率': [10.0, 0.0, 10.0, 0.0],
        '点击率': [0.05, 0.02, 0.04, 0.10],
    })


class TestComputeAdSummary:
    def test_basic_metrics(self):
        result = compute_ad_summary(make_ad_df())
        assert result['total_spend'] == 5.0
        assert result['total_sales'] == 35.0
        assert result['roas'] == 7.0
        assert result['total_conversions'] == 3
        assert result['ad_count'] == 4

    def test_zero_conv_breakdown(self):
        result = compute_ad_summary(make_ad_df())
        assert result['zero_conv_count'] == 2
        assert result['zero_conv_spend'] == 1.5

    def test_high_roas_under_invested(self):
        result = compute_ad_summary(make_ad_df())
        assert len(result['high_roas_ads']) >= 1

    def test_empty_df(self):
        result = compute_ad_summary(pd.DataFrame())
        assert result['ad_count'] == 0
        assert result['roas'] == 0.0
