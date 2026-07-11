from celery import shared_task
from ..db import session_scope
from .runner import run_scan

CADENCE_HOURS = {"STARTER": 24 * 7, "PRO": 24, "AGENCY": 24}

@shared_task(name="answerspot_workers.tasks.scheduler.enqueue_due_scans")
def enqueue_due_scans():
    enqueued = 0
    with session_scope() as db:
        due: list[dict] = []  # TODO(M2): find due (business x query x platform)
        _ = db
    for item in due:
        run_scan.delay(scan_id=item["scan_id"], platform_key=item["platform_key"],
                       query_text=item["query_text"], location=item.get("location"))
        enqueued += 1
    return {"enqueued": enqueued}
