"""共享 httpx + tenacity 重试。错误分类在此翻译,重试在此执行。"""
import httpx
from tenacity import (Retrying, retry_if_exception_type, stop_after_attempt,
                      wait_random_exponential)
from models.errors import RetryableError, classify_http_status, classify_exception

def make_retry(attempts: int = 3, max_wait: float = 30.0):
    """构造 tenacity Retrying:只对 RetryableError 退避重试。测试时 max_wait=0 免空等。"""
    return Retrying(
        stop=stop_after_attempt(attempts),
        wait=wait_random_exponential(multiplier=1, max=max_wait),
        retry=retry_if_exception_type(RetryableError),
        reraise=True,
    )

def _do_request(client: httpx.Client, method: str, url: str, **kw) -> dict:
    try:
        resp = client.request(method, url, **kw)
    except Exception as e:
        raise classify_exception(e)
    if resp.status_code >= 400:
        raise classify_http_status(resp.status_code, resp.text[:200])
    return resp.json()

def request_json(client: httpx.Client, method: str, url: str, retry=None, **kw) -> dict:
    retry = retry or make_retry()
    return retry(_do_request, client, method, url, **kw)

def make_client(read_timeout: float = 30.0) -> httpx.Client:
    return httpx.Client(timeout=httpx.Timeout(read_timeout, connect=5.0))
