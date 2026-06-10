"""统一中转 LLM 客户端:流式调用,传输 token 与解析结构化结果分离。"""
import json
from collections.abc import Callable
import httpx
from models.errors import classify_http_status, classify_exception

def stream_chat(client: httpx.Client, *, model: str, messages: list,
                api_key: str, base_url: str,
                on_token: Callable[[str], None] | None = None,
                temperature: float = 0, max_tokens: int = 1024) -> str:
    """流式调 chat/completions,累积并返回完整文本;每个 token 经 on_token 吐出。"""
    url = f"{base_url.rstrip('/')}/chat/completions"
    payload = {"model": model, "messages": messages, "temperature": temperature,
               "max_tokens": max_tokens, "stream": True}
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    buf = []
    try:
        with client.stream("POST", url, json=payload, headers=headers) as resp:
            if resp.status_code >= 400:
                resp.read()
                raise classify_http_status(resp.status_code, resp.text[:200])
            for line in resp.iter_lines():
                if not line or not line.startswith("data: "):
                    continue
                data = line[6:]
                if data.strip() == "[DONE]":
                    break
                try:
                    delta = json.loads(data)["choices"][0]["delta"].get("content", "")
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue
                if delta:
                    buf.append(delta)
                    if on_token:
                        on_token(delta)
    except httpx.HTTPError as e:
        raise classify_exception(e)
    return "".join(buf)
