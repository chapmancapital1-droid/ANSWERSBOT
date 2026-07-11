from .base import PlatformAdapter
from ..schemas import RawAnswer

class AIOverviewAdapter(PlatformAdapter):
    key = "AI_OVERVIEW"
    def query(self, query_text: str, location: str | None = None) -> RawAnswer:
        # BLOCKED pending legal review - see ADR 0004. Do NOT implement M0-M4.
        raise NotImplementedError("AI Overview capture blocked pending ADR 0004")
