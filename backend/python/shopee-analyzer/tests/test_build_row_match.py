"""
_build_row 接入 step4 选中结果 + 兜底最低价 SKU
运行: cd backend/python/shopee-analyzer && python -m pytest tests/test_build_row_match.py -v

step4(LLM)返回选中的 item_id+sku_id；_build_row 据此把选中 SKU 填入
best_1688.matched_sku，供 _calc_cost 算成本。LLM 失败/未启用(match=None)时
兜底取所有候选所有 SKU 的最低价，标 match_source=fallback；不阻塞。
"""

_COST = {"cny_per_brl": 1.35, "cost_multiplier": 1.3,
         "target_margin_rate": 0.15, "high_margin_rate": 0.30}


def _prod():
    return {"product_id": "P1", "product_name": "红色连衣裙",
            "image_url": "http://x/1.jpg", "shopee_price_brl": "R$ 39.90"}


def _cands_with_sku():
    """两个候选，各带 SKU 价表"""
    return [
        {"itemId": "AAA", "title": "候选A", "itemPrice": "999", "providerInfo": {}, "purchaseInfos": []},
        {"itemId": "BBB", "title": "候选B", "itemPrice": "999", "providerInfo": {}, "purchaseInfos": []},
    ]


def _sku_cache():
    return {
        "AAA": {"sku_count": 2, "min_price": "10.00", "max_price": "20.00", "min_price_spec": "蓝",
                "skus": [{"sku_id": 1, "full_spec": "蓝/M", "price": "20.00"},
                         {"sku_id": 2, "full_spec": "蓝/L", "price": "10.00"}], "error": None},
        "BBB": {"sku_count": 2, "min_price": "5.00", "max_price": "8.00", "min_price_spec": "红",
                "skus": [{"sku_id": 3, "full_spec": "红/M", "price": "8.00"},
                         {"sku_id": 4, "full_spec": "红/L", "price": "5.00"}], "error": None},
    }


def test_match_selects_specified_candidate_and_sku():
    """match 指定 item=AAA sku_id=1 → best_1688 是 AAA，matched_sku 是那条 20.00"""
    from sourcing import _build_row
    match = {"matched_item_id": "AAA", "matched_sku_id": 1, "confidence": 0.9, "reason": "规格贴合"}
    row = _build_row(_prod(), _cands_with_sku(), _COST, _sku_cache(), match=match)
    assert row["best_1688"]["item_id"] == "AAA"
    assert row["best_1688"]["matched_sku"]["sku_id"] == 1
    assert row["best_1688"]["matched_sku"]["price"] == "20.00"
    assert row["match_source"] == "llm"
    assert row["match_reason"] == "规格贴合"
    # 成本基于 20.00，而非 itemPrice 999
    assert row["cost_cny"] == 20.00


def test_fallback_picks_global_min_price_sku_when_no_match():
    """match=None(LLM 失败/未启用) → 兜底全局最低价 SKU = BBB 的 5.00，标 fallback"""
    from sourcing import _build_row
    row = _build_row(_prod(), _cands_with_sku(), _COST, _sku_cache(), match=None)
    assert row["match_source"] == "fallback"
    assert row["best_1688"]["item_id"] == "BBB"
    assert row["best_1688"]["matched_sku"]["sku_id"] == 4
    assert row["cost_cny"] == 5.00


def test_no_sku_anywhere_is_pending():
    """所有候选都无 SKU 价 → 无可选，待补全，match_source=none"""
    from sourcing import _build_row
    empty_cache = {"AAA": {"sku_count": 0, "skus": [], "error": "未配置"},
                   "BBB": {"sku_count": 0, "skus": [], "error": "未配置"}}
    row = _build_row(_prod(), _cands_with_sku(), _COST, empty_cache, match=None)
    assert row["recommendation"] == "待补全"
    assert row["match_source"] == "none"


def test_match_with_unknown_sku_id_falls_back():
    """match 指向不存在的 sku_id → 降级到兜底最低价，不崩"""
    from sourcing import _build_row
    match = {"matched_item_id": "AAA", "matched_sku_id": 99999, "confidence": 0.5, "reason": "x"}
    row = _build_row(_prod(), _cands_with_sku(), _COST, _sku_cache(), match=match)
    assert row["match_source"] == "fallback"
    assert row["best_1688"]["matched_sku"]["sku_id"] == 4  # 全局最低 5.00
