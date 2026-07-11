import time
from .base import PlatformAdapter
from ..schemas import RawAnswer
from ..config import settings

class PerplexityAdapter(PlatformAdapter):
    key = "PERPLEXITY"
    def query(self, query_text: str, location: str | None = None) -> RawAnswer:
        prompt = query_text if not location else f"{query_text} in {location}"
        started = time.monotonic()
        # TODO(M2): call Perplexity API with settings.perplexity_api_key.
        text = ""; cost = 0.0
        return RawAnswer(platform_key=self.key, query_text=prompt, text=text,
                         latency_ms=int((time.monotonic() - started) * 1000), cost_usd=cost)
