from dataclasses import dataclass
from typing import Callable, Optional
from .signals import BusinessSignals
from . import artifacts


@dataclass
class DraftRecommendation:
    type: str
    severity: str
    title: str
    message: str
    impact: float
    artifact: Optional[dict] = None


def rule_missing_high_intent(s: BusinessSignals) -> Optional[DraftRecommendation]:
    missing = s.missing_queries
    if not missing:
        return None
    hottest = max(missing, key=lambda q: len(q.competitors))
    if not hottest.competitors:
        return None
    n = len(hottest.competitors)
    return DraftRecommendation(
        type="KEYWORD_GAP",
        severity="HIGH" if n >= 2 else "MEDIUM",
        title=f'Get listed for "{hottest.query_text}"',
        message=(
            f"You don't appear when customers search \"{hottest.query_text}\", "
            f"but {n} competitor{'s' if n > 1 else ''} do. "
            f"Add a clear section about this service to your site so AI assistants can find it."
        ),
        impact=0.6 + 0.1 * min(n, 3),
        artifact=artifacts.keyword_section(hottest.query_text, s.category, s.city),
    )


def rule_citation_gap(s: BusinessSignals) -> Optional[DraftRecommendation]:
    gaps = s.citation_gap_queries
    if len(gaps) < 2:
        return None
    return DraftRecommendation(
        type="CITATION_GAP",
        severity="HIGH",
        title="Add FAQ structured data to your website",
        message=(
            f"You're mentioned in {len(gaps)} queries but no sources back you up, "
            f"so those mentions are fragile. FAQ structured data helps AI assistants "
            f"quote you directly and trust your site."
        ),
        impact=0.7,
        artifact=artifacts.faq_schema(s.category, s.city),
    )


def rule_review_response(s: BusinessSignals, response_rate: float, review_count: int) -> Optional[DraftRecommendation]:
    if review_count < 5 or response_rate >= 0.6:
        return None
    return DraftRecommendation(
        type="REVIEW_SIGNAL",
        severity="MEDIUM",
        title="Reply to your unanswered reviews",
        message=(
            f"You respond to about {round(response_rate * 100)}% of your {review_count} reviews. "
            f"AI assistants treat response rate as a sign of an engaged, trustworthy business. "
            f"Replying to a few more can lift how you're described."
        ),
        impact=0.45,
        artifact=artifacts.review_response_draft(s.business_name),
    )


def rule_negative_sentiment(s: BusinessSignals) -> Optional[DraftRecommendation]:
    neg = s.negative_queries
    if not neg:
        return None
    return DraftRecommendation(
        type="SENTIMENT_ISSUE",
        severity="CRITICAL",
        title="AI is describing you negatively",
        message=(
            f"In {len(neg)} quer{'ies' if len(neg) > 1 else 'y'}, AI assistants describe your "
            f"business in a negative light. This is worth investigating first - it can undo "
            f"gains everywhere else."
        ),
        impact=0.95,
        artifact=None,
    )


def rule_competitor_overtake(s: BusinessSignals) -> Optional[DraftRecommendation]:
    top = s.top_competitors
    if not top:
        return None
    name, count = top[0]
    beats = s.competitor_beats_you_in(name)
    if len(beats) < 2:
        return None
    return DraftRecommendation(
        type="COMPETITOR_OVERTAKE",
        severity="HIGH",
        title=f"{name} is winning your slots",
        message=(
            f"{name} appears in {count} of your queries and beats you in {len(beats)} of them. "
            f"Focus your next improvements on the services where they're pulling ahead."
        ),
        impact=0.65,
        artifact=None,
    )


SIGNAL_ONLY_RULES: list[Callable[[BusinessSignals], Optional[DraftRecommendation]]] = [
    rule_missing_high_intent,
    rule_citation_gap,
    rule_negative_sentiment,
    rule_competitor_overtake,
]
