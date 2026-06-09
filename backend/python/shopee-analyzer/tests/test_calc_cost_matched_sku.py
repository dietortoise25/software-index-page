"""
_calc_cost 成本来源重设计 — 弃用图搜 itemPrice，改用 step4 选中的 SKU 单价
运行: cd backend/python/shopee-analyzer && python -m pytest tests/test_calc_cost_matched_sku.py -v

背景：itemPrice（图搜返回的粗价）被用户明确判定无用，且大量候选 itemPrice 为空导致
"待补全"泛滥。重设计后成本基于 step4 LLM 选中的具体 SKU 的真实单价。
"""

_COST = {"cny_per_brl": 1.35, "cost_multiplier": 1.3,
         "target_margin_rate": 0.15, "high_margin_rate": 0.30,
         "verify_threshold": 0.5}


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
    # 老板要求：不算汇率，进货价数值 × 倍率直接标 R$
    expected_brl = round(7.40 * 1.3, 2)
    assert r["cost_brl"] == expected_brl


def test_recommendation_from_matched_sku_margin():
    """选中 SKU 单价低 → 利润率高 → 推荐档正确(非待补全)"""
    from sourcing import _calc_cost
    row = {
        "shopee_price_num": 19.90,
        "best_1688": {"matched_sku": {"price": "7.40"}},
    }
    r = _calc_cost(row, _COST)
    # cost_brl = 7.40*1.3 = 9.62; margin = 19.90-9.62 = 10.28; rate ≈ 0.52 ≥ high
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


def test_low_image_confidence_downgrades_recommendation():
    """图文置信度低于核对阈值 → 即便利润率高，也降级为「疑似不符」，不再标推荐。
    背景：单个小压缩袋被错配成 6 件套，图分 0.42，但利润率 93% 仍标推荐，自相矛盾。"""
    from sourcing import _calc_cost
    row = {
        "shopee_price_num": 28.99,
        "best_1688": {
            "image_confidence": 0.42,
            "matched_sku": {"price": "1.40"},
        },
    }
    r = _calc_cost(row, _COST)
    # cost=1.4*1.3=1.82, margin≈0.94 ≥ high，本应「推荐」，但图分<0.5 须降级
    assert r["recommendation"] == "疑似不符"


def test_high_image_confidence_keeps_recommendation():
    """图文置信度达标 → 推荐档不受影响"""
    from sourcing import _calc_cost
    row = {
        "shopee_price_num": 19.90,
        "best_1688": {"image_confidence": 0.92, "matched_sku": {"price": "7.40"}},
    }
    r = _calc_cost(row, _COST)
    assert r["recommendation"] == "推荐"


def test_missing_image_confidence_does_not_downgrade():
    """无图文核对(置信度 None) → 不降级，沿用利润率档位"""
    from sourcing import _calc_cost
    row = {
        "shopee_price_num": 19.90,
        "best_1688": {"matched_sku": {"price": "7.40"}},
    }
    r = _calc_cost(row, _COST)
    assert r["recommendation"] == "推荐"
