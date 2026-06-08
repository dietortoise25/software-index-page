"""
_build_rows 应用 step4 matches（pid → match）
运行: cd backend/python/shopee-analyzer && python -m pytest tests/test_build_rows_match.py -v
"""

_COST = {"cny_per_brl": 1.35, "cost_multiplier": 1.3,
         "target_margin_rate": 0.15, "high_margin_rate": 0.30}


def test_build_rows_applies_match_per_product():
    """matches[pid] 指定的选中 SKU 被用于该行成本计算"""
    from sourcing import _build_rows
    products = [{"product_id": "P1", "product_name": "裙", "shopee_price_brl": "R$ 39.90", "image_url": ""}]
    candidates_map = {"P1": [{"itemId": "AAA", "title": "x", "itemPrice": "999", "providerInfo": {}, "purchaseInfos": []}]}
    sku_cache = {"AAA": {"sku_count": 2, "skus": [
        {"sku_id": 1, "full_spec": "红/M", "price": "20.00"},
        {"sku_id": 2, "full_spec": "红/L", "price": "10.00"}], "error": None}}
    matches = {"P1": {"matched_item_id": "AAA", "matched_sku_id": 1, "confidence": 0.9, "reason": "贴合"}}

    rows = _build_rows(products, candidates_map, _COST, sku_cache, matches)

    assert rows[0]["match_source"] == "llm"
    assert rows[0]["best_1688"]["matched_sku"]["sku_id"] == 1
    assert rows[0]["cost_cny"] == 20.00  # 选中的 20，非 itemPrice 999


def test_build_rows_no_matches_falls_back():
    """matches 为 None/缺该 pid → 该行兜底最低价 SKU"""
    from sourcing import _build_rows
    products = [{"product_id": "P1", "product_name": "裙", "shopee_price_brl": "R$ 39.90", "image_url": ""}]
    candidates_map = {"P1": [{"itemId": "AAA", "title": "x", "itemPrice": "999", "providerInfo": {}, "purchaseInfos": []}]}
    sku_cache = {"AAA": {"sku_count": 2, "skus": [
        {"sku_id": 1, "full_spec": "红/M", "price": "20.00"},
        {"sku_id": 2, "full_spec": "红/L", "price": "10.00"}], "error": None}}

    rows = _build_rows(products, candidates_map, _COST, sku_cache, None)

    assert rows[0]["match_source"] == "fallback"
    assert rows[0]["cost_cny"] == 10.00  # 兜底最低价
