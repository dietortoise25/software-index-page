"""
services/sourcing_pipeline 编排层单测 —— 依赖注入 fake match_sku/provider。
SKU 匹配改用 clients.llm_client.match_sku：逐候选调一次、取 overall_score 最高、
单候选/单货品失败不阻塞批次。

运行: cd backend/python/shopee-analyzer && python -m pytest tests/test_sourcing_pipeline.py -v
"""
import pytest

from models.errors import PermanentError, RetryableError
from models.llm import SkuMatchResult, MatchScores


# ── 测试夹具 ──────────────────────────────────────────────

def _scores(o):
    return MatchScores(price=o, semantic_match=o, image_match=o, supply=o)


def _result(sku_id, overall):
    return SkuMatchResult(matched_sku_id=sku_id, confidence=0.9, reason="r",
                          scores=_scores(overall), overall_score=overall)


def _shopee():
    return {"name": "红裙", "category": "女装", "price_brl": 39.9}


def _cand(item_id, sku_id):
    return {"item_id": item_id, "title": f"候选{item_id}",
            "sku": {"items": [{"sku_id": sku_id, "full_spec": "红/M", "price": "10"}]}}


# ── ① 编排正确：取 overall_score 最高的候选 ───────────────

def test_match_best_picks_highest_overall_score():
    from services.sourcing_pipeline import match_best

    scores = {"AAA": 70, "BBB": 92, "CCC": 81}

    def fake_match_sku(client, shopee, candidate, **kw):
        oid = candidate["item_id"]
        return _result(candidate["sku"]["items"][0]["sku_id"], scores[oid]), "raw"

    cands = [_cand("AAA", 1), _cand("BBB", 2), _cand("CCC", 3)]
    best, fail_reason, candidate_scores = match_best(
        None, _shopee(), cands, api_key="k", base_url="u", model="m",
        match_sku_fn=fake_match_sku)

    assert fail_reason is None
    assert best["matched_item_id"] == "BBB"
    assert best["overall_score"] == 92
    assert best["matched_sku_id"] == 2
    # 每个候选评分均保留(供候选明细展示)
    assert candidate_scores["AAA"]["overall_score"] == 70
    assert candidate_scores["BBB"]["overall_score"] == 92
    assert candidate_scores["CCC"]["overall_score"] == 81


def test_match_best_data_fields_align_for_build_row():
    """best data 字段对齐 _build_row 所需：matched_item_id/matched_sku_id/overall_score/scores/reason"""
    from services.sourcing_pipeline import match_best

    def fake(client, shopee, candidate, **kw):
        return _result(candidate["sku"]["items"][0]["sku_id"], 88), "raw"

    best, _, _ = match_best(None, _shopee(), [_cand("AAA", 7)],
                            api_key="k", base_url="u", model="m", match_sku_fn=fake)
    assert best["matched_item_id"] == "AAA"
    assert best["matched_sku_id"] == 7
    assert best["overall_score"] == 88
    assert best["reason"] == "r"
    assert best["scores"]["price"] == 88


# ── ② 单候选 match_sku 抛 PermanentError → 跳过、不阻塞其他候选 ──

def test_single_candidate_permanent_error_is_skipped():
    from services.sourcing_pipeline import match_best

    def fake(client, shopee, candidate, **kw):
        if candidate["item_id"] == "BAD":
            raise PermanentError("400 bad", code="HTTP_400", status=400)
        return _result(candidate["sku"]["items"][0]["sku_id"], 77), "raw"

    cands = [_cand("BAD", 1), _cand("GOOD", 2)]
    best, fail_reason, candidate_scores = match_best(
        None, _shopee(), cands, api_key="k", base_url="u", model="m", match_sku_fn=fake)

    # BAD 被跳过、GOOD 仍被选中
    assert fail_reason is None
    assert best["matched_item_id"] == "GOOD"
    assert "BAD" not in candidate_scores
    assert candidate_scores["GOOD"]["overall_score"] == 77


def test_single_candidate_retryable_exhausted_is_skipped():
    """RetryableError 耗尽抛出同样被 catch 跳过(不阻塞批次)"""
    from services.sourcing_pipeline import match_best

    def fake(client, shopee, candidate, **kw):
        if candidate["item_id"] == "FLAKY":
            raise RetryableError("timeout", code="NETWORK")
        return _result(candidate["sku"]["items"][0]["sku_id"], 60), "raw"

    cands = [_cand("FLAKY", 1), _cand("OK", 2)]
    best, fail_reason, candidate_scores = match_best(
        None, _shopee(), cands, api_key="k", base_url="u", model="m", match_sku_fn=fake)
    assert best["matched_item_id"] == "OK"
    assert "FLAKY" not in candidate_scores


def test_candidate_without_sku_is_skipped():
    """无 SKU 候选不调 match_sku(对齐旧 match_sku_best)"""
    from services.sourcing_pipeline import match_best
    seen = []

    def fake(client, shopee, candidate, **kw):
        seen.append(candidate["item_id"])
        return _result(candidate["sku"]["items"][0]["sku_id"], 50), "raw"

    cands = [{"item_id": "NOSKU", "sku": {"items": []}}, _cand("HASSKU", 2)]
    best, _, candidate_scores = match_best(
        None, _shopee(), cands, api_key="k", base_url="u", model="m", match_sku_fn=fake)
    assert seen == ["HASSKU"]
    assert best["matched_item_id"] == "HASSKU"
    assert "NOSKU" not in candidate_scores


# ── ③ 某货品全部候选失败 → 该货品标 fail_reason，不影响其他货品 ──

def test_all_candidates_fail_marks_llm_failed():
    from services.sourcing_pipeline import match_best

    def fake(client, shopee, candidate, **kw):
        raise PermanentError("400", code="HTTP_400", status=400)

    best, fail_reason, candidate_scores = match_best(
        None, _shopee(), [_cand("A", 1), _cand("B", 2)],
        api_key="k", base_url="u", model="m", match_sku_fn=fake)
    assert best is None
    assert fail_reason == "llm_call_failed"
    assert candidate_scores == {}


# ── match_all：逐货品编排、按 pid 收集、yield 进度、失败隔离 ──

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


def test_match_all_collects_matches_per_product():
    from services.sourcing_pipeline import match_all

    def fake(client, shopee, candidate, **kw):
        sid = candidate["sku"]["items"][0]["sku_id"]
        return _result(sid, 88 if sid == 1 else 75), "raw"

    matches = {}
    list(match_all(_products(), _candidates_map(), _sku_cache(), matches,
                   client=None, api_key="k", base_url="u", model="m", match_sku_fn=fake))
    assert matches["P1"]["data"]["matched_sku_id"] == 1
    assert matches["P2"]["data"]["matched_sku_id"] == 2
    assert matches["P1"]["candidate_scores"]["AAA"]["overall_score"] == 88
    assert matches["P2"]["candidate_scores"]["BBB"]["overall_score"] == 75


def test_match_all_yields_progress():
    from services.sourcing_pipeline import match_all

    def fake(client, shopee, candidate, **kw):
        return _result(candidate["sku"]["items"][0]["sku_id"], 50), "raw"

    progress = list(match_all(_products(), _candidates_map(), _sku_cache(), {},
                              client=None, api_key="k", base_url="u", model="m", match_sku_fn=fake))
    assert progress[-1]["current"] == 2
    assert progress[-1]["total"] == 2


def test_match_all_no_qualified_when_no_candidates():
    from services.sourcing_pipeline import match_all
    matches = {}
    products = [{"product_id": "P9", "product_name": "x", "category_path": "", "shopee_price_brl": ""}]
    list(match_all(products, {"P9": []}, {}, matches,
                   client=None, api_key="k", base_url="u", model="m",
                   match_sku_fn=lambda *a, **k: (_result(1, 1), "r")))
    assert matches["P9"]["fail_reason"] == "no_qualified_candidate"
    assert matches["P9"]["data"] is None


def test_match_all_one_product_all_fail_does_not_block_others():
    """P1 全部候选失败 → 标 fail_reason；P2 不受影响、正常匹配"""
    from services.sourcing_pipeline import match_all

    def fake(client, shopee, candidate, **kw):
        if candidate["item_id"] == "AAA":
            raise PermanentError("400", code="HTTP_400", status=400)
        return _result(candidate["sku"]["items"][0]["sku_id"], 75), "raw"

    matches = {}
    list(match_all(_products(), _candidates_map(), _sku_cache(), matches,
                   client=None, api_key="k", base_url="u", model="m", match_sku_fn=fake))
    assert matches["P1"]["data"] is None
    assert matches["P1"]["fail_reason"] == "llm_call_failed"
    # P2 不受 P1 失败影响
    assert matches["P2"]["data"]["matched_sku_id"] == 2
    assert matches["P2"]["candidate_scores"]["BBB"]["overall_score"] == 75
