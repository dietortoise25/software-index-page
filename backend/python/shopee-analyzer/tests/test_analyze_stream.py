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
         patch("sourcing.match_sku_best", return_value=(None, "llm_call_failed", {})):
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
