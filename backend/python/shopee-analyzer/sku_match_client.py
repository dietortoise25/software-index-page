"""
step4 SKU 智能匹配 —— 逐候选调 langchain-agent 的 sku-match 端点。

每个 1688 候选单独调一次 agent，agent 从该候选的 SKU 列表里选最佳 SKU 并打分。
Python 侧串行调完所有候选后，按 overall_score 取最高者作为该商品的选中结果。
"""
import json
import logging
import os
import urllib.request

logger = logging.getLogger("sku_match")

_AGENT_URL = os.environ.get("SKU_MATCH_AGENT_URL", "http://localhost:8001/api/agent/sku-match")
_TIMEOUT_SEC = int(os.environ.get("SKU_MATCH_TIMEOUT_SEC", "45"))


def _has_sku(candidate: dict) -> bool:
    return bool((candidate.get("sku") or {}).get("items"))


def match_sku_for_candidate(shopee: dict, candidate: dict) -> tuple[dict | None, str | None]:
    """对单个候选调 agent 选最佳 SKU。返回 (match_data, fail_reason)。"""
    if not _has_sku(candidate):
        return None, "no_sku_data"

    payload = json.dumps({"shopee": shopee, "candidate": candidate}).encode("utf-8")
    req = urllib.request.Request(
        _AGENT_URL, data=payload,
        headers={"Content-Type": "application/json"}, method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=_TIMEOUT_SEC) as r:
            resp = json.loads(r.read().decode("utf-8"))
    except Exception as e:
        logger.warning(f"[sku_match] agent 调用失败 (item={candidate.get('item_id','')}): {str(e)[:120]}")
        return None, "llm_call_failed"

    if not resp.get("ok"):
        logger.warning(f"[sku_match] agent not ok (item={candidate.get('item_id','')}): {str(resp.get('error'))[:120]}")
        return None, "llm_call_failed"
    return resp.get("data"), None


def match_sku_best(shopee: dict, candidates: list) -> tuple[dict | None, str | None]:
    """逐候选串行调 agent，取 overall_score 最高者。返回 (best_data, fail_reason)。"""
    results = []
    for cand in candidates:
        if not _has_sku(cand):
            continue
        data, _ = match_sku_for_candidate(shopee, cand)
        if data is not None:
            data["matched_item_id"] = cand["item_id"]
            results.append(data)

    if not results:
        return None, "llm_call_failed"

    best = max(results, key=lambda d: d.get("overall_score", 0))
    return best, None
