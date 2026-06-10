"""
analyze-stream SSE 流改造测试 —— 后端化后不再挂起等扩展
运行: cd backend/python/shopee-analyzer && python -m pytest tests/test_analyze_stream.py -v
"""
import io
import pytest
from unittest.mock import patch


def _make_xlsx():
    import openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["产品ID", "产品名称", "产品主图", "价格", "类目路径", "月销量"])
    ws.append(["P1", "测试商品", "http://img/1.jpg", "R$ 19.90", "类目/A", "100"])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def _parse_sse(text):
    """解析 SSE 文本为 [(event, data_str)]"""
    events = []
    for block in text.split("\n\n"):
        ev, data = None, None
        for line in block.split("\n"):
            if line.startswith("event: "):
                ev = line[7:]
            elif line.startswith("data: "):
                data = line[6:]
        if ev:
            events.append((ev, data))
    return events


class _FakeProvider:
    name = "fake"
    ready = True

    def fetch_sku(self, item_id):
        return {"sku_count": 2, "min_price": "5.00", "max_price": "9.00",
                "min_price_spec": "红", "skus": [{"spec": "红", "price": "5.00"}], "error": None}


def _run_stream():
    from fastapi.testclient import TestClient
    from main import app
    client = TestClient(app)
    fake_offer = {"itemId": "A1", "title": "候选", "itemPrice": "7.40", "link": "",
                  "sales": "", "offerTags": ["高度同款"], "purchaseInfos": [{"value": "2件起批"}],
                  "providerInfo": {"companyName": "厂A"}}
    with patch("sourcing.search_by_image", return_value=([fake_offer], 1)), \
         patch("sourcing.get_provider", return_value=_FakeProvider()), \
         patch("services.sourcing_pipeline.match_best", return_value=(None, "llm_call_failed", {})):
        resp = client.post(
            "/api/sourcing/analyze-stream",
            files={"files": ("shop.xlsx", _make_xlsx(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
    assert resp.status_code == 200
    return _parse_sse(resp.text)


def test_stream_no_awaiting_sku_event():
    """改造后不再 emit awaiting_sku（不再依赖扩展回传）"""
    event_names = [e for e, _ in _run_stream()]
    assert "awaiting_sku" not in event_names


def test_stream_emits_fetching_sku_phase():
    """改造后有 fetching_sku 进度 phase（后端取 SKU 时暴露状态）"""
    events = _run_stream()
    phases = [d for e, d in events if e == "phase"]
    assert any("fetching_sku" in (d or "") for d in phases)


def test_stream_emits_sku_progress_per_offer():
    """SKU 阶段逐 offer 推 sku_progress 帧（带 current/total），前端进度条不再卡死"""
    import json
    events = _run_stream()
    sku_progs = [json.loads(d) for e, d in events if e == "sku_progress"]
    assert len(sku_progs) >= 1, "未推送任何 sku_progress 帧"
    assert sku_progs[-1]["current"] == sku_progs[-1]["total"]  # 最后一帧到达总数
    assert all("current" in p and "total" in p for p in sku_progs)
    # sku_progress 应在 fetching_sku phase 之后、complete 之前
    names = [e for e, _ in events]
    assert names.index("sku_progress") < names.index("complete")


def test_stream_emits_matching_sku_phase():
    """step4 接入：SKU 拉完后有 matching_sku phase + match_progress 帧，complete 之前"""
    import json
    events = _run_stream()
    names = [e for e, _ in events]
    phases = [d for e, d in events if e == "phase"]
    assert any("matching_sku" in (d or "") for d in phases)
    match_progs = [json.loads(d) for e, d in events if e == "match_progress"]
    assert len(match_progs) >= 1
    assert match_progs[-1]["current"] == match_progs[-1]["total"]
    # 顺序：fetching_sku → matching_sku → complete
    assert names.index("match_progress") < names.index("complete")


def test_stream_ends_with_complete():
    """流仍以 complete 收尾，含 rows + summary"""
    events = _run_stream()
    assert events[-1][0] == "complete"
    import json
    payload = json.loads(events[-1][1])
    assert "rows" in payload and "summary" in payload
    # SKU 价格表经 provider 注入
    assert payload["rows"][0]["candidates"][0]["sku"]["count"] == 2


# ===== SKU 匹配阶段 LLM 逐字透传：llm_token / candidate_scored / llm_retry =====

def _result_obj(sku_id, overall):
    from models.llm import SkuMatchResult, MatchScores
    return SkuMatchResult(matched_sku_id=sku_id, confidence=0.9, reason="r",
                          scores=MatchScores(price=overall, semantic_match=overall,
                                             image_match=overall, supply=overall),
                          overall_score=overall)


def _run_stream_with_match(fake_match_sku):
    """真实跑 pipeline.match_all/match_best/match_one，仅替换最底层 match_sku。
    fake_match_sku(client, shopee, candidate, *, api_key, base_url, model, on_token, **kw)
    需在内部主动调 on_token 吐 token，并返回 (SkuMatchResult, raw)。"""
    from fastapi.testclient import TestClient
    from main import app
    client = TestClient(app)
    fake_offer = {"itemId": "A1", "title": "候选", "itemPrice": "7.40", "link": "",
                  "sales": "", "offerTags": ["高度同款"], "purchaseInfos": [{"value": "2件起批"}],
                  "providerInfo": {"companyName": "厂A"}}
    with patch("sourcing.search_by_image", return_value=([fake_offer], 1)), \
         patch("sourcing.get_provider", return_value=_FakeProvider()), \
         patch("clients.llm_client.match_sku", fake_match_sku):
        resp = client.post(
            "/api/sourcing/analyze-stream",
            files={"files": ("shop.xlsx", _make_xlsx(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
    assert resp.status_code == 200
    return _parse_sse(resp.text)


def test_stream_emits_llm_token_frames():
    """SKU 匹配阶段把 match_sku 的 on_token 逐字透传成 llm_token 帧，带 item_id + phase。"""
    import json

    def fake(client, shopee, candidate, *, api_key, base_url, model, on_token=None, **kw):
        for tok in ["{\"matched_sku_id\"", ":", "\"S1\"}"]:
            if on_token:
                on_token(tok)
        return _result_obj("S1", 80), "raw"

    events = _run_stream_with_match(fake)
    toks = [json.loads(d) for e, d in events if e == "llm_token"]
    assert len(toks) >= 1, "未推送任何 llm_token 帧"
    assert all(t.get("phase") == "sku_match" for t in toks)
    assert all(t.get("item_id") == "A1" for t in toks)
    assert "".join(t["token"] for t in toks) == "{\"matched_sku_id\":\"S1\"}"
    # llm_token 出现在 complete 之前
    names = [e for e, _ in events]
    assert names.index("llm_token") < names.index("complete")


def test_stream_emits_candidate_scored():
    """候选评分完成时发 candidate_scored，含 item_id + match_overall_score。"""
    import json

    def fake(client, shopee, candidate, *, api_key, base_url, model, on_token=None, **kw):
        if on_token:
            on_token("x")
        return _result_obj("S1", 73), "raw"

    events = _run_stream_with_match(fake)
    scored = [json.loads(d) for e, d in events if e == "candidate_scored"]
    assert len(scored) >= 1, "未推送任何 candidate_scored 帧"
    assert scored[0]["item_id"] == "A1"
    assert scored[0]["match_overall_score"] == 73
    names = [e for e, _ in events]
    assert names.index("candidate_scored") < names.index("complete")


def test_stream_emits_llm_retry_on_stream_interrupt():
    """流中断重试时发 llm_retry(带 item_id)，通知前端清空该 item 已显示 token。"""
    import json
    import httpx

    state = {"calls": 0}
    # 用真实 match_sku：第一次流给坏 JSON(触发 RetryableError 重试)，第二次给好 JSON

    def handler(req):
        state["calls"] += 1
        if state["calls"] == 1:
            body = 'data: {"choices":[{"delta":{"content":"坏"}}]}\n\ndata: [DONE]\n\n'
        else:
            body = ('data: {"choices":[{"delta":{"content":"{\\"matched_sku_id\\":\\"S1\\",'
                    '\\"confidence\\":0.9,\\"reason\\":\\"r\\",'
                    '\\"scores\\":{\\"price\\":80,\\"semantic_match\\":80,\\"image_match\\":80,\\"supply\\":80},'
                    '\\"overall_score\\":80}"}}]}\n\ndata: [DONE]\n\n')
        return httpx.Response(200, content=body.encode("utf-8"),
                              headers={"content-type": "text/event-stream"})

    from fastapi.testclient import TestClient
    from main import app
    import clients.http as _http
    tc = TestClient(app)
    fake_offer = {"itemId": "A1", "title": "候选", "itemPrice": "7.40", "link": "",
                  "sales": "", "offerTags": [], "purchaseInfos": [], "providerInfo": {}}
    mock_client = httpx.Client(transport=httpx.MockTransport(handler))
    with patch("sourcing.search_by_image", return_value=([fake_offer], 1)), \
         patch("sourcing.get_provider", return_value=_FakeProvider()), \
         patch.object(_http, "make_client", return_value=mock_client), \
         patch("sourcing.make_client", return_value=mock_client):
        resp = tc.post(
            "/api/sourcing/analyze-stream",
            files={"files": ("shop.xlsx", _make_xlsx(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
    assert resp.status_code == 200
    events = _parse_sse(resp.text)
    retries = [json.loads(d) for e, d in events if e == "llm_retry"]
    assert len(retries) >= 1, "重试时未推送 llm_retry 帧"
    assert retries[0]["item_id"] == "A1"
