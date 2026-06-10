import httpx
import pytest
from clients.http import request_json, make_retry
from models.errors import RetryableError, PermanentError

def _client_returning(statuses):
    """每次调用按序返回下一个状态码;用尽后重复最后一个。"""
    calls = {"n": 0}
    def handler(req):
        i = min(calls["n"], len(statuses) - 1)
        calls["n"] += 1
        code = statuses[i]
        return httpx.Response(code, json={"detail": "x"} if code >= 400 else {"ok": 1})
    return httpx.Client(transport=httpx.MockTransport(handler)), calls

def test_success_returns_json():
    client, calls = _client_returning([200])
    out = request_json(client, "GET", "http://t/x", retry=make_retry(attempts=3, max_wait=0))
    assert out == {"ok": 1}
    assert calls["n"] == 1

def test_503_then_200_retries():
    client, calls = _client_returning([503, 200])
    out = request_json(client, "GET", "http://t/x", retry=make_retry(attempts=3, max_wait=0))
    assert out == {"ok": 1}
    assert calls["n"] == 2

def test_400_not_retried():
    client, calls = _client_returning([400])
    with pytest.raises(PermanentError):
        request_json(client, "GET", "http://t/x", retry=make_retry(attempts=3, max_wait=0))
    assert calls["n"] == 1

def test_503_exhausts_attempts():
    client, calls = _client_returning([503])
    with pytest.raises(RetryableError):
        request_json(client, "GET", "http://t/x", retry=make_retry(attempts=3, max_wait=0))
    assert calls["n"] == 3
