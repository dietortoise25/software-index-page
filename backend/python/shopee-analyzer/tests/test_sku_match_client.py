"""
step4 调用 langchain-agent sku-match 端点的 HTTP client
运行: cd backend/python/shopee-analyzer && python -m pytest tests/test_sku_match_client.py -v
"""
import json


def test_match_sku_via_agent_success(monkeypatch):
    """agent 返回 {ok:true,data:{...}} → 提取 (data, None)"""
    import sku_match_client as m

    class FakeResp:
        def read(self): return json.dumps({
            "ok": True,
            "data": {"matched_item_id": "AAA", "matched_sku_id": 2, "confidence": 0.9, "reason": "贴合"},
        }).encode()
        def __enter__(self): return self
        def __exit__(self, *a): return False

    monkeypatch.setattr(m.urllib.request, "urlopen", lambda *a, **k: FakeResp())
    shopee = {"name": "裙", "category": "女装", "price_brl": 39.9}
    cands = [{"item_id": "AAA", "title": "x", "sku": {"items": [{"sku_id": 2, "full_spec": "红/L", "price": "10"}]}}]
    data, reason = m.match_sku_via_agent(shopee, cands)
    assert data["matched_item_id"] == "AAA"
    assert data["matched_sku_id"] == 2
    assert reason is None


def test_match_sku_via_agent_http_error_returns_none(monkeypatch):
    """agent 请求异常(网络/超时/500) → (None, 'llm_call_failed')"""
    import sku_match_client as m

    def boom(*a, **k): raise TimeoutError("agent down")
    monkeypatch.setattr(m.urllib.request, "urlopen", boom)
    data, reason = m.match_sku_via_agent({"name": "裙"}, [{"item_id": "A", "sku": {"items": [{"sku_id": 1, "price": "5"}]}}])
    assert data is None
    assert reason == "llm_call_failed"


def test_match_sku_via_agent_not_ok_returns_none(monkeypatch):
    """agent 返回 ok:false → (None, 'llm_call_failed')"""
    import sku_match_client as m

    class FakeResp:
        def read(self): return json.dumps({"ok": False, "error": "bad"}).encode()
        def __enter__(self): return self
        def __exit__(self, *a): return False

    monkeypatch.setattr(m.urllib.request, "urlopen", lambda *a, **k: FakeResp())
    data, reason = m.match_sku_via_agent({"name": "裙"}, [{"item_id": "A", "sku": {"items": [{"sku_id": 1, "price": "5"}]}}])
    assert data is None
    assert reason == "llm_call_failed"


def test_no_candidates_with_sku_skips_call(monkeypatch):
    """所有候选都无 SKU → 不调 agent，(None, 'no_sku_data')"""
    import sku_match_client as m
    called = {"n": 0}
    def spy(*a, **k):
        called["n"] += 1
        raise AssertionError("不该调")
    monkeypatch.setattr(m.urllib.request, "urlopen", spy)
    data, reason = m.match_sku_via_agent({"name": "裙"}, [{"item_id": "A", "sku": {"items": []}}])
    assert data is None
    assert reason == "no_sku_data"
    assert called["n"] == 0
