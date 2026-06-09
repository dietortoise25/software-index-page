"""
GPT 图文核对 — 对 (Shopee 商品图, 1688 候选图 + 标题) 调多模态模型，
返回"同款可能性"置信度 0~1。复用 SKU_MATCH_* 渠道(gpt-5.5 支持 vision)。
失败/无图 → None(未评分，上游不惩罚)。

运行: cd backend/python/shopee-analyzer && python -m pytest tests/test_image_verify.py -v
"""
import json


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


def test_verify_one_success(monkeypatch):
    """正常调用 → 返回 confidence 浮点"""
    import image_verify as v

    class FakeResp:
        def read(self): return json.dumps({
            "choices": [{"message": {"content": '{"confidence": 0.77}'}}]
        }).encode()
        def __enter__(self): return self
        def __exit__(self, *a): return False

    monkeypatch.setattr(v, "_API_KEY", "sk-test")
    monkeypatch.setattr(v.urllib.request, "urlopen", lambda *a, **k: FakeResp())
    assert v.verify_one("http://s/a.jpg", "http://c/b.jpg", "裙") == 0.77


def test_verify_one_no_api_key_returns_none(monkeypatch):
    """未配置 key → None(不调用)"""
    import image_verify as v
    monkeypatch.setattr(v, "_API_KEY", "")
    assert v.verify_one("http://s/a.jpg", "http://c/b.jpg", "裙") is None


def test_verify_one_missing_image_returns_none(monkeypatch):
    """缺图(任一为空) → None，不调用"""
    import image_verify as v
    monkeypatch.setattr(v, "_API_KEY", "sk-test")
    called = {"n": 0}
    monkeypatch.setattr(v.urllib.request, "urlopen",
                        lambda *a, **k: called.__setitem__("n", called["n"] + 1))
    assert v.verify_one("", "http://c/b.jpg", "裙") is None
    assert v.verify_one("http://s/a.jpg", "", "裙") is None
    assert called["n"] == 0


def test_verify_one_http_error_returns_none(monkeypatch):
    """请求异常 → None(不抛)"""
    import image_verify as v
    monkeypatch.setattr(v, "_API_KEY", "sk-test")
    def boom(*a, **k): raise TimeoutError("vision down")
    monkeypatch.setattr(v.urllib.request, "urlopen", boom)
    assert v.verify_one("http://s/a.jpg", "http://c/b.jpg", "裙") is None
