from celery import shared_task
from celery.utils.log import get_task_logger
from ..adapters.registry import get_adapter
from ..config import settings
from ..db import session_scope
from .parser import parse_scan

log = get_task_logger(__name__)

@shared_task(name="answerspot_workers.tasks.runner.run_scan",
             bind=True, max_retries=3, default_retry_delay=30, acks_late=True)
def run_scan(self, scan_id: str, platform_key: str, query_text: str, location: str | None = None):
    adapter = get_adapter(platform_key)
    try:
        answers = [adapter.query(query_text, location) for _ in range(settings.scan_sample_count)]
    except Exception as exc:
        log.exception("scan.run failed scan=%s platform=%s", scan_id, platform_key)
        raise self.retry(exc=exc)
    with session_scope() as db:
        # TODO(M2): update Scan status; insert raw sample rows + cost.
        _ = db
    parse_scan.delay(scan_id=scan_id)
    return {"scan_id": scan_id, "samples": len(answers)}
