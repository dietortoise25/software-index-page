"""
GPT 图文核对 —— 判断 Shopee 商品图与 1688 候选图是否真同款。

对每个 (Shopee 图, 1688 候选图 + 标题) 调多模态模型，返回"同款可能性"
置信度 0~1。复用 SKU_MATCH_* 渠道(newapi 中转的 gpt-5.5，支持 vision)。

设计原则(与 sku_match_client 一致)：失败/缺图/未配 key 一律返回 None，
表示"未评分"——上游不据此惩罚候选，绝不阻塞整批分析。
"""
import json
import logging
import os
import re
from concurrent.futures import ThreadPoolExecutor

import httpx

from clients.http import make_client
from clients.llm_client import stream_chat

logger = logging.getLogger("image_verify")

_API_KEY = os.environ.get("SKU_MATCH_API_KEY", "")
_MODEL = os.environ.get("SKU_MATCH_MODEL", "gpt-5.5")
_BASE_URL = os.environ.get("SKU_MATCH_BASE_URL", "https://api.openai.com/v1").rstrip("/")
_TIMEOUT_SEC = int(os.environ.get("IMAGE_VERIFY_TIMEOUT_SEC", "40"))
_MAX_WORKERS = int(os.environ.get("IMAGE_VERIFY_CONCURRENCY", "5"))

_SYSTEM = (
    "你是跨境选品的图文核对助手。给你一张 Shopee 在售商品主图、一张 1688 候选商品主图"
    "及其标题，判断两者是否为同一款商品(同款/高度相似为高分，明显不同品类或外观为低分)。"
    "只看是不是同款，不评价价格或质量。"
    '严格只输出 JSON：{"confidence": 0~1 的小数, "reason": "简短中文理由"}。'
)


def _parse_confidence(content: str):
    """从模型文本里抠 confidence，裁剪到 [0,1]；解析失败 → None。"""
    if not content:
        return None
    text = content.strip()
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        return None
    try:
        obj = json.loads(m.group(0))
        c = float(obj["confidence"])
    except (ValueError, KeyError, TypeError):
        return None
    return max(0.0, min(1.0, c))


def _build_messages(shopee_img: str, cand_img: str, cand_title: str):
    return [
        {"role": "system", "content": _SYSTEM},
        {"role": "user", "content": [
            {"type": "text", "text": f"Shopee 在售商品图(第一张) vs 1688 候选图(第二张)。候选标题：{cand_title}"},
            {"type": "image_url", "image_url": {"url": shopee_img}},
            {"type": "image_url", "image_url": {"url": cand_img}},
        ]},
    ]


def verify_one(shopee_img: str, cand_img: str, cand_title: str,
               client: httpx.Client | None = None):
    """单次图文核对 → confidence(0~1) 或 None。缺图/未配 key/异常 → None。

    通过 clients.llm_client.stream_chat 走 httpx 流式调用;可注入 client 便于测试,
    默认 None 时内部用 clients.http.make_client() 创建。失败一律 catch 后返回 None,
    绝不向上抛(保持"失败不阻塞整批"语义)。
    """
    if not _API_KEY or not shopee_img or not cand_img:
        return None
    messages = _build_messages(shopee_img, cand_img, cand_title or "")
    owns_client = client is None
    if owns_client:
        client = make_client(read_timeout=float(_TIMEOUT_SEC))
    try:
        content = stream_chat(
            client, model=_MODEL, messages=messages,
            api_key=_API_KEY, base_url=_BASE_URL,
            temperature=0, max_tokens=200,
        )
    except Exception as e:
        logger.warning(f"[image_verify] 调用失败: {str(e)[:160]}")
        return None
    finally:
        if owns_client:
            client.close()
    return _parse_confidence(content)


def verify_candidates(shopee_img: str, candidates: list,
                      client: httpx.Client | None = None) -> dict:
    """并发对一批候选打图文分。返回 {item_id: confidence|None}。

    client 为可选注入(默认 None);为不破坏现有调用点 verify_candidates(img, cands),
    新增参数带默认值。client 透传给每个 verify_one。
    """
    if not _API_KEY or not shopee_img:
        return {}
    jobs = [(c.get("item_id", ""), c.get("image_url", ""), c.get("title", ""))
            for c in candidates if c.get("item_id")]
    if not jobs:
        return {}
    out: dict = {}
    with ThreadPoolExecutor(max_workers=_MAX_WORKERS) as ex:
        fut_map = {ex.submit(verify_one, shopee_img, img, title, client): iid
                   for iid, img, title in jobs}
        for fut in fut_map:
            iid = fut_map[fut]
            try:
                out[iid] = fut.result()
            except Exception:
                out[iid] = None
    return out
