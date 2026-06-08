"""
_match_all 编排 —— 对每个货品调 agent 选 SKU，收集 pid → match，逐个 yield 进度
运行: cd backend/python/shopee-analyzer && python -m pytest tests/test_match_all.py -v
"""


def _products():
    return [
        {"product_id": "P1", "product_name": "红裙", "category_path": "女装", "shopee_price_brl": "R$ 39.90"},
        {"product_id": "P2", "product_name": "蓝鞋", "category_path": "鞋", "shopee_price_brl": "R$ 59.90"},
    ]


def _candidates_map():
    return {
        "P1": [{"itemId": "AAA", "title": "裙厂", "providerInfo": {}, "purchaseInfos": []}],
        "P2": [{"itemId": "BBB", "title": "鞋厂", "providerInfo": {}, "purchaseInfos": []}],
    }


def _sku_cache():
    return {
        "AAA": {"sku_count": 1, "skus": [{"sku_id": 1, "full_spec": "红/M", "price": "10"}], "error": None},
        "BBB": {"sku_count": 1, "skus": [{"sku_id": 2, "full_spec": "蓝/40", "price": "20"}], "error": None},
    }


def test_match_all_collects_matches_per_product(monkeypatch):
    """对每个货品调 agent，按 pid 收集 match 结果"""
    import sourcing

    def fake_match(shopee, candidates):
        # 按货品名回不同结果，验证传参正确
        if shopee["name"] == "红裙":
            return {"matched_item_id": "AAA", "matched_sku_id": 1, "confidence": 0.9, "reason": "r"}
        return {"matched_item_id": "BBB", "matched_sku_id": 2, "confidence": 0.8, "reason": "b"}

    monkeypatch.setattr(sourcing, "match_sku_via_agent", fake_match)
    matches = {}
    list(sourcing._match_all(_products(), _candidates_map(), _sku_cache(), matches))

    assert matches["P1"]["matched_sku_id"] == 1
    assert matches["P2"]["matched_sku_id"] == 2


def test_match_all_passes_lean_shopee_and_candidates(monkeypatch):
    """喂给 agent 的 shopee 含 name/category/price，候选含 item_id + sku.items"""
    import sourcing
    seen = {}

    def capture(shopee, candidates):
        seen["shopee"] = shopee
        seen["candidates"] = candidates
        return None

    monkeypatch.setattr(sourcing, "match_sku_via_agent", capture)
    list(sourcing._match_all(_products()[:1], _candidates_map(), _sku_cache(), {}))

    assert seen["shopee"]["name"] == "红裙"
    assert seen["shopee"]["category"] == "女装"
    assert seen["shopee"]["price_brl"] == 39.90
    assert seen["candidates"][0]["item_id"] == "AAA"
    assert seen["candidates"][0]["sku"]["items"][0]["sku_id"] == 1


def test_match_all_yields_progress(monkeypatch):
    """每处理完一个货品 yield 一条进度 {current,total}"""
    import sourcing
    monkeypatch.setattr(sourcing, "match_sku_via_agent", lambda s, c: None)
    progress = list(sourcing._match_all(_products(), _candidates_map(), _sku_cache(), {}))
    assert progress[-1]["current"] == 2
    assert progress[-1]["total"] == 2


def test_match_all_none_match_not_stored(monkeypatch):
    """agent 返回 None(失败/无SKU) → 该 pid 不写入 matches(上游兜底)"""
    import sourcing
    monkeypatch.setattr(sourcing, "match_sku_via_agent", lambda s, c: None)
    matches = {}
    list(sourcing._match_all(_products(), _candidates_map(), _sku_cache(), matches))
    assert matches == {}
