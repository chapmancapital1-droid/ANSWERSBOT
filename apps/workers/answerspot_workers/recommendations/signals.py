from dataclasses import dataclass
from collections import Counter


@dataclass
class QuerySignal:
    query_text: str
    mentioned: bool
    rank_position: int | None
    competitors: list[str]
    has_citations_for_you: bool
    sentiment: str


@dataclass
class BusinessSignals:
    business_name: str
    category: str
    city: str
    queries: list[QuerySignal]

    @property
    def appearance_rate(self) -> float:
        if not self.queries:
            return 0.0
        return sum(q.mentioned for q in self.queries) / len(self.queries)

    @property
    def missing_queries(self) -> list[QuerySignal]:
        return [q for q in self.queries if not q.mentioned]

    @property
    def negative_queries(self) -> list[QuerySignal]:
        return [q for q in self.queries if q.sentiment == "NEGATIVE"]

    @property
    def top_competitors(self) -> list[tuple[str, int]]:
        c = Counter()
        for q in self.queries:
            for name in q.competitors:
                if name != self.business_name:
                    c[name] += 1
        return c.most_common()

    def competitor_beats_you_in(self, competitor: str) -> list[QuerySignal]:
        return [q for q in self.queries if competitor in q.competitors and not q.mentioned]

    @property
    def citation_gap_queries(self) -> list[QuerySignal]:
        return [q for q in self.queries if q.mentioned and not q.has_citations_for_you]
