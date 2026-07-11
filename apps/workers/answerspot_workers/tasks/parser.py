from celery import shared_task
from celery.utils.log import get_task_logger
from pydantic import ValidationError
from ..schemas import ParsedResult
from ..db import session_scope
from .recommender import generate_recommendations

log = get_task_logger(__name__)

@shared_task(name="answerspot_workers.tasks.parser.parse_scan",
             bind=True, max_retries=2, default_retry_delay=15, acks_late=True)
def parse_scan(self, scan_id: str):
    with session_scope() as db:
        raw_samples: list[str] = []  # TODO(M3): load raw samples
        _ = db
    parsed: list[ParsedResult] = []
    for raw in raw_samples:
        try:
            parsed.append(ParsedResult.model_validate_json(raw))  # TODO(M3): LLM extraction
        except ValidationError as exc:
            log.warning("parse invalid JSON scan=%s: %s", scan_id, exc)
            raise self.retry(exc=exc)
    with session_scope() as db:
        # TODO(M3): aggregate parsed[] -> scan_result + confidence.
        _ = db
    generate_recommendations.delay(scan_id=scan_id)
    return {"scan_id": scan_id, "parsed": len(parsed)}
