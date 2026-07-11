from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field

class Sentiment(str, Enum):
    POSITIVE = "POSITIVE"; NEUTRAL = "NEUTRAL"; NEGATIVE = "NEGATIVE"; UNKNOWN = "UNKNOWN"

class Citation(BaseModel):
    url: str; title: Optional[str] = None; source: Optional[str] = None

class CompetitorMention(BaseModel):
    name: str; rank_position: Optional[int] = None

class RawAnswer(BaseModel):
    platform_key: str; query_text: str; text: str; latency_ms: int; cost_usd: float = 0.0

class ParsedResult(BaseModel):
    mentioned: bool
    rank_position: Optional[int] = None
    sentiment: Sentiment = Sentiment.UNKNOWN
    confidence: float = Field(ge=0.0, le=1.0, default=0.0)
    citations: list[Citation] = []
    competitors: list[CompetitorMention] = []
