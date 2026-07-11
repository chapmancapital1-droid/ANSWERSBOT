"""Google AI Overview via SerpAPI when SERP_API_KEY is set.

Gated by env ENABLE_AI_OVERVIEW=true on the API; platform row must be enabled.
Legal: treat as experimental; do not scrape Google HTML directly.
"""
from __future__ import annotations

import os
import time
import httpx
from .base import PlatformAdapter
from ..schemas import RawAnswer
from ..config import settings


class AIOverviewAdapter(PlatformAdapter):
    key = "AI_OVERVIEW"

    def query(self, query_text: str, location: str | None = None) -> RawAnswer:
        started = time.monotonic()
        prompt = f"{query_text} {location}" if location else query_text
        key = settings.serp_api_key or os.getenv("SERP_API_KEY", "")
        if not key:
            raise RuntimeError("SERP_API_KEY required for AI Overview")

        res = httpx.get(
            "https://serpapi.com/search.json",
            params={
                "engine": "google",
                "q": prompt,
                "api_key": key,
                "hl": "en",
                "gl": "us",
            },
            timeout=45.0,
        )
        res.raise_for_status()
        data = res.json()
        lines: list[str] = []
        ai = data.get("ai_overview") or data.get("answer_box") or {}
        if isinstance(ai, dict):
            if ai.get("title"):
                lines.append(str(ai["title"]))
            for block in ai.get("text_blocks") or []:
                if isinstance(block, dict) and block.get("snippet"):
                    lines.append(str(block["snippet"]))
                elif isinstance(block, dict) and block.get("list"):
                    for i, item in enumerate(block["list"], 1):
                        snip = item.get("snippet") or item.get("title") or str(item)
                        lines.append(f"{i}. {snip}")
            if ai.get("snippet"):
                lines.append(str(ai["snippet"]))
        organic = data.get("organic_results") or []
        for i, row in enumerate(organic[:5], 1):
            title = row.get("title") or "Result"
            snip = row.get("snippet") or ""
            lines.append(f"{i}. {title} — {snip}")

        text = "\n".join(lines) if lines else f"No AI Overview for: {prompt}"
        return RawAnswer(
            platform_key=self.key,
            query_text=prompt,
            text=text,
            latency_ms=int((time.monotonic() - started) * 1000),
            cost_usd=0.01,
        )
