"""
step4 调用 langchain-agent sku-match 端点的 HTTP client
运行: cd backend/python/shopee-analyzer && python -m pytest tests/test_sku_match_client.py -v

shopee-analyzer(Python 8000)同机调 langchain-agent(Node 8001)的
POST /api/agent/sku-match。失败/超时返回 None → 上游兜底最低价 SKU，不阻塞。
"""
import json


def test_match_sku_via_agent_success(monkeypatch):
    """agent 返回 {ok:true,data:{...}} → 提取 data 作为 match"""
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
    result = m.match_sku_via_agent(shopee, cands)
    assert result["matched_item_id"] == "AAA"
    assert result["matched_sku_id"] == 2


def test_match_sku_via_agent_http_error_returns_none(monkeypatch):
    """agent 请求异常(网络/超时/500) → 返回 None，不抛(上游兜底)"""
    import sku_match_client as m

    def boom(*a, **k): raise TimeoutError("agent down")
    monkeypatch.setattr(m.urllib.request, "urlopen", boom)
    result = m.match_sku_via_agent({"name": "裙"}, [{"item_id": "A", "sku": {"items": [{"sku_id": 1, "price": "5"}]}}])
    assert result is None


def test_match_sku_via_agent_not_ok_returns_none(monkeypatch):
    """agent 返回 ok:false → None"""
    import sku_match_client as m

    class FakeResp:
        def read(self): return json.dumps({"ok": False, "error": "bad"}).encode()
        def __enter__(self): return self
        def __exit__(self, *a): return False

    monkeypatch.setattr(m.urllib.request, "urlopen", lambda *a, **k: FakeResp())
    result = m.match_sku_via_agent({"name": "裙"}, [{"item_id": "A", "sku": {"items": [{"sku_id": 1, "price": "5"}]}}])
    assert result is None


def test_no_candidates_with_sku_skips_call(monkeypatch):
    """所有候选都无 SKU → 不调 agent，直接 None(省一次调用)"""
    import sku_match_client as m
    called = {"n": 0}
    def spy(*a, **k):
        called["n"] += 1
        raise AssertionError("不该调")
    monkeypatch.setattr(m.urllib.request, "urlopen", spy)
    result = m.match_sku_via_agent({"name": "裙"}, [{"item_id": "A", "sku": {"items": []}}])
    assert result is None
    assert called["n"] == 0
