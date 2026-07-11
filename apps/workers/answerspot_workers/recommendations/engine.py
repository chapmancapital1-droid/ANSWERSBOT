from .signals import BusinessSignals
from .rules import SIGNAL_ONLY_RULES, rule_review_response, DraftRecommendation
from .scoring import compute_score

MAX_RECOMMENDATIONS = 5


def generate(signals: BusinessSignals, *, review_rate: float, review_count: int) -> dict:
    drafts: list[DraftRecommendation] = []
    for rule in SIGNAL_ONLY_RULES:
        rec = rule(signals)
        if rec:
            drafts.append(rec)
    review_rec = rule_review_response(signals, review_rate, review_count)
    if review_rec:
        drafts.append(review_rec)
    best_by_type: dict[str, DraftRecommendation] = {}
    for d in drafts:
        cur = best_by_type.get(d.type)
        if cur is None or d.impact > cur.impact:
            best_by_type[d.type] = d
    ranked = sorted(best_by_type.values(), key=lambda d: d.impact, reverse=True)
    top = ranked[:MAX_RECOMMENDATIONS]
    score = compute_score(signals)
    return {
        "score": score.score,
        "breakdown": score.breakdown,
        "recommendations": [
            {
                "type": d.type,
                "severity": d.severity,
                "title": d.title,
                "message": d.message,
                "artifact": d.artifact,
                "status": "OPEN",
            }
            for d in top
        ],
    }
