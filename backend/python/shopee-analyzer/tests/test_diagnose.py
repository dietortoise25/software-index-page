"""规则引擎测试"""
import pytest
from diagnose import load_rules, run_diagnose, DiagnoseResult


class TestLoadRules:
    def test_loads_all_rules(self):
        rules = load_rules()
        assert len(rules) >= 5
        for r in rules:
            assert 'id' in r
            assert 'title' in r
            assert 'threshold' in r
            assert 'severity' in r

    def test_each_rule_has_enabled_field(self):
        rules = load_rules()
        for r in rules:
            assert 'enabled' in r


class TestRunDiagnose:
    def test_empty_input_returns_empty(self):
        result = run_diagnose({}, load_rules())
        assert isinstance(result, DiagnoseResult)
        assert result.overall_score > 0

    def test_detects_zero_conversion_waste(self):
        data = {
            "ad_total_spend": 100.0,
            "ad_zero_conv_spend": 50.0,
            "ad_zero_conv_count": 10,
            "ad_total_count": 20,
            "ad_roas": 5.0,
            "ad_ctr": 0.03,
            "ad_cvr": 0.01,
            "store_cancel_rate": 0.10,
            "store_repeat_rate": 0.02,
            "store_conversion_rate": 0.02,
            "store_product_top5_share": 0.85,
            "store_new_buyer_ratio": 0.80,
            "ad_total_sales": 500.0,
        }
        result = run_diagnose(data, load_rules())
        problem_ids = [p['id'] for p in result.problems]
        assert 'zero_conversion_waste' in problem_ids

    def test_severity_ordering(self):
        data = {
            "ad_total_spend": 100.0,
            "ad_zero_conv_spend": 50.0,
            "ad_zero_conv_count": 10,
            "ad_total_count": 20,
            "ad_roas": 5.0,
            "ad_ctr": 0.03,
            "ad_cvr": 0.01,
            "store_cancel_rate": 0.31,
            "store_repeat_rate": 0.0,
            "store_conversion_rate": 0.01,
            "store_product_top5_share": 0.95,
            "store_new_buyer_ratio": 0.90,
            "ad_total_sales": 500.0,
        }
        result = run_diagnose(data, load_rules())
        if result.problems:
            severities = [p['severity'] for p in result.problems]
            assert severities == sorted(severities, key=lambda s: {'critical': 0, 'warning': 1, 'info': 2}.get(s, 99))
