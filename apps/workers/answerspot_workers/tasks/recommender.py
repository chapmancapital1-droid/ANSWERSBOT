from celery import shared_task
from ..db import session_scope
from ..recommendations.engine import generate
from ..recommendations.signals import BusinessSignals

@shared_task(name="answerspot_workers.tasks.recommender.generate_recommendations", acks_late=True)
def generate_recommendations(scan_id: str):
    with session_scope() as db:
        # TODO(M5): build BusinessSignals from scan_results for this business,
        # and load review_rate/review_count from the profile source.
        signals = BusinessSignals(business_name="", category="", city="", queries=[])
        result = generate(signals, review_rate=0.0, review_count=0)
        # TODO(M5): upsert VisibilityScore snapshot + replace OPEN recommendations.
        _ = (db, result)
    return {"scan_id": scan_id}
