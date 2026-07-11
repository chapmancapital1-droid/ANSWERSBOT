"""Entry module for `celery -A answerspot_workers.celery_app worker`."""
from answerspot_workers import app

__all__ = ["app"]
