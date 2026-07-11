from .base import PlatformAdapter
from .perplexity_adapter import PerplexityAdapter
from .openai_adapter import OpenAIAdapter
from .ai_overview_adapter import AIOverviewAdapter

_ADAPTERS: dict[str, PlatformAdapter] = {
    a.key: a
    for a in [PerplexityAdapter(), OpenAIAdapter(), AIOverviewAdapter()]
}


def get_adapter(platform_key: str) -> PlatformAdapter:
    try:
        return _ADAPTERS[platform_key]
    except KeyError as e:
        raise ValueError(f"No adapter for platform '{platform_key}'") from e
