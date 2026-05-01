import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def process_stripe_event_async(self, event_id: str, event_type: str):
    """
    Hook async léger pour post-traitements webhook.
    Les actions métier lourdes (emails, analytics) peuvent être ajoutées ici.
    """
    logger.info('Stripe webhook post-processing queued: %s (%s)', event_id, event_type)

