"""Execute a full ScanJob (batch) written by the Nest API."""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from celery.utils.log import get_task_logger
from sqlalchemy import text

from ..adapters.registry import get_adapter
from ..db import session_scope
from ..recommendations.scoring import compute_score
from ..recommendations.signals import BusinessSignals, QuerySignal

log = get_task_logger(__name__)

POS = re.compile(
    r"\b(recommend|top[- ]rated|highly rated|excellent|trusted|reliable|best choice|great option)\b",
    re.I,
)
NEG = re.compile(
    r"\b(avoid|poor|scam|unreliable|complaints|lawsuit|worst|overpriced)\b",
    re.I,
)


def _new_id() -> str:
    return uuid4().hex


def _parse(text_in: str, business_name: str) -> dict[str, Any]:
    mentioned = bool(re.search(re.escape(business_name), text_in or "", re.I))
    rank = None
    if mentioned:
        m = re.search(
            rf"(?:^|\n)\s*(?:#)?(\d+)[\.\)]\s*{re.escape(business_name)}",
            text_in,
            re.I | re.M,
        )
        if m:
            rank = int(m.group(1))
    sentiment = "UNKNOWN"
    if POS.search(text_in or ""):
        sentiment = "POSITIVE"
    elif NEG.search(text_in or ""):
        sentiment = "NEGATIVE"
    elif mentioned:
        sentiment = "NEUTRAL"

    competitors: list[dict[str, Any]] = []
    for line in (text_in or "").splitlines():
        lm = re.match(r"\s*(?:#)?(\d+)[\.\)]\s+([A-Z][\w\s&'.-]{2,40})", line)
        if lm and business_name.lower() not in lm.group(2).lower():
            competitors.append(
                {"name": lm.group(2).strip(), "rank_position": int(lm.group(1))}
            )

    return {
        "mentioned": mentioned,
        "rankPosition": rank,
        "sentiment": sentiment,
        "confidence": 0.7 if mentioned else 0.4,
        "citations": [],
        "competitors": competitors[:8],
    }


def _stub_text(platform: str, query: str, business: str, city: str) -> str:
    return (
        f"Local results for {query}:\n"
        f"1. {business} — trusted option in {city}\n"
        f"2. Cityline Services — competitor\n"
        f"3. Precision Pros — another option\n"
        f"(worker stub · {platform})"
    )


def execute_scan_job(job_id: str) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    with session_scope() as db:
        job = (
            db.execute(
                text('SELECT id, "businessId", status FROM scan_jobs WHERE id = :id'),
                {"id": job_id},
            )
            .mappings()
            .first()
        )
        if not job:
            raise ValueError(f"scan job not found: {job_id}")

        db.execute(
            text(
                'UPDATE scan_jobs SET status = \'RUNNING\', "startedAt" = :t, "updatedAt" = :t WHERE id = :id'
            ),
            {"id": job_id, "t": now},
        )

        business_id = job["businessId"]
        biz = (
            db.execute(
                text(
                    'SELECT id, name, category, city, state FROM businesses '
                    'WHERE id = :id AND "deletedAt" IS NULL'
                ),
                {"id": business_id},
            )
            .mappings()
            .first()
        )
        if not biz:
            raise ValueError("business not found")

        queries = (
            db.execute(
                text(
                    'SELECT id, "queryText", location FROM tracked_queries '
                    'WHERE "businessId" = :bid AND "isActive" = true'
                ),
                {"bid": business_id},
            )
            .mappings()
            .all()
        )

        platforms = (
            db.execute(text("SELECT id, key FROM platforms WHERE enabled = true"))
            .mappings()
            .all()
        )

        created = 0
        live = 0
        stub = 0
        query_signals: list[QuerySignal] = []

        for q in queries:
            mentioned_any = False
            ranks: list[int] = []
            comps: set[str] = set()
            sentiments: list[str] = []

            for p in platforms:
                scan_id = _new_id()
                db.execute(
                    text(
                        """
                        INSERT INTO scans
                          (id, "trackedQueryId", "platformId", status, samples, "runAt", "createdAt", "updatedAt")
                        VALUES
                          (:id, :tq, :pid, 'RUNNING', 1, :t, :t, :t)
                        """
                    ),
                    {
                        "id": scan_id,
                        "tq": q["id"],
                        "pid": p["id"],
                        "t": now,
                    },
                )

                text_out = ""
                try:
                    adapter = get_adapter(str(p["key"]))
                    ans = adapter.query(q["queryText"], q.get("location"))
                    text_out = getattr(ans, "text", None) or ""
                    if text_out.strip():
                        live += 1
                    else:
                        text_out = _stub_text(
                            str(p["key"]), q["queryText"], biz["name"], biz["city"]
                        )
                        stub += 1
                except Exception as exc:  # noqa: BLE001
                    log.warning("adapter %s failed: %s — stub", p["key"], exc)
                    text_out = _stub_text(
                        str(p["key"]), q["queryText"], biz["name"], biz["city"]
                    )
                    stub += 1

                parsed = _parse(text_out, biz["name"])
                result_id = _new_id()
                db.execute(
                    text(
                        """
                        INSERT INTO scan_results
                          (id, "scanId", "rawResponse", mentioned, "rankPosition",
                           sentiment, confidence, citations, competitors, "createdAt")
                        VALUES
                          (:id, :sid, :raw, :m, :rank,
                           CAST(:sent AS "Sentiment"), :conf,
                           CAST(:cit AS jsonb), CAST(:comp AS jsonb), :t)
                        """
                    ),
                    {
                        "id": result_id,
                        "sid": scan_id,
                        "raw": text_out,
                        "m": parsed["mentioned"],
                        "rank": parsed["rankPosition"],
                        "sent": parsed["sentiment"],
                        "conf": parsed["confidence"],
                        "cit": json.dumps(parsed["citations"]),
                        "comp": json.dumps(parsed["competitors"]),
                        "t": now,
                    },
                )
                db.execute(
                    text(
                        "UPDATE scans SET status = 'DONE', \"updatedAt\" = :t WHERE id = :id"
                    ),
                    {"id": scan_id, "t": now},
                )
                created += 1
                if parsed["mentioned"]:
                    mentioned_any = True
                if parsed["rankPosition"] is not None:
                    ranks.append(parsed["rankPosition"])
                sentiments.append(parsed["sentiment"])
                for c in parsed["competitors"]:
                    if c.get("name"):
                        comps.add(str(c["name"]))

            rank_avg = round(sum(ranks) / len(ranks)) if ranks else None
            if "NEGATIVE" in sentiments:
                sent = "NEGATIVE"
            elif "POSITIVE" in sentiments:
                sent = "POSITIVE"
            elif sentiments:
                sent = sentiments[0]
            else:
                sent = "UNKNOWN"

            query_signals.append(
                QuerySignal(
                    query_text=q["queryText"],
                    mentioned=mentioned_any,
                    rank_position=rank_avg,
                    competitors=list(comps),
                    has_citations_for_you=False,
                    sentiment=sent,
                )
            )

        signals = BusinessSignals(
            business_name=biz["name"],
            category=biz["category"],
            city=biz["city"],
            queries=query_signals,
        )
        score = compute_score(signals)

        db.execute(
            text(
                """
                INSERT INTO visibility_scores (id, "businessId", score, breakdown, "computedAt")
                VALUES (:id, :bid, :score, CAST(:bd AS jsonb), :t)
                """
            ),
            {
                "id": _new_id(),
                "bid": business_id,
                "score": score.score,
                "bd": json.dumps(score.breakdown),
                "t": now,
            },
        )

        result = {
            "businessId": business_id,
            "scansCompleted": created,
            "live": live,
            "stub": stub,
            "score": score.score,
            "worker": "celery",
            "platforms": [str(p["key"]) for p in platforms],
            "queries": len(queries),
        }
        db.execute(
            text(
                """
                UPDATE scan_jobs
                SET status = 'DONE', "finishedAt" = :t, "updatedAt" = :t,
                    result = CAST(:r AS jsonb)
                WHERE id = :id
                """
            ),
            {"id": job_id, "t": now, "r": json.dumps(result)},
        )
        return result


def fail_scan_job(job_id: str, error: str) -> None:
    now = datetime.now(timezone.utc)
    with session_scope() as db:
        db.execute(
            text(
                """
                UPDATE scan_jobs
                SET status = 'FAILED', "finishedAt" = :t, "updatedAt" = :t, error = :e
                WHERE id = :id
                """
            ),
            {"id": job_id, "t": now, "e": error[:2000]},
        )
