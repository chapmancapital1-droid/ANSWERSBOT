from answerspot_workers.recommendations.signals import BusinessSignals, QuerySignal
from answerspot_workers.recommendations.scoring import compute_score
from answerspot_workers.recommendations.engine import generate


def _signals(mentioned_ratio: float = 0.5) -> BusinessSignals:
    queries = []
    for i in range(10):
        mentioned = i < int(10 * mentioned_ratio)
        queries.append(
            QuerySignal(
                query_text=f"query {i}",
                mentioned=mentioned,
                rank_position=1 if mentioned else None,
                competitors=["Rival Roofing"] if not mentioned else [],
                has_citations_for_you=mentioned and i % 2 == 0,
                sentiment="POSITIVE" if mentioned else "NEUTRAL",
            )
        )
    return BusinessSignals(
        business_name="Demo Roofing Co",
        category="roofer",
        city="Austin",
        queries=queries,
    )


def test_score_in_range():
    score = compute_score(_signals(0.5))
    assert 0 <= score.score <= 100
    assert "weightsVersion" in score.breakdown


def test_generate_returns_recs():
    result = generate(_signals(0.3), review_rate=0.2, review_count=20)
    assert "score" in result
    assert isinstance(result["recommendations"], list)
