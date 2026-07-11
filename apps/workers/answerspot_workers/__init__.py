from celery import Celery
from .config import settings

app = Celery(
    "answerspot_workers",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=[
        "answerspot_workers.tasks.runner",
        "answerspot_workers.tasks.parser",
        "answerspot_workers.tasks.recommender",
        "answerspot_workers.tasks.scheduler",
    ],
)
app.conf.task_routes = {
    "answerspot_workers.tasks.runner.*": {"queue": "runner"},
    "answerspot_workers.tasks.parser.*": {"queue": "parser"},
    "answerspot_workers.tasks.recommender.*": {"queue": "recs"},
}
app.conf.beat_schedule = {
    "enqueue-due-scans": {
        "task": "answerspot_workers.tasks.scheduler.enqueue_due_scans",
        "schedule": 3600.0,
    },
}
app.conf.task_acks_late = True
app.conf.task_reject_on_worker_lost = True
