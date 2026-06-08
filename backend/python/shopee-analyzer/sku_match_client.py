"""
step4 SKU 智能匹配 —— 调 langchain-agent 的 sku-match 端点。

shopee-analyzer(Python)与 langchain-agent(Node)同机部署，默认走 localhost:8001。
失败/超时/非 ok 一律返回 None，由上游 _build_row 兜底取最低价 SKU，绝不阻塞整批分析。
"""
import json
import logging
import os
import urllib.request

logger = logging.getLogger("sku_match")

# 同机调用；可用 env 覆盖（部署到不同机时）
_AGENT_URL = os.environ.get("SKU_MATCH_AGENT_URL", "http://localhost:8001/api/agent/sku-match")
_TIMEOUT_SEC = int(os.environ.get("SKU_MATCH_TIMEOUT_SEC", "30"))


def _has_any_sku(candidates: list) -> bool:
    return any((c.get("sku") or {}).get("items") for c in candidates)


def match_sku_via_agent(shopee: dict, candidates: list) -> dict | None:
    """请 agent 为该货品选最佳 SKU。返回 match dict 或 None（None → 上游兜底）。"""
    if not candidates or not _has_any_sku(candidates):
        return None

    payload = json.dumps({"shopee": shopee, "candidates": candidates}).encode("utf-8")
    req = urllib.request.Request(
        _AGENT_URL, data=payload,
        headers={"Content-Type": "application/json"}, method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=_TIMEOUT_SEC) as r:
            resp = json.loads(r.read().decode("utf-8"))
    except Exception as e:
        logger.warning(f"[sku_match] agent 调用失败: {str(e)[:160]}")
        return None

    if not resp.get("ok"):
        logger.warning(f"[sku_match] agent 返回 not ok: {str(resp.get('error'))[:160]}")
        return None
    return resp.get("data")
