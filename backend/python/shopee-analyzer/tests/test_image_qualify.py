"""
图文核对阈值过滤(第3条 Q13=B) —— confidence<0.5 的候选不准当 best_1688。

规则：
- image_confidence 明确 < 0.5 → 踢出"合格池"(不参与 best_1688 / step4 选择)
- image_confidence is None(未评分/核对失败/未配 key) → 保留(不惩罚)
- 全部候选都 <0.5 → 合格池空 → 上游 best_1688=None → 待补全
- 导出明细 candidates 仍保留全部(含分数)，过滤只作用于"选谁当最佳"

运行: cd backend/python/shopee-analyzer && python -m pytest tests/test_image_qualify.py -v
"""


def _cand(item_id, conf, price="10"):
    return {
        "item_id": item_id,
        "image_confidence": conf,
        "sku": {"items": [{"sku_id": 1, "full_spec": "默认", "price": price}]},
    }


def test_drops_below_threshold():
    """conf<0.5 被踢，conf>=0.5 保留"""
    from sourcing import _qualified_candidates
    cands = [_cand("A", 0.3), _cand("B", 0.8), _cand("C", 0.5)]
    out = _qualified_candidates(cands, 0.5)
    assert [c["item_id"] for c in out] == ["B", "C"]


def test_none_confidence_kept():
    """未评分(None)保留，不惩罚"""
    from sourcing import _qualified_candidates
    cands = [_cand("A", None), _cand("B", 0.2)]
    out = _qualified_candidates(cands, 0.5)
    assert [c["item_id"] for c in out] == ["A"]


def test_all_below_threshold_empty():
    """全部 <0.5 → 合格池空"""
    from sourcing import _qualified_candidates
    cands = [_cand("A", 0.1), _cand("B", 0.4)]
    assert _qualified_candidates(cands, 0.5) == []


def test_select_matched_sku_ignores_disqualified():
    """_select_matched_sku 只在合格池里兜底选最低价：
    被踢候选(conf<0.5)即使价更低也不当 best"""
    from sourcing import _select_matched_sku
    enriched = [
        {"item_id": "CHEAP", "image_confidence": 0.2,
         "sku": {"items": [{"sku_id": 1, "price": "1.00"}]}},
        {"item_id": "OK", "image_confidence": 0.9,
         "sku": {"items": [{"sku_id": 2, "price": "9.00"}]}},
    ]
    best, sku, source = _select_matched_sku(enriched, None, threshold=0.5)
    assert best["item_id"] == "OK"
    assert source == "fallback"


def test_select_all_disqualified_returns_none():
    """合格池空 → best_1688=None, source=none"""
    from sourcing import _select_matched_sku
    enriched = [
        {"item_id": "A", "image_confidence": 0.1,
         "sku": {"items": [{"sku_id": 1, "price": "1.00"}]}},
    ]
    best, sku, source = _select_matched_sku(enriched, None, threshold=0.5)
    assert best is None
    assert sku is None
    assert source == "none"
