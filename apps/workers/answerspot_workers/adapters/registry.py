from .base import PlatformAdapter
from .perplexity_adapter import PerplexityAdapter

_ADAPTERS: dict[str, PlatformAdapter] = { a.key: a for a in [PerplexityAdapter()] }

def get_adapter(platform_key: str) -> PlatformAdapter:
    try:
        return _ADAPTERS[platform_key]
    except KeyError:
        raise ValueError(f"No adapter for platform '{platform_key}'")
