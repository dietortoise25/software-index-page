"""统一中转 LLM 客户端:流式调用,传输 token 与解析结构化结果分离。"""
import json
import re
from collections.abc import Callable
import httpx
from tenacity import (Retrying, retry_if_exception_type, stop_after_attempt,
                      wait_random_exponential)
from models.errors import classify_http_status, classify_exception, RetryableError
from models.llm import SkuMatchResult

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


# 从 langchain-agent/src/lib/sku-match.ts 搬来(SYSTEM_PROMPT 原意)
SKU_MATCH_SYSTEM = """你是跨境选品助手。给定一个虾皮(Shopee)在售货品,和【一个】1688 候选货源(含多个分规格 SKU 及其单价/库存,以及一个图文核对得分 image_confidence),请从这个候选的 SKU 里选出与该虾皮货品最匹配的那一个 SKU。

判断依据(按重要性排序):
1. 名称/类目/规格(full_spec)语义贴合度 —— 最重要。
2. image_confidence(图文核对得分,0~1):仅作参考,不能作为唯一依据。该分数普遍偏低且不完全可信。分数高是加分项,分数低不必直接否决;若为 null 表示未核对,按中性对待。
3. 价格竞争力:语义同样贴合时,单价更低更优。
4. 供货能力:库存(can_book_count)更充足更优。

只输出一个 JSON 对象,字段为 matched_sku_id、confidence、reason、scores(含 price/semantic_match/image_match/supply 每项 0-100 整数)、overall_score(0-100)。不要输出 JSON 以外的任何文字。不要计算利润。不要编造 sku_id。"""


def _lean_candidate(candidate: dict) -> dict:
    """裁成 LLM 该看的精简视图(对齐 sku-match.ts 的 buildMatchInput)。"""
    items = (candidate.get("sku") or {}).get("items") or []
    return {
        "item_id": candidate.get("item_id", ""),
        "title": candidate.get("title", ""),
        "image_confidence": candidate.get("image_confidence"),
        "skus": [{"sku_id": s.get("sku_id"), "full_spec": str(s.get("full_spec", "")),
                  "price": str(s.get("price", "")), "can_book_count": s.get("can_book_count")}
                 for s in items],
    }


def _parse_sku_match(text: str) -> SkuMatchResult:
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        raise RetryableError("LLM 输出无 JSON", code="PARSE")
    try:
        return SkuMatchResult.model_validate_json(m.group(0))
    except Exception as e:
        raise RetryableError(f"LLM JSON 解析失败: {str(e)[:120]}", code="PARSE")


def match_sku(client, shopee: dict, candidate: dict, *, api_key: str, base_url: str,
              model: str, on_token=None, on_retry=None, attempts: int = 3, max_wait: float = 20.0):
    """流式调 LLM 选 SKU。返回 (SkuMatchResult, raw_text)。流中断/解析失败 → 整条重试。
    on_retry(): 每次重试前(上一轮流中断/解析失败)回调一次，供上层通知前端清空已显示 token。"""
    lean = {"shopee": {"name": shopee.get("name"), "category": shopee.get("category"),
                       "price_brl": shopee.get("price_brl")},
            "candidate": _lean_candidate(candidate)}
    messages = [{"role": "system", "content": SKU_MATCH_SYSTEM},
                {"role": "user", "content": json.dumps(lean, ensure_ascii=False)}]

    def _once():
        raw = stream_chat(client, model=model, messages=messages, api_key=api_key,
                          base_url=base_url, on_token=on_token, max_tokens=512)
        return _parse_sku_match(raw), raw

    def _before_sleep(_state):
        if on_retry:
            on_retry()

    retry = Retrying(stop=stop_after_attempt(attempts),
                     wait=wait_random_exponential(multiplier=1, max=max_wait),
                     retry=retry_if_exception_type(RetryableError), reraise=True,
                     before_sleep=_before_sleep)
    return retry(_once)
