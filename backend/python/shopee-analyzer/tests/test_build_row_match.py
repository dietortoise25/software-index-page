"""
_build_row 接入 step4 选中结果 + 人工复核标记
运行: cd backend/python/shopee-analyzer && python -m pytest tests/test_build_row_match.py -v

step4(LLM)返回选中的 item_id+sku_id；_build_row 据此把选中 SKU 填入
best_1688.matched_sku，供 _calc_cost 算成本。LLM 失败时标记需人工复核。
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
    match = {"data": {"matched_item_id": "AAA", "matched_sku_id": 1, "confidence": 0.9, "reason": "规格贴合"}, "fail_reason": None}
    row = _build_row(_prod(), _cands_with_sku(), _COST, _sku_cache(), match=match)
    assert row["best_1688"]["item_id"] == "AAA"
    assert row["best_1688"]["matched_sku"]["sku_id"] == 1
    assert row["best_1688"]["matched_sku"]["price"] == "20.00"
    assert row["match_source"] == "llm"
    assert row["match_reason"] == "规格贴合"
    assert row["cost_cny"] == 20.00


def test_llm_failed_marks_manual_review():
    """match fail_reason='llm_call_failed' → match_source='llm_failed'，不自动选 SKU"""
    from sourcing import _build_row
    match = {"data": None, "fail_reason": "llm_call_failed"}
    row = _build_row(_prod(), _cands_with_sku(), _COST, _sku_cache(), match=match)
    assert row["match_source"] == "llm_failed"
    assert row["best_1688"]["matched_sku"] is None


def test_no_sku_anywhere_is_pending():
    """所有候选都无 SKU 价 → match_source='none'"""
    from sourcing import _build_row
    empty_cache = {"AAA": {"sku_count": 0, "skus": [], "error": "未配置"},
                   "BBB": {"sku_count": 0, "skus": [], "error": "未配置"}}
    row = _build_row(_prod(), _cands_with_sku(), _COST, empty_cache, match={"data": None, "fail_reason": "no_sku_data"})
    assert row["recommendation"] == "待补全"
    assert row["match_source"] == "no_sku_data"


def test_match_with_unknown_sku_id_marks_mismatch():
    """match 指向不存在的 sku_id → match_source='llm_mismatch'，需人工复核"""
    from sourcing import _build_row
    match = {"data": {"matched_item_id": "AAA", "matched_sku_id": 99999, "confidence": 0.5, "reason": "x"}, "fail_reason": None}
    row = _build_row(_prod(), _cands_with_sku(), _COST, _sku_cache(), match=match)
    assert row["match_source"] == "llm_mismatch"
    assert row["best_1688"]["matched_sku"] is None


def test_candidate_scores_attached_to_each_candidate():
    """match.candidate_scores 按 item_id 把 STEP5 评分挂到对应候选上，
    供候选明细逐个展示(不只冠军)。"""
    from sourcing import _build_row
    match = {
        "data": {"matched_item_id": "AAA", "matched_sku_id": 1, "reason": "r", "overall_score": 90},
        "fail_reason": None,
        "candidate_scores": {
            "AAA": {"overall_score": 90, "scores": {"price": 80, "semantic_match": 95, "image_match": 88, "supply": 70}},
            "BBB": {"overall_score": 62, "scores": {"price": 90, "semantic_match": 50, "image_match": 60, "supply": 55}},
        },
    }
    row = _build_row(_prod(), _cands_with_sku(), _COST, _sku_cache(), match=match)
    by_id = {c["item_id"]: c for c in row["candidates"]}
    assert by_id["AAA"]["match_overall_score"] == 90
    assert by_id["AAA"]["match_scores"]["semantic_match"] == 95
    assert by_id["BBB"]["match_overall_score"] == 62
    assert by_id["BBB"]["match_scores"]["price"] == 90


def test_candidate_without_score_stays_none():
    """无评分的候选(无 SKU/未调) → match_overall_score 为 None"""
    from sourcing import _build_row
    match = {
        "data": {"matched_item_id": "AAA", "matched_sku_id": 1, "reason": "r", "overall_score": 90},
        "fail_reason": None,
        "candidate_scores": {"AAA": {"overall_score": 90, "scores": {}}},
    }
    row = _build_row(_prod(), _cands_with_sku(), _COST, _sku_cache(), match=match)
    by_id = {c["item_id"]: c for c in row["candidates"]}
    assert by_id["BBB"]["match_overall_score"] is None
    assert by_id["BBB"]["match_scores"] is None
