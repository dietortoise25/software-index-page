"""aibuy_client 迁移到 httpx + 错误分类的测试。

覆盖:
- mtop JSON 调用经 request_json 正常解析 (200)
- 5xx 经 tenacity 重试后耗尽抛 RetryableError
- 400 抛 PermanentError 不重试
- token 失效 → 刷新 token → 重发一次 (业务级重试保留)
"""
import httpx
import pytest

import aibuy_client
from clients.http import make_retry
from models.errors import RetryableError, PermanentError


@pytest.fixture(autouse=True)
def _reset_state():
    """每个用例前注入假凭证并复位全局 token 状态。"""
    aibuy_client.configure({
        "app_key": "TESTKEY",
        "customer_id": "tester",
        "biz_type": "ERP",
        "language": "zh",
        "currency": "CNY",
        "platform": "1688",
    })
    aibuy_client._cs = "cookie=1"
    aibuy_client._tk = "faketoken"
    # 不重试退避,避免空等
    aibuy_client._retry_factory = lambda: make_retry(attempts=3, max_wait=0)
    yield
    aibuy_client._client = None
    aibuy_client._retry_factory = None


def _inject(handler):
    aibuy_client._client = httpx.Client(transport=httpx.MockTransport(handler))


def test_mtop_get_parses_200():
    _inject(lambda req: httpx.Response(200, json={"data": {"ok": 1}}))
    out = aibuy_client._mtop_get("some.api/1.0/", {"k": "v"})
    assert out == {"data": {"ok": 1}}


def test_mtop_post_parses_200():
    _inject(lambda req: httpx.Response(200, json={"ret": ["SUCCESS"], "data": {}}))
    out = aibuy_client._mtop_post("some.api/1.0/", {"k": "v"})
    assert out["ret"] == ["SUCCESS"]


def test_5xx_exhausts_retries_then_raises_retryable():
    calls = {"n": 0}

    def handler(req):
        calls["n"] += 1
        return httpx.Response(503, json={"detail": "down"})

    _inject(handler)
    with pytest.raises(RetryableError):
        aibuy_client._mtop_get("some.api/1.0/", {"k": "v"})
    assert calls["n"] == 3  # 重试耗尽


def test_400_raises_permanent_no_retry():
    calls = {"n": 0}

    def handler(req):
        calls["n"] += 1
        return httpx.Response(400, json={"detail": "bad"})

    _inject(handler)
    with pytest.raises(PermanentError):
        aibuy_client._mtop_post("some.api/1.0/", {"k": "v"})
    assert calls["n"] == 1  # 不重试


def test_signature_uses_configured_app_key():
    """签名/URL 计算仍发生在 httpx 之前,APP_KEY 进入 query。"""
    seen = {}

    def handler(req):
        seen["url"] = str(req.url)
        return httpx.Response(200, json={"data": {}})

    _inject(handler)
    aibuy_client._mtop_get("some.api/1.0/", {"k": "v"})
    assert "appKey=TESTKEY" in seen["url"]
    assert "sign=" in seen["url"]


def test_token_refresh_business_retry_preserved(monkeypatch):
    """token 失效 → reset_session → 刷新 → 重发一次:业务级重试保留。"""
    refreshed = {"n": 0}

    def fake_fetch():
        refreshed["n"] += 1
        return "cookie=new", f"tok{refreshed['n']}"

    monkeypatch.setattr(aibuy_client, "_do_fetch_token", fake_fetch)

    upload_calls = {"n": 0}

    def handler(req):
        url = str(req.url)
        if "image.upload" in url:
            upload_calls["n"] += 1
            if upload_calls["n"] == 1:
                return httpx.Response(200, json={"ret": ["FAIL_SYS_TOKEN_EMPTY::令牌为空"]})
            return httpx.Response(200, json={
                "ret": ["SUCCESS"],
                "data": {"result": {"imageUrl": "http://img/x.jpg"}},
            })
        if "image.search" in url:
            return httpx.Response(200, json={"data": {
                "data": [{"title": "A", "itemPrice": "9", "offerTags": ["高度同款"]}],
                "total": 1,
            }})
        # 图片下载
        return httpx.Response(200, content=b"\xff\xd8\xfffakejpeg")

    # token 已失效,强制走刷新分支
    aibuy_client._tk = "expiredtoken"
    aibuy_client._cs = "cookie=old"
    _inject(handler)

    offers, total = aibuy_client.search_by_image("http://example.com/i.jpg", page_size=5)
    assert upload_calls["n"] == 2          # 上传重发了一次
    assert refreshed["n"] >= 1             # token 被刷新
    assert total == 1
    assert offers and offers[0]["title"] == "A"
