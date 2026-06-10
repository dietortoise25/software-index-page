"""LLM 调用的结构化结果模型(对齐 langchain-agent/sku-match.ts 的 schema)。"""
from pydantic import BaseModel, Field


class MatchScores(BaseModel):
    price: float = Field(ge=0, le=100)
    semantic_match: float = Field(ge=0, le=100)
    image_match: float = Field(ge=0, le=100)
    supply: float = Field(ge=0, le=100)


class SkuMatchResult(BaseModel):
    matched_sku_id: str | int
    confidence: float = Field(ge=0, le=1)
    reason: str
    scores: MatchScores
    overall_score: float = Field(ge=0, le=100)
