"""
选品编排层 —— 把 sourcing.py 的业务编排逻辑抽出（逻辑搬家，行为保持）。

职责:
  - 收集去重 offer id
  - 串行经 provider 拉 SKU(带节流间隔，单 offer 失败不阻塞)
  - 逐货品逐候选做 SKU 匹配(改用 clients.llm_client.match_sku 本地直连，
    取 overall_score 最高者；单候选/单货品失败不阻塞批次)

依赖注入原则:
  provider、httpx client、LLM 配置(api_key/base_url/model) 以及 match_sku / pick_candidate
  函数均作为参数传入，便于单测注入 fake，pipeline 不直接持有全局单例。
"""
import logging
import time

from models.errors import SourcingError
from services.cost_calculator import parse_shopee_price

logger = logging.getLogger("sourcing")

# 万邦试用档约 1-3 秒/次，整批并发会被打 503；SKU 请求串行 + 此间隔
SKU_REQUEST_INTERVAL_SEC = 1.5


def collect_offer_ids(candidates_map: dict) -> list:
    """按出现顺序去重收集所有候选的 1688 offer_id（原始字段 itemId）"""
    seen, ordered = set(), []
    for cands in candidates_map.values():
        for c in cands:
            oid = c.get("itemId", "")
            if oid and oid not in seen:
                seen.add(oid)
                ordered.append(oid)
    return ordered


def fetch_skus(provider, candidates_map: dict, sku_cache: dict,
               *, interval: float = SKU_REQUEST_INTERVAL_SEC):
    """串行经 provider 拉 SKU 填进 sku_cache；每拉完一个 offer yield 一条进度。
    万邦试用档约 1-3 秒/次，整批并发会被打 503，故串行 + 请求间间隔。
    单个 offer 失败不阻塞后续。provider 未就绪或无 offer 时不拉取、不 yield。"""
    offer_ids = collect_offer_ids(candidates_map)
    total = len(offer_ids)
    if not (offer_ids and provider.ready):
        return
    logger.info(f"[sku] provider={provider.name} 串行获取 {total} 个 offer 的 SKU 价格表（间隔 {interval}s）...")
    for i, oid in enumerate(offer_ids):
        if i > 0:
            time.sleep(interval)
        try:
            sku_cache[oid] = provider.fetch_sku(oid)
        except Exception as e:
            logger.warning(f"[sku] {oid} provider 异常: {e}")
            sku_cache[oid] = {"sku_count": 0, "min_price": None, "max_price": None,
                              "min_price_spec": None, "skus": [], "error": str(e)[:120]}
        yield {"current": i + 1, "total": total, "item_id": oid}


def _has_sku(candidate: dict) -> bool:
    return bool((candidate.get("sku") or {}).get("items"))


def _default_match_sku(*args, **kwargs):
    """惰性导入真实 match_sku，避免模块级强依赖（也便于测试整体替换）。"""
    from clients.llm_client import match_sku
    return match_sku(*args, **kwargs)


def match_one(client, shopee: dict, candidate: dict, *, api_key: str, base_url: str,
              model: str, on_token=None, on_retry=None, match_sku_fn=None) -> tuple[dict | None, str | None]:
    """对单个候选调 LLM 选最佳 SKU。返回 (match_data, fail_reason)。
    无 SKU → (None, 'no_sku_data')；LLM 异常(Permanent/Retryable 耗尽) → (None, 'llm_call_failed')。
    match_data 为 SkuMatchResult 转的 dict + 回填 matched_item_id（对齐 _build_row 所需字段）。
    on_token(tok): 透传 match_sku 的逐字回调；on_retry(): 流中断重试前回调一次。"""
    if not _has_sku(candidate):
        return None, "no_sku_data"
    fn = match_sku_fn or _default_match_sku
    try:
        result, _raw = fn(client, shopee, candidate, api_key=api_key, base_url=base_url,
                          model=model, on_token=on_token, on_retry=on_retry)
    except SourcingError as e:
        logger.warning(f"[match] item={candidate.get('item_id','')} LLM 失败: {str(e)[:120]}")
        return None, "llm_call_failed"
    except Exception as e:
        logger.warning(f"[match] item={candidate.get('item_id','')} 未分类异常: {str(e)[:120]}")
        return None, "llm_call_failed"

    data = result.model_dump() if hasattr(result, "model_dump") else dict(result)
    data["matched_item_id"] = candidate.get("item_id", "")
    return data, None


def match_best(client, shopee: dict, candidates: list, *, api_key: str, base_url: str,
               model: str, on_token=None, on_retry=None, on_candidate_scored=None,
               match_sku_fn=None) -> tuple[dict | None, str | None, dict]:
    """逐候选串行调 LLM，取 overall_score 最高者（等价旧 sku_match_client.match_sku_best）。
    返回 (best_data, fail_reason, candidate_scores)。
    单候选失败(catch SourcingError/Exception)被跳过、不阻塞其他候选；
    全部候选失败 → (None, 'llm_call_failed', {})。
    on_token(item_id, tok) / on_retry(item_id) / on_candidate_scored(item_id, overall_score):
    逐候选事件回调，已绑定当前候选的 item_id（供 SSE 透传到前端）。"""
    results = []
    candidate_scores: dict = {}
    for cand in candidates:
        if not _has_sku(cand):
            continue
        iid = cand["item_id"]
        cand_on_token = (lambda tok, _iid=iid: on_token(_iid, tok)) if on_token else None
        cand_on_retry = (lambda _iid=iid: on_retry(_iid)) if on_retry else None
        data, _ = match_one(client, shopee, cand, api_key=api_key, base_url=base_url,
                            model=model, on_token=cand_on_token, on_retry=cand_on_retry,
                            match_sku_fn=match_sku_fn)
        if data is not None:
            candidate_scores[iid] = data
            results.append(data)
            if on_candidate_scored:
                on_candidate_scored(iid, data.get("overall_score"))

    if not results:
        return None, "llm_call_failed", {}

    best = max(results, key=lambda d: d.get("overall_score", 0))
    return best, None, candidate_scores


def match_all(products: list, candidates_map: dict, sku_cache: dict, matches: dict,
              *, client, api_key: str, base_url: str, model: str,
              conf_map: dict | None = None, pick_candidate_fn=None,
              match_sku_fn=None, on_token=None, on_retry=None,
              on_candidate_scored=None):
    """step5：逐货品、逐候选调 LLM 选最佳 SKU，按 overall_score 取最高。
    matches[pid] = {"data": ..., "fail_reason": ..., "candidate_scores": ...}。
    单货品全部候选失败 → 该货品标 fail_reason，不影响其他货品。
    on_token/on_retry/on_candidate_scored 透传到 match_best（按候选 item_id 绑定）。"""
    pick = pick_candidate_fn or _default_pick_candidate
    total = len(products)
    for i, prod in enumerate(products):
        pid = prod["product_id"]
        raw_cands = candidates_map.get(pid, [])
        pid_confs = (conf_map or {}).get(pid, {})
        enriched = [pick(c, sku_cache.get(c.get("itemId", "")) or {},
                         image_confidence=pid_confs.get(c.get("itemId", "")))
                    for c in raw_cands]
        if not enriched:
            matches[pid] = {"data": None, "fail_reason": "no_qualified_candidate"}
            yield {"current": i + 1, "total": total, "item_id": pid}
            continue
        shopee = {
            "name": str(prod.get("product_name", "")),
            "category": str(prod.get("category_path", "")),
            "price_brl": parse_shopee_price(prod.get("shopee_price_brl")),
        }
        data, fail_reason, candidate_scores = match_best(
            client, shopee, enriched, api_key=api_key, base_url=base_url,
            model=model, on_token=on_token, on_retry=on_retry,
            on_candidate_scored=on_candidate_scored, match_sku_fn=match_sku_fn)
        matches[pid] = {"data": data, "fail_reason": fail_reason,
                        "candidate_scores": candidate_scores}
        yield {"current": i + 1, "total": total, "item_id": pid}


def _default_pick_candidate(*args, **kwargs):
    """惰性导入 sourcing._pick_candidate，避免与 sourcing 的循环 import。"""
    from sourcing import _pick_candidate
    return _pick_candidate(*args, **kwargs)
