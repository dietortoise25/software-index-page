"""
step4 调用 langchain-agent sku-match 端点的 HTTP client（单候选设计）
运行: cd backend/python/shopee-analyzer && python -m pytest tests/test_sku_match_client.py -v
"""
import json


def _resp(payload):
    class FakeResp:
        def read(self): return json.dumps(payload).encode()
        def __enter__(self): return self
        def __exit__(self, *a): return False
    return FakeResp()


def test_match_sku_for_candidate_success(monkeypatch):
    """agent 返回 {ok:true,data:{...}} → 提取 (data, None)"""
    import sku_match_client as m
    monkeypatch.setattr(m.urllib.request, "urlopen", lambda *a, **k: _resp({
        "ok": True,
        "data": {"matched_sku_id": 2, "confidence": 0.9, "reason": "贴合", "overall_score": 88},
    }))
    shopee = {"name": "裙", "category": "女装", "price_brl": 39.9}
    cand = {"item_id": "AAA", "title": "x", "sku": {"items": [{"sku_id": 2, "full_spec": "红/L", "price": "10"}]}}
    data, reason = m.match_sku_for_candidate(shopee, cand)
    assert data["matched_sku_id"] == 2
    assert data["overall_score"] == 88
    assert reason is None


def test_match_sku_for_candidate_http_error_returns_none(monkeypatch):
    """agent 请求异常(网络/超时/500) → (None, 'llm_call_failed')"""
    import sku_match_client as m

    def boom(*a, **k): raise TimeoutError("agent down")
    monkeypatch.setattr(m.urllib.request, "urlopen", boom)
    cand = {"item_id": "A", "sku": {"items": [{"sku_id": 1, "price": "5"}]}}
    data, reason = m.match_sku_for_candidate({"name": "裙"}, cand)
    assert data is None
    assert reason == "llm_call_failed"


def test_match_sku_for_candidate_not_ok_returns_none(monkeypatch):
    """agent 返回 ok:false → (None, 'llm_call_failed')"""
    import sku_match_client as m
    monkeypatch.setattr(m.urllib.request, "urlopen", lambda *a, **k: _resp({"ok": False, "error": "bad"}))
    cand = {"item_id": "A", "sku": {"items": [{"sku_id": 1, "price": "5"}]}}
    data, reason = m.match_sku_for_candidate({"name": "裙"}, cand)
    assert data is None
    assert reason == "llm_call_failed"


def test_candidate_without_sku_skips_call(monkeypatch):
    """候选无 SKU → 不调 agent，(None, 'no_sku_data')"""
    import sku_match_client as m
    called = {"n": 0}

    def spy(*a, **k):
        called["n"] += 1
        raise AssertionError("不该调")
    monkeypatch.setattr(m.urllib.request, "urlopen", spy)
    data, reason = m.match_sku_for_candidate({"name": "裙"}, {"item_id": "A", "sku": {"items": []}})
    assert data is None
    assert reason == "no_sku_data"
    assert called["n"] == 0


def test_match_sku_best_picks_highest_overall_score(monkeypatch):
    """逐候选串行调，取 overall_score 最高者，并回填 matched_item_id。
    第三返回值 candidate_scores 含每个候选的完整评分(供候选明细展示)。"""
    import sku_match_client as m

    def fake_one(shopee, cand):
        scores = {"AAA": 70, "BBB": 92, "CCC": 81}
        return ({"matched_sku_id": 1, "overall_score": scores[cand["item_id"]]}, None)
    monkeypatch.setattr(m, "match_sku_for_candidate", fake_one)
    cands = [
        {"item_id": "AAA", "sku": {"items": [{"sku_id": 1, "price": "5"}]}},
        {"item_id": "BBB", "sku": {"items": [{"sku_id": 1, "price": "6"}]}},
        {"item_id": "CCC", "sku": {"items": [{"sku_id": 1, "price": "7"}]}},
    ]
    best, reason, per_cand = m.match_sku_best({"name": "裙"}, cands)
    assert best["matched_item_id"] == "BBB"
    assert best["overall_score"] == 92
    assert reason is None
    # 每个候选的分都保留下来(不再只留冠军)
    assert per_cand["AAA"]["overall_score"] == 70
    assert per_cand["BBB"]["overall_score"] == 92
    assert per_cand["CCC"]["overall_score"] == 81


def test_match_sku_best_all_fail_returns_llm_call_failed(monkeypatch):
    """所有候选都调失败 → (None, 'llm_call_failed', {})"""
    import sku_match_client as m
    monkeypatch.setattr(m, "match_sku_for_candidate", lambda s, c: (None, "llm_call_failed"))
    cands = [{"item_id": "A", "sku": {"items": [{"sku_id": 1, "price": "5"}]}}]
    best, reason, per_cand = m.match_sku_best({"name": "裙"}, cands)
    assert best is None
    assert reason == "llm_call_failed"
    assert per_cand == {}


def test_match_sku_best_skips_candidates_without_sku(monkeypatch):
    """无 SKU 候选被跳过，不调 agent"""
    import sku_match_client as m
    seen = []

    def spy(shopee, cand):
        seen.append(cand["item_id"])
        return ({"matched_sku_id": 1, "overall_score": 80}, None)
    monkeypatch.setattr(m, "match_sku_for_candidate", spy)
    cands = [
        {"item_id": "NOSKU", "sku": {"items": []}},
        {"item_id": "OK", "sku": {"items": [{"sku_id": 1, "price": "5"}]}},
    ]
    best, _, per_cand = m.match_sku_best({"name": "裙"}, cands)
    assert seen == ["OK"]
    assert best["matched_item_id"] == "OK"
    assert "NOSKU" not in per_cand and per_cand["OK"]["overall_score"] == 80
