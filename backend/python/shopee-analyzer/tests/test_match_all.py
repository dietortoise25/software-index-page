"""
_match_all 编排 —— 对每个货品调本地 LLM 选 SKU，收集 pid → match，逐个 yield 进度。
SKU 匹配后端已从 sku_match_client.match_sku_best 换成 sourcing_pipeline.match_best
(改调 clients.llm_client.match_sku)；本测试 patch pipeline.match_best 注入可控结果，
与旧实现行为等价(逐货品收集 data/fail_reason/candidate_scores)。
运行: cd backend/python/shopee-analyzer && python -m pytest tests/test_match_all.py -v
"""
import services.sourcing_pipeline as pipeline


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
    """对每个货品调匹配后端，按 pid 收集 match 结果 + 候选评分"""
    import sourcing

    def fake_match(client, shopee, candidates, **kw):
        if shopee["name"] == "红裙":
            d = {"matched_item_id": "AAA", "matched_sku_id": 1, "confidence": 0.9, "reason": "r", "overall_score": 88}
            return (d, None, {"AAA": d})
        d = {"matched_item_id": "BBB", "matched_sku_id": 2, "confidence": 0.8, "reason": "b", "overall_score": 75}
        return (d, None, {"BBB": d})

    monkeypatch.setattr(pipeline, "match_best", fake_match)
    matches = {}
    list(sourcing._match_all(_products(), _candidates_map(), _sku_cache(), matches))

    assert matches["P1"]["data"]["matched_sku_id"] == 1
    assert matches["P2"]["data"]["matched_sku_id"] == 2
    # 候选评分按 item_id 保留，供候选明细逐个展示
    assert matches["P1"]["candidate_scores"]["AAA"]["overall_score"] == 88
    assert matches["P2"]["candidate_scores"]["BBB"]["overall_score"] == 75


def test_match_all_passes_lean_shopee_and_candidates(monkeypatch):
    """喂给匹配后端的 shopee 含 name/category/price，候选含 item_id + sku.items"""
    import sourcing
    seen = {}

    def capture(client, shopee, candidates, **kw):
        seen["shopee"] = shopee
        seen["candidates"] = candidates
        return (None, "llm_call_failed", {})

    monkeypatch.setattr(pipeline, "match_best", capture)
    list(sourcing._match_all(_products()[:1], _candidates_map(), _sku_cache(), {}))

    assert seen["shopee"]["name"] == "红裙"
    assert seen["shopee"]["category"] == "女装"
    assert seen["shopee"]["price_brl"] == 39.90
    assert seen["candidates"][0]["item_id"] == "AAA"
    assert seen["candidates"][0]["sku"]["items"][0]["sku_id"] == 1


def test_match_all_yields_progress(monkeypatch):
    """每处理完一个货品 yield 一条进度 {current,total}"""
    import sourcing
    monkeypatch.setattr(pipeline, "match_best", lambda c, s, cands, **kw: (None, "llm_call_failed", {}))
    progress = list(sourcing._match_all(_products(), _candidates_map(), _sku_cache(), {}))
    assert progress[-1]["current"] == 2
    assert progress[-1]["total"] == 2


def test_match_all_stores_fail_reason(monkeypatch):
    """匹配后端返回 (None, reason, {}) → matches[pid] 记录 fail_reason"""
    import sourcing
    monkeypatch.setattr(pipeline, "match_best", lambda c, s, cands, **kw: (None, "llm_call_failed", {}))
    matches = {}
    list(sourcing._match_all(_products(), _candidates_map(), _sku_cache(), matches))
    assert matches["P1"]["fail_reason"] == "llm_call_failed"
    assert matches["P1"]["data"] is None
