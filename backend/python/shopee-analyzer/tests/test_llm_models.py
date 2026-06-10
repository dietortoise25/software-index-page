import pytest
from pydantic import ValidationError
from models.llm import SkuMatchResult, MatchScores

def test_valid_sku_match():
    r = SkuMatchResult(matched_sku_id="123", confidence=0.8,
                       reason="规格贴合",
                       scores=MatchScores(price=80, semantic_match=90, image_match=50, supply=70),
                       overall_score=85)
    assert r.matched_sku_id == "123"
    assert r.scores.semantic_match == 90

def test_overall_score_out_of_range_rejected():
    with pytest.raises(ValidationError):
        SkuMatchResult(matched_sku_id="1", confidence=0.5, reason="x",
                       scores=MatchScores(price=1, semantic_match=1, image_match=1, supply=1),
                       overall_score=150)

def test_sku_id_accepts_int():
    r = SkuMatchResult(matched_sku_id=999, confidence=0.5, reason="x",
                       scores=MatchScores(price=1, semantic_match=1, image_match=1, supply=1),
                       overall_score=50)
    assert r.matched_sku_id == 999
