from dataclasses import dataclass
from .signals import BusinessSignals

WEIGHTS = {"w1": 0.40, "w2": 0.30, "w3": 0.15, "w4": 0.15}
WEIGHTS_VERSION = "2026-07-10"


@dataclass
class ScoreResult:
    score: int
    breakdown: dict


def _rank_score(signals: BusinessSignals) -> float:
    ranks = [q.rank_position for q in signals.queries if q.rank_position]
    if not ranks:
        return 0.0
    return sum(max(0.0, (6 - r) / 5) for r in ranks) / len(ranks)


def _sentiment_score(signals: BusinessSignals) -> float:
    vals = {"POSITIVE": 1.0, "NEUTRAL": 0.5, "NEGATIVE": 0.0}
    scored = [vals[q.sentiment] for q in signals.queries if q.sentiment in vals]
    return sum(scored) / len(scored) if scored else 0.5


def _citation_score(signals: BusinessSignals) -> float:
    mentioned = [q for q in signals.queries if q.mentioned]
    if not mentioned:
        return 0.0
    return sum(q.has_citations_for_you for q in mentioned) / len(mentioned)


def compute_score(signals: BusinessSignals) -> ScoreResult:
    appearance = signals.appearance_rate
    rank = _rank_score(signals)
    sentiment = _sentiment_score(signals)
    citation = _citation_score(signals)
    raw = (
        WEIGHTS["w1"] * appearance
        + WEIGHTS["w2"] * rank
        + WEIGHTS["w3"] * sentiment
        + WEIGHTS["w4"] * citation
    )
    return ScoreResult(
        score=round(raw * 100),
        breakdown={
            "appearanceRate": round(appearance, 3),
            "rankScore": round(rank, 3),
            "sentimentScore": round(sentiment, 3),
            "citationScore": round(citation, 3),
            "weights": WEIGHTS,
            "weightsVersion": WEIGHTS_VERSION,
        },
    )
