from __future__ import annotations

import math
import logging
from datetime import datetime
from typing import Any, Dict, Optional, Tuple

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext as _

from .models import BillingPlatformSettings, CustomerSubscription, StripeWebhookEvent
from .tasks import process_stripe_event_async

User = get_user_model()
logger = logging.getLogger(__name__)


def _configure_stripe() -> None:
    try:
        import stripe
    except ImportError as exc:
        raise ValueError(_('Stripe SDK is not installed.')) from exc

    stripe.api_key = settings.STRIPE_SECRET_KEY


def _as_datetime(timestamp: Optional[int]):
    if not timestamp:
        return None
    return datetime.fromtimestamp(timestamp, tz=timezone.utc)


def _as_mapping(payload: Any) -> Dict[str, Any]:
    """
    Normalise un objet Stripe (StripeObject) ou un dict Python en dict standard.
    """
    if isinstance(payload, dict):
        return payload
    if payload is None:
        return {}

    stripe_internal_data = getattr(payload, '_data', None)
    if isinstance(stripe_internal_data, dict) and stripe_internal_data:
        return stripe_internal_data

    to_dict_recursive = getattr(payload, 'to_dict_recursive', None)
    if callable(to_dict_recursive):
        mapped = to_dict_recursive()
        if isinstance(mapped, dict):
            return mapped
    return {}


def _subscription_defaults_from_stripe(
    stripe_subscription: Any,
    stripe_customer_id: str,
) -> Dict[str, Any]:
    subscription_data = _as_mapping(stripe_subscription)
    items = _as_mapping(subscription_data.get('items')).get('data', [])
    first_item = items[0] if items else {}
    price_id = _as_mapping(_as_mapping(first_item).get('price')).get('id', '')

    trial_end = _as_datetime(subscription_data.get('trial_end'))
    current_period_end = _as_datetime(subscription_data.get('current_period_end'))
    # En mode trialing, certains payloads peuvent ne pas renseigner current_period_end.
    if current_period_end is None and trial_end is not None:
        current_period_end = trial_end

    return {
        'stripe_customer_id': stripe_customer_id,
        'stripe_price_id': price_id or '',
        'status': subscription_data.get('status', CustomerSubscription.STATUS_INCOMPLETE),
        'current_period_start': _as_datetime(subscription_data.get('current_period_start')),
        'current_period_end': current_period_end,
        'cancel_at_period_end': bool(subscription_data.get('cancel_at_period_end', False)),
        'canceled_at': _as_datetime(subscription_data.get('canceled_at')),
        'metadata': _as_mapping(subscription_data.get('metadata')) or {},
    }


def _get_or_create_customer_id(user) -> str:
    existing_subscription = (
        CustomerSubscription.objects.filter(user=user)
        .exclude(stripe_customer_id='')
        .order_by('-updated_at')
        .first()
    )
    if existing_subscription:
        return existing_subscription.stripe_customer_id

    _configure_stripe()
    import stripe

    customer = stripe.Customer.create(
        email=user.email,
        name=user.get_full_name() or user.email,
        metadata={'user_id': str(user.id)},
    )
    return customer.id


def create_checkout_session(user) -> Tuple[str, str]:
    if getattr(user, 'is_admin', False):
        raise ValueError(_('Administrators are not eligible for subscription checkout.'))
    if not settings.STRIPE_SECRET_KEY or not settings.STRIPE_PRICE_PREMIUM_ID:
        raise ValueError(_('Stripe is not configured correctly.'))

    _configure_stripe()
    import stripe

    customer_id = _get_or_create_customer_id(user)
    trial_days = BillingPlatformSettings.get_solo().trial_period_days

    success_url = f'{settings.FRONTEND_URL}/#billing-success?session_id={{CHECKOUT_SESSION_ID}}'
    cancel_url = f'{settings.FRONTEND_URL}/#billing-cancel'

    checkout_session = stripe.checkout.Session.create(
        mode='subscription',
        customer=customer_id,
        line_items=[{'price': settings.STRIPE_PRICE_PREMIUM_ID, 'quantity': 1}],
        success_url=success_url,
        cancel_url=cancel_url,
        client_reference_id=str(user.id),
        metadata={'user_id': str(user.id)},
        subscription_data={
            'trial_period_days': trial_days,
            'metadata': {'user_id': str(user.id)},
        },
        allow_promotion_codes=True,
    )
    return checkout_session.id, checkout_session.url


def create_portal_session(user) -> str:
    if getattr(user, 'is_admin', False):
        raise ValueError(_('Administrators do not need a billing portal.'))
    if not settings.STRIPE_SECRET_KEY:
        raise ValueError(_('Stripe is not configured correctly.'))

    _configure_stripe()
    import stripe

    customer_id = _get_or_create_customer_id(user)
    portal_session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f'{settings.FRONTEND_URL}/#settings',
    )
    return portal_session.url


def _find_user_for_subscription_payload(subscription_payload: Dict[str, Any]):
    subscription_payload = _as_mapping(subscription_payload)
    metadata_user_id = (subscription_payload.get('metadata') or {}).get('user_id')
    if metadata_user_id:
        try:
            return User.objects.get(pk=int(metadata_user_id))
        except (User.DoesNotExist, ValueError, TypeError):
            pass

    stripe_customer_id = subscription_payload.get('customer')
    if stripe_customer_id:
        existing = (
            CustomerSubscription.objects.filter(stripe_customer_id=stripe_customer_id)
            .order_by('-updated_at')
            .first()
        )
        if existing:
            return existing.user
    return None


@transaction.atomic
def upsert_subscription_from_payload(subscription_payload: Dict[str, Any]):
    subscription_payload = _as_mapping(subscription_payload)
    stripe_subscription_id = subscription_payload.get('id')
    stripe_customer_id = subscription_payload.get('customer')
    if not stripe_subscription_id or not stripe_customer_id:
        return None

    user = _find_user_for_subscription_payload(subscription_payload)
    if not user:
        return None

    defaults = _subscription_defaults_from_stripe(subscription_payload, stripe_customer_id)
    defaults['is_current'] = True

    CustomerSubscription.objects.filter(user=user, is_current=True).exclude(
        stripe_subscription_id=stripe_subscription_id
    ).update(is_current=False)

    subscription, _ = CustomerSubscription.objects.update_or_create(
        stripe_subscription_id=stripe_subscription_id,
        defaults={
            'user': user,
            **defaults,
        },
    )
    return subscription


@transaction.atomic
def process_checkout_completed(checkout_session_payload: Dict[str, Any]):
    checkout_session_payload = _as_mapping(checkout_session_payload)
    subscription_id = checkout_session_payload.get('subscription')
    customer_id = checkout_session_payload.get('customer')
    if not subscription_id or not customer_id:
        return

    user_id = (
        (checkout_session_payload.get('metadata') or {}).get('user_id')
        or checkout_session_payload.get('client_reference_id')
    )
    if not user_id:
        return

    try:
        user = User.objects.get(pk=int(user_id))
    except (User.DoesNotExist, ValueError, TypeError):
        return

    _configure_stripe()
    import stripe

    stripe_subscription = stripe.Subscription.retrieve(subscription_id)
    defaults = _subscription_defaults_from_stripe(stripe_subscription, customer_id)
    defaults['is_current'] = True

    CustomerSubscription.objects.filter(user=user, is_current=True).exclude(
        stripe_subscription_id=subscription_id
    ).update(is_current=False)

    CustomerSubscription.objects.update_or_create(
        stripe_subscription_id=subscription_id,
        defaults={
            'user': user,
            **defaults,
        },
    )


@transaction.atomic
def process_stripe_event(event: Dict[str, Any]) -> bool:
    event = _as_mapping(event)
    event_id = event.get('id')
    event_type = event.get('type')
    if not event_id or not event_type:
        return False

    existing = StripeWebhookEvent.objects.filter(event_id=event_id).first()
    if existing and existing.processed:
        return False

    record, _ = StripeWebhookEvent.objects.get_or_create(
        event_id=event_id,
        defaults={
            'event_type': event_type,
            'payload': event,
        },
    )
    if record.processed:
        return False

    payload = event.get('data', {}).get('object', {})

    if event_type == 'checkout.session.completed':
        process_checkout_completed(payload)
    elif event_type in {
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
    }:
        upsert_subscription_from_payload(payload)
    elif event_type in {'invoice.payment_succeeded', 'invoice.payment_failed'}:
        subscription_payload = payload.get('subscription_details') or {}
        if isinstance(subscription_payload, dict) and subscription_payload.get('subscription'):
            # Fallback noop; invoice event alone does not always include enough fields.
            pass

    record.event_type = event_type
    record.processed = True
    record.processed_at = timezone.now()
    record.payload = event
    record.save(update_fields=['event_type', 'processed', 'processed_at', 'payload'])

    try:
        process_stripe_event_async.delay(event_id=event_id, event_type=event_type)
    except Exception as exc:
        # Ne jamais faire échouer le webhook Stripe si Redis/Celery est indisponible.
        # Les mises à jour critiques d'abonnement sont déjà persistées en base.
        logger.warning(
            'Unable to enqueue Stripe async post-processing for event %s (%s): %s',
            event_id,
            event_type,
            exc,
        )
    return True


def get_subscription_state_for_user(user) -> Dict[str, Any]:
    if getattr(user, 'is_admin', False):
        return {
            'access_state': 'admin_bypass',
            'trial_days_left': 0,
            'can_subscribe': False,
            'checkout_enabled': False,
            'status': 'admin_bypass',
        }

    current = (
        CustomerSubscription.objects.filter(user=user, is_current=True)
        .order_by('-updated_at')
        .first()
    )
    if not current:
        return {
            'access_state': 'inactive',
            'trial_days_left': 0,
            'can_subscribe': True,
            'checkout_enabled': bool(settings.STRIPE_SECRET_KEY and settings.STRIPE_PRICE_PREMIUM_ID),
            'status': 'inactive',
        }

    trial_days_left = 0
    if current.status == CustomerSubscription.STATUS_TRIALING:
        period_end = current.current_period_end
        if period_end is None and settings.STRIPE_SECRET_KEY and current.stripe_subscription_id:
            try:
                _configure_stripe()
                import stripe

                stripe_subscription = stripe.Subscription.retrieve(current.stripe_subscription_id)
                refreshed_data = _subscription_defaults_from_stripe(
                    stripe_subscription,
                    current.stripe_customer_id,
                )
                period_end = refreshed_data.get('current_period_end')
                if period_end and period_end != current.current_period_end:
                    current.current_period_end = period_end
                    current.save(update_fields=['current_period_end', 'updated_at'])
            except Exception as exc:
                logger.warning(
                    'Unable to refresh Stripe trial end for subscription %s: %s',
                    current.stripe_subscription_id,
                    exc,
                )
        if period_end:
            seconds_left = (period_end - timezone.now()).total_seconds()
            trial_days_left = max(0, int(math.ceil(seconds_left / 86400)))

    if current.status == CustomerSubscription.STATUS_TRIALING:
        access_state = 'trialing'
    elif current.status == CustomerSubscription.STATUS_ACTIVE:
        access_state = 'active'
    else:
        access_state = 'inactive'

    return {
        'access_state': access_state,
        'trial_days_left': trial_days_left,
        'can_subscribe': access_state != 'active',
        'checkout_enabled': bool(settings.STRIPE_SECRET_KEY and settings.STRIPE_PRICE_PREMIUM_ID),
        'status': current.status,
        'current_period_end': current.current_period_end,
        'cancel_at_period_end': current.cancel_at_period_end,
    }

