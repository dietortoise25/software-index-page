"""
services/cost_calculator.py — 成本/利润/推荐等级纯计算函数

把原 sourcing.py 内的 _calc_cost / _parse_shopee_price / _to_cost_float 抽成
无 IO 的纯函数后，此测试直接覆盖新模块。行为必须与原逻辑完全一致。

运行: cd backend/python/shopee-analyzer && python -m pytest tests/test_cost_calculator.py -v
"""

from services.cost_calculator import calc_cost, parse_shopee_price, to_cost_float

_COST = {"cny_per_brl": 1.35, "cost_multiplier": 1.3,
         "target_margin_rate": 0.15, "high_margin_rate": 0.30,
         "verify_threshold": 0.5}


# ========== parse_shopee_price ==========

def test_parse_shopee_price_strips_currency_and_comma():
    # 逗号被当千分位移除（原逻辑），"19,90" → "1990" → 1990.0
    assert parse_shopee_price("R$ 1,990") == 1990.0
    assert parse_shopee_price("R$ 19.90") == 19.9


def test_parse_shopee_price_takes_first_of_range():
    # 取 ~ 分隔的第一段；逗号同样被移除
    assert parse_shopee_price("R$ 19.90 ~ 29.90") == 19.9


def test_parse_shopee_price_invalid_returns_none():
    assert parse_shopee_price("abc") is None


def test_parse_shopee_price_nan_returns_none():
    import pandas as pd
    assert parse_shopee_price(pd.NA) is None


# ========== to_cost_float ==========

def test_to_cost_float_parses_number():
    assert to_cost_float("7.40") == 7.40


def test_to_cost_float_empty_returns_none():
    assert to_cost_float("") is None
    assert to_cost_float(None) is None


# ========== calc_cost: 正常成本/利润计算 ==========

def test_cost_from_matched_sku_price_not_itemprice():
    """成本取自 best_1688.matched_sku.price，忽略误导性 itemPrice。"""
    row = {
        "shopee_price_num": 19.90,
        "best_1688": {
            "price_cny": "999.00",  # itemPrice 误导值，应被忽略
            "matched_sku": {"sku_id": 123, "price": "7.40", "full_spec": "红 / M"},
        },
    }
    r = calc_cost(row, _COST)
    assert r["cost_cny"] == 7.40
    expected_brl = round(7.40 * 1.3, 2)
    assert r["cost_brl"] == expected_brl
    assert r["total_cost_brl"] == expected_brl
    assert r["cost_multiplier"] == 1.3


def test_margin_rate_calculation():
    """margin_brl = shopee - cost_brl; margin_rate = margin_brl / shopee。"""
    row = {"shopee_price_num": 19.90, "best_1688": {"matched_sku": {"price": "7.40"}}}
    r = calc_cost(row, _COST)
    cost_brl = round(7.40 * 1.3, 2)  # 9.62
    assert r["margin_brl"] == round(19.90 - cost_brl, 2)
    assert r["margin_rate"] == round((19.90 - cost_brl) / 19.90, 4)


# ========== 推荐等级边界判定 ==========

def test_recommendation_high_margin_is_tuijian():
    row = {"shopee_price_num": 19.90, "best_1688": {"matched_sku": {"price": "7.40"}}}
    r = calc_cost(row, _COST)
    # rate ≈ 0.52 ≥ high(0.30)
    assert r["recommendation"] == "推荐"
    assert r["margin_rate"] > 0.30


def test_recommendation_mid_margin_is_kaolv():
    """target ≤ rate < high → 可考虑。"""
    # 选 cost 使 rate 落在 [0.15, 0.30)。shopee=10, 取 rate≈0.20。
    # margin_brl = 10 - cost_brl; rate = 0.20 → cost_brl = 8.0 → price = 8.0/1.3
    row = {"shopee_price_num": 10.0, "best_1688": {"matched_sku": {"price": str(8.0 / 1.3)}}}
    r = calc_cost(row, _COST)
    assert 0.15 <= r["margin_rate"] < 0.30
    assert r["recommendation"] == "可考虑"


def test_recommendation_low_margin_is_yujing():
    """rate < target → 预警。"""
    # cost 接近 shopee → 低利润。shopee=10, cost_brl=9.5 → rate=0.05
    row = {"shopee_price_num": 10.0, "best_1688": {"matched_sku": {"price": str(9.5 / 1.3)}}}
    r = calc_cost(row, _COST)
    assert r["margin_rate"] < 0.15
    assert r["recommendation"] == "预警"


def test_pending_only_when_no_matched_sku():
    """无选中 SKU → 待补全。"""
    row = {"shopee_price_num": 19.90, "best_1688": {"matched_sku": None}}
    r = calc_cost(row, _COST)
    assert r["recommendation"] == "待补全"
    assert r["cost_cny"] is None


def test_pending_when_no_best_1688():
    row = {"shopee_price_num": 19.90, "best_1688": None}
    r = calc_cost(row, _COST)
    assert r["recommendation"] == "待补全"


def test_pending_when_no_shopee_price():
    """无 shopee 价 → 待补全。"""
    row = {"shopee_price_num": None, "best_1688": {"matched_sku": {"price": "7.40"}}}
    r = calc_cost(row, _COST)
    assert r["recommendation"] == "待补全"


# ========== 图文置信度降级 ==========

def test_low_image_confidence_downgrades_to_suspect():
    row = {
        "shopee_price_num": 28.99,
        "best_1688": {"image_confidence": 0.42, "matched_sku": {"price": "1.40"}},
    }
    r = calc_cost(row, _COST)
    assert r["recommendation"] == "疑似不符"


def test_high_image_confidence_keeps_recommendation():
    row = {
        "shopee_price_num": 19.90,
        "best_1688": {"image_confidence": 0.92, "matched_sku": {"price": "7.40"}},
    }
    r = calc_cost(row, _COST)
    assert r["recommendation"] == "推荐"


def test_missing_image_confidence_does_not_downgrade():
    row = {"shopee_price_num": 19.90, "best_1688": {"matched_sku": {"price": "7.40"}}}
    r = calc_cost(row, _COST)
    assert r["recommendation"] == "推荐"
