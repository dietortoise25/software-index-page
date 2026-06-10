"""
GPT 图文核对 — 对 (Shopee 商品图, 1688 候选图 + 标题) 调多模态模型，
返回"同款可能性"置信度 0~1。复用 SKU_MATCH_* 渠道(gpt-5.5 支持 vision)。
失败/无图 → None(未评分，上游不惩罚)。

改造后通过 clients.llm_client.stream_chat 走 httpx 流式调用，测试以
httpx.MockTransport 喂 SSE 流。

运行: cd backend/python/shopee-analyzer && python -m pytest tests/test_image_verify.py -v
"""
import json

import httpx


def _sse(text):
    """把一段完整文本作为单个 SSE delta 喂出，再补 [DONE]。"""
    return (f'data: {{"choices":[{{"delta":{{"content":{json.dumps(text)}}}}}]}}\n\n'
            "data: [DONE]\n\n").encode()


def _mock_client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler))


# ---- 纯函数：解析 / 构造 messages（与传输无关，保持原意） ----

def test_parse_confidence_plain_json():
    """模型返回纯 JSON → 抠出 confidence"""
    import image_verify as v
    content = '{"confidence": 0.82, "reason": "同款连衣裙"}'
    assert v._parse_confidence(content) == 0.82


def test_parse_confidence_with_code_fence():
    """模型用 ```json 围栏包裹 → 仍能解析"""
    import image_verify as v
    content = '```json\n{"confidence": 0.3}\n```'
    assert v._parse_confidence(content) == 0.3


def test_parse_confidence_clamps_range():
    """越界值裁剪到 [0,1]"""
    import image_verify as v
    assert v._parse_confidence('{"confidence": 1.5}') == 1.0
    assert v._parse_confidence('{"confidence": -0.2}') == 0.0


def test_parse_confidence_garbage_returns_none():
    """无法解析 → None"""
    import image_verify as v
    assert v._parse_confidence("我觉得挺像的") is None
    assert v._parse_confidence("") is None


def test_build_messages_includes_both_images_and_title():
    """messages 用户内容含两张图 url + 候选标题文本"""
    import image_verify as v
    msgs = v._build_messages("http://shopee/a.jpg", "http://1688/b.jpg", "夏季连衣裙")
    content = msgs[-1]["content"]
    urls = [p["image_url"]["url"] for p in content if p["type"] == "image_url"]
    texts = " ".join(p["text"] for p in content if p["type"] == "text")
    assert "http://shopee/a.jpg" in urls
    assert "http://1688/b.jpg" in urls
    assert "夏季连衣裙" in texts


# ---- verify_one：走 httpx 流式 + MockTransport 注入 ----

def test_verify_one_success(monkeypatch):
    """模型流式返回 {"confidence": ...} JSON 文本 → 返回 0~1 浮点"""
    import image_verify as v
    monkeypatch.setattr(v, "_API_KEY", "sk-test")

    def handler(req):
        return httpx.Response(200, content=_sse('{"confidence": 0.77, "reason": "同款"}'),
                              headers={"content-type": "text/event-stream"})

    client = _mock_client(handler)
    assert v.verify_one("http://s/a.jpg", "http://c/b.jpg", "裙", client=client) == 0.77


def test_verify_one_unparseable_returns_none(monkeypatch):
    """模型返回无法解析(无 JSON) → None"""
    import image_verify as v
    monkeypatch.setattr(v, "_API_KEY", "sk-test")

    def handler(req):
        return httpx.Response(200, content=_sse("我觉得挺像的"),
                              headers={"content-type": "text/event-stream"})

    client = _mock_client(handler)
    assert v.verify_one("http://s/a.jpg", "http://c/b.jpg", "裙", client=client) is None


def test_verify_one_no_api_key_returns_none(monkeypatch):
    """未配置 key → None(不调用)"""
    import image_verify as v
    monkeypatch.setattr(v, "_API_KEY", "")

    def handler(req):  # 不应被触达
        raise AssertionError("不应发起请求")

    client = _mock_client(handler)
    assert v.verify_one("http://s/a.jpg", "http://c/b.jpg", "裙", client=client) is None


def test_verify_one_missing_image_returns_none(monkeypatch):
    """缺图(任一为空) → None，不发请求"""
    import image_verify as v
    monkeypatch.setattr(v, "_API_KEY", "sk-test")
    called = {"n": 0}

    def handler(req):
        called["n"] += 1
        return httpx.Response(200, content=_sse('{"confidence": 0.5}'),
                              headers={"content-type": "text/event-stream"})

    client = _mock_client(handler)
    assert v.verify_one("", "http://c/b.jpg", "裙", client=client) is None
    assert v.verify_one("http://s/a.jpg", "", "裙", client=client) is None
    assert called["n"] == 0


def test_verify_one_http_error_returns_none(monkeypatch):
    """请求异常(4xx/网络) → None(不抛，保持失败不阻塞)"""
    import image_verify as v
    monkeypatch.setattr(v, "_API_KEY", "sk-test")

    def handler(req):
        return httpx.Response(500, content=b"boom",
                              headers={"content-type": "text/plain"})

    client = _mock_client(handler)
    assert v.verify_one("http://s/a.jpg", "http://c/b.jpg", "裙", client=client) is None


# ---- verify_candidates：批量并发，透传 client ----

def test_verify_candidates_maps_item_ids(monkeypatch):
    """批量打分 → {item_id: confidence|None}，缺 item_id 的被跳过"""
    import image_verify as v
    monkeypatch.setattr(v, "_API_KEY", "sk-test")

    def handler(req):
        return httpx.Response(200, content=_sse('{"confidence": 0.6}'),
                              headers={"content-type": "text/event-stream"})

    client = _mock_client(handler)
    cands = [
        {"item_id": "a", "image_url": "http://c/a.jpg", "title": "甲"},
        {"item_id": "b", "image_url": "http://c/b.jpg", "title": "乙"},
        {"item_id": "", "image_url": "http://c/x.jpg", "title": "无id"},
    ]
    out = v.verify_candidates("http://s/main.jpg", cands, client=client)
    assert out == {"a": 0.6, "b": 0.6}


def test_verify_candidates_no_key_returns_empty(monkeypatch):
    """未配 key → 空 dict(不阻塞整批)"""
    import image_verify as v
    monkeypatch.setattr(v, "_API_KEY", "")
    out = v.verify_candidates("http://s/main.jpg",
                              [{"item_id": "a", "image_url": "http://c/a.jpg"}])
    assert out == {}


def test_verify_candidates_default_client_signature():
    """client 有默认值：旧调用点 verify_candidates(img, cands) 仍合法"""
    import inspect

    import image_verify as v
    sig = inspect.signature(v.verify_candidates)
    assert sig.parameters["client"].default is None
