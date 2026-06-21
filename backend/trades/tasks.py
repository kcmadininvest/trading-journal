"""Tâches Celery pour préchauffage du cache stats."""
from __future__ import annotations

import logging
from datetime import date, timedelta

from celery import shared_task
from django.contrib.auth import get_user_model
from django.test import RequestFactory
from django.utils import timezone

logger = logging.getLogger(__name__)
User = get_user_model()

WARM_DEBOUNCE_SECONDS = 2
ROLLUP_DEBOUNCE_SECONDS = 3


def schedule_debounced_stats_invalidation(user_id: int) -> None:
    """Invalidation + warm cache debounced (imports bulk)."""
    from django.core.cache import cache

    from trades.stats_response_cache import invalidate_user_stats_cache

    debounce_key = f'stats_invalidate_scheduled:{user_id}'
    if cache.add(debounce_key, 1, timeout=ROLLUP_DEBOUNCE_SECONDS):
        invalidate_user_stats_cache_delayed.apply_async(
            args=[user_id],
            countdown=ROLLUP_DEBOUNCE_SECONDS,
        )


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def invalidate_user_stats_cache_delayed(self, user_id: int) -> None:
    from trades.stats_response_cache import invalidate_user_stats_cache

    invalidate_user_stats_cache(user_id)
    schedule_warm_stats_cache(user_id)


def schedule_debounced_rollup_rebuild(user_id: int, buckets) -> None:
    """Accumule les buckets rollup et planifie un recalcul debounced."""
    from django.core.cache import cache

    if not buckets:
        return

    pending_key = f'rollup_pending:{user_id}'
    existing = cache.get(pending_key) or []
    merged = {tuple(b) for b in existing}
    merged.update(tuple(b) for b in buckets)
    cache.set(pending_key, [list(b) for b in merged], timeout=120)

    debounce_key = f'rollup_rebuild_scheduled:{user_id}'
    if cache.add(debounce_key, 1, timeout=ROLLUP_DEBOUNCE_SECONDS):
        rebuild_pending_rollups.apply_async(args=[user_id], countdown=ROLLUP_DEBOUNCE_SECONDS)


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def rebuild_pending_rollups(self, user_id: int) -> None:
    from django.core.cache import cache

    from trades.services.rollup_service import recalculate_rollup_bucket

    pending_key = f'rollup_pending:{user_id}'
    pending = cache.get(pending_key) or []
    cache.delete(pending_key)

    for account_id, trade_day, strategy_root_id in pending:
        try:
            recalculate_rollup_bucket(user_id, account_id, trade_day, strategy_root_id)
        except Exception as exc:
            logger.warning(
                'Rollup debounced rebuild failed user=%s bucket=%s/%s/%s: %s',
                user_id,
                account_id,
                trade_day,
                strategy_root_id,
                exc,
            )

    schedule_debounced_stats_invalidation(user_id)


def schedule_warm_stats_cache(user_id: int) -> None:
    """Debounced enqueue — une seule tâche par fenêtre de 2 s par utilisateur."""
    from django.core.cache import cache

    debounce_key = f'stats_warm_scheduled:{user_id}'
    if cache.add(debounce_key, 1, timeout=WARM_DEBOUNCE_SECONDS):
        warm_stats_cache_for_user.apply_async(args=[user_id], countdown=WARM_DEBOUNCE_SECONDS)


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def warm_stats_cache_for_user(self, user_id: int) -> None:
    """
    Préchauffe Redis pour les presets fréquents (7j, 30j, 90j, YTD, all-time).
    """
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return

    from trades.stats_response_cache import set_cached_stats_response
    from trades.services.dashboard_summary_service import compute_dashboard_summary_payload
    from trades.services.stats_bundle_service import compute_stats_bundle_payload

    today = timezone.localdate()
    presets = [
        ('7d', today - timedelta(days=7), today),
        ('30d', today - timedelta(days=30), today),
        ('90d', today - timedelta(days=90), today),
        ('ytd', date(today.year, 1, 1), today),
        ('all', None, None),
    ]

    factory = RequestFactory()
    warmed = 0

    viewset_params = {
        'trading_account': '',
        'start_date': '',
        'end_date': '',
        'year': '',
        'month': '',
        'position_strategy': '',
        'pnl_display': 'net',
        'convert_to': '',
    }

    for _label, start, end in presets:
        params = {
            'trading_account': '',
            'start_date': start.isoformat() if start else '',
            'end_date': end.isoformat() if end else '',
            'position_strategy': '',
            'pnl_display': 'net',
        }
        request = factory.get('/api/trades/dashboard-summary/', params)
        request.user = user
        try:
            payload = compute_dashboard_summary_payload(request)
            set_cached_stats_response(user_id, 'dashboard_summary', params, payload)
            warmed += 1
        except Exception as exc:
            logger.warning('Warm cache preset failed user=%s: %s', user_id, exc)

        bundle_params = {
            **viewset_params,
            'start_date': start.isoformat() if start else '',
            'end_date': end.isoformat() if end else '',
        }
        bundle_request = factory.get('/api/trades/stats-bundle/', bundle_params)
        bundle_request.user = user
        try:
            bundle_payload = compute_stats_bundle_payload(bundle_request)
            set_cached_stats_response(user_id, 'stats-bundle', bundle_params, bundle_payload)
            warmed += 1
        except Exception as exc:
            logger.warning('Warm stats-bundle preset failed user=%s: %s', user_id, exc)

    logger.info('Stats cache warmed for user=%s (%s presets)', user_id, warmed)
