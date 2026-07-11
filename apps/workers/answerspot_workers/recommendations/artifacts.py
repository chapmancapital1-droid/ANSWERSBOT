import json


def faq_schema(category: str, city: str) -> dict:
    payload = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": f"Do you offer emergency {category.lower()} service?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": f"Yes - we offer fast, reliable {category.lower()} service across {city}.",
                },
            },
            {
                "@type": "Question",
                "name": "What areas do you serve?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": f"We serve {city} and the surrounding area.",
                },
            },
        ],
    }
    content = (
        '<script type="application/ld+json">\n'
        + json.dumps(payload, indent=2)
        + "\n</script>"
    )
    return {"kind": "code", "content": content}


def keyword_section(query_text: str, category: str, city: str) -> dict:
    heading = query_text.title()
    content = (
        f"## {heading}\n\n"
        f"Looking for {query_text}? Our {city}-based team specializes in exactly this. "
        f"We provide professional {category.lower()} services with transparent pricing and "
        f"fast response times. Contact us today for a free quote.\n"
    )
    return {"kind": "text", "content": content}


def review_response_draft(business_name: str) -> dict:
    draft = _llm_review_reply(business_name)
    return {"kind": "text", "content": draft}


def _llm_review_reply(business_name: str) -> str:
    # TODO(M5): call the LLM with a tight prompt + guardrails. Deterministic
    # fallback below keeps the engine working (and tests green) without a key.
    return (
        f"Thank you so much for the kind words! It was a pleasure helping you. "
        f"We really appreciate you taking the time to share your experience. "
        f"- The {business_name} team"
    )
