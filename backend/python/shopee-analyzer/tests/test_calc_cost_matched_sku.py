"""
_calc_cost 成本来源重设计 — 弃用图搜 itemPrice，改用 step4 选中的 SKU 单价
运行: cd backend/python/shopee-analyzer && python -m pytest tests/test_calc_cost_matched_sku.py -v

背景：itemPrice（图搜返回的粗价）被用户明确判定无用，且大量候选 itemPrice 为空导致
"待补全"泛滥。重设计后成本基于 step4 LLM 选中的具体 SKU 的真实单价。
"""

_COST = {"cny_per_brl": 1.35, "cost_multiplier": 1.3,
         "target_margin_rate": 0.15, "high_margin_rate": 0.30}


def test_cost_from_matched_sku_price_not_itemprice():
    """成本取自 best_1688.matched_sku.price，而非 itemPrice(price_cny)。
    itemPrice 故意设成误导性的值，证明它不再参与计算。"""
    from sourcing import _calc_cost
    row = {
        "shopee_price_num": 19.90,
        "best_1688": {
            "price_cny": "999.00",  # itemPrice 误导值，应被忽略
            "matched_sku": {"sku_id": 123, "price": "7.40", "full_spec": "红 / M"},
        },
    }
    r = _calc_cost(row, _COST)
    # cost_cny 应来自选中 SKU 的 7.40，不是 itemPrice 的 999
    assert r["cost_cny"] == 7.40
    expected_brl = round(7.40 / 1.35 * 1.3, 2)
    assert r["cost_brl"] == expected_brl


def test_recommendation_from_matched_sku_margin():
    """选中 SKU 单价低 → 利润率高 → 推荐档正确(非待补全)"""
    from sourcing import _calc_cost
    row = {
        "shopee_price_num": 19.90,
        "best_1688": {"matched_sku": {"price": "7.40"}},
    }
    r = _calc_cost(row, _COST)
    # cost_brl = 7.40/1.35*1.3 ≈ 7.13; margin = 19.90-7.13 ≈ 12.77; rate ≈ 0.64 ≥ high
    assert r["recommendation"] == "推荐"
    assert r["margin_rate"] is not None and r["margin_rate"] > 0.30


def test_pending_only_when_no_matched_sku():
    """无选中 SKU(所有候选都没价) → 待补全。这是唯一的待补全条件。"""
    from sourcing import _calc_cost
    row = {"shopee_price_num": 19.90, "best_1688": {"matched_sku": None}}
    r = _calc_cost(row, _COST)
    assert r["recommendation"] == "待补全"
    assert r["cost_cny"] is None


def test_pending_when_no_best_1688():
    """完全没有 1688 候选 → 待补全，不抛异常"""
    from sourcing import _calc_cost
    row = {"shopee_price_num": 19.90, "best_1688": None}
    r = _calc_cost(row, _COST)
    assert r["recommendation"] == "待补全"
