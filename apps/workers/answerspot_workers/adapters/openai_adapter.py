import time
import httpx
from .base import PlatformAdapter
from ..schemas import RawAnswer
from ..config import settings


class OpenAIAdapter(PlatformAdapter):
    key = "CHATGPT"

    def query(self, query_text: str, location: str | None = None) -> RawAnswer:
        started = time.monotonic()
        prompt = f"{query_text} in {location}" if location else query_text
        if not settings.openai_api_key:
            return RawAnswer(
                platform_key=self.key,
                query_text=prompt,
                text="",
                latency_ms=0,
                cost_usd=0.0,
            )
        res = httpx.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            json={
                "model": "gpt-4o-mini",
                "messages": [
                    {
                        "role": "system",
                        "content": "List top local service businesses as numbered list 1-5.",
                    },
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.3,
                "max_tokens": 700,
            },
            timeout=45.0,
        )
        res.raise_for_status()
        text = res.json()["choices"][0]["message"]["content"]
        return RawAnswer(
            platform_key=self.key,
            query_text=prompt,
            text=text,
            latency_ms=int((time.monotonic() - started) * 1000),
            cost_usd=0.0,
        )
