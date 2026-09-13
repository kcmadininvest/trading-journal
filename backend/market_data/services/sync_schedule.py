"""Planification quotidienne des syncs historiques (profil par utilisateur)."""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.db.models import Max
from django.utils import timezone

from market_data.models import (
    HistoricalBar,
    HistoricalDownloadJob,
    HistoricalSyncSettings,
    HistoricalSyncTarget,
)
from market_data.services.download_dispatch import dispatch_historical_download
from market_data.services.timeframes import UnknownTimeframe, parse_timeframe

logger = logging.getLogger(__name__)

BOOTSTRAP_LOOKBACK_DAYS = 7
# Fenêtre de déclenchement alignée sur le timer systemd (15 min).
DUE_WINDOW_MINUTES = 14


def user_timezone_name(user) -> str:
    prefs = getattr(user, 'preferences', None)
    tz_name = getattr(prefs, 'timezone', None) if prefs is not None else None
    return (tz_name or 'Europe/Paris').strip() or 'Europe/Paris'


def resolve_zoneinfo(tz_name: str) -> ZoneInfo:
    try:
        return ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        return ZoneInfo('Europe/Paris')


def local_now_for_user(user, *, now_utc: datetime | None = None) -> datetime:
    now = now_utc or timezone.now()
    if timezone.is_naive(now):
        now = timezone.make_aware(now, timezone.utc)
    return now.astimezone(resolve_zoneinfo(user_timezone_name(user)))


def is_settings_due(
    settings_obj: HistoricalSyncSettings,
    *,
    now_utc: datetime | None = None,
) -> bool:
    """True si enabled, dans la fenêtre horaire locale, et pas déjà run aujourd'hui."""
    if not settings_obj.enabled:
        return False
    local_now = local_now_for_user(settings_obj.user, now_utc=now_utc)
    today_local: date = local_now.date()
    if settings_obj.last_run_local_date == today_local:
        return False

    scheduled = local_now.replace(
        hour=int(settings_obj.hour) % 24,
        minute=int(settings_obj.minute) % 60,
        second=0,
        microsecond=0,
    )
    window_end = scheduled + timedelta(minutes=DUE_WINDOW_MINUTES)
    return scheduled <= local_now <= window_end


def user_has_active_download(user) -> bool:
    return HistoricalDownloadJob.objects.filter(
        user=user,
        status__in=[
            HistoricalDownloadJob.Status.PENDING,
            HistoricalDownloadJob.Status.RUNNING,
        ],
    ).exists()


def last_stored_timestamp(
    *,
    instrument: str,
    timeframe: str,
    contract_id: str = '',
) -> datetime | None:
    qs = HistoricalBar.objects.filter(
        instrument=instrument.upper().strip(),
        timeframe=timeframe,
    )
    cid = (contract_id or '').strip()
    if cid:
        qs = qs.filter(contract_id=cid)
    return qs.aggregate(m=Max('timestamp_utc'))['m']


def compute_sync_window(
    *,
    instrument: str,
    timeframe: str,
    contract_id: str = '',
    now_utc: datetime | None = None,
    bootstrap_days: int = BOOTSTRAP_LOOKBACK_DAYS,
) -> tuple[datetime, datetime] | None:
    """
    Retourne (start, end) UTC aware, ou None si rien à télécharger (déjà à jour).
    """
    end = now_utc or timezone.now()
    if timezone.is_naive(end):
        end = timezone.make_aware(end, timezone.utc)

    last_ts = last_stored_timestamp(
        instrument=instrument,
        timeframe=timeframe,
        contract_id=contract_id,
    )
    bootstrap_start = end - timedelta(days=bootstrap_days)
    if last_ts is None:
        start = bootstrap_start
    else:
        if timezone.is_naive(last_ts):
            last_ts = timezone.make_aware(last_ts, timezone.utc)
        # Reprendre juste après la dernière barre connue (gap-fill).
        start = last_ts + timedelta(seconds=1)
    if start >= end:
        return None
    return start, end


def enqueue_target_job(
    user,
    target: HistoricalSyncTarget,
    *,
    trigger: str = HistoricalDownloadJob.Trigger.SCHEDULED,
    now_utc: datetime | None = None,
) -> HistoricalDownloadJob | None:
    try:
        tf = parse_timeframe(target.timeframe).code
    except UnknownTimeframe:
        logger.warning('Sync target invalid timeframe=%s', target.timeframe)
        return None

    window = compute_sync_window(
        instrument=target.instrument,
        timeframe=tf,
        contract_id=target.contract_id,
        now_utc=now_utc,
    )
    if window is None:
        return None
    start, end = window

    job = HistoricalDownloadJob.objects.create(
        user=user,
        instrument=target.instrument.upper().strip(),
        contract_id=(target.contract_id or '').strip(),
        timeframe=tf,
        trigger=trigger,
        start_utc=start,
        end_utc=end,
        status=HistoricalDownloadJob.Status.PENDING,
    )
    dispatch_historical_download(job.id)
    return job


def run_sync_for_settings(
    settings_obj: HistoricalSyncSettings,
    *,
    force: bool = False,
    trigger: str | None = None,
    now_utc: datetime | None = None,
) -> dict[str, Any]:
    """
    Enqueue les jobs pour toutes les cibles du profil.

    force=True ignore la fenêtre horaire / last_run (run-now UI).
    """
    user = settings_obj.user
    if user_has_active_download(user):
        msg = 'Un téléchargement est déjà en cours — sync ignorée.'
        if force:
            settings_obj.last_error = msg
            settings_obj.save(update_fields=['last_error', 'updated_at'])
        return {'skipped': True, 'reason': 'active_job', 'jobs': []}

    targets = list(settings_obj.targets.all())
    if not targets:
        msg = 'Aucune cible de synchronisation configurée.'
        settings_obj.last_error = msg
        settings_obj.save(update_fields=['last_error', 'updated_at'])
        return {'skipped': True, 'reason': 'no_targets', 'jobs': []}

    job_trigger = trigger or (
        HistoricalDownloadJob.Trigger.MANUAL
        if force
        else HistoricalDownloadJob.Trigger.SCHEDULED
    )
    jobs: list[HistoricalDownloadJob] = []
    errors: list[str] = []

    for target in targets:
        try:
            job = enqueue_target_job(
                user,
                target,
                trigger=job_trigger,
                now_utc=now_utc,
            )
            if job is not None:
                jobs.append(job)
        except Exception as exc:
            logger.exception('Failed enqueue sync target id=%s', target.pk)
            errors.append(f'{target.instrument}/{target.timeframe}: {exc}')

    local_now = local_now_for_user(user, now_utc=now_utc)
    settings_obj.last_run_local_date = local_now.date()
    settings_obj.last_run_at = timezone.now()
    if errors:
        settings_obj.last_error = '; '.join(errors)[:2000]
    elif not jobs:
        settings_obj.last_error = 'Rien à synchroniser (données déjà à jour).'
    else:
        settings_obj.last_error = ''
    settings_obj.save(
        update_fields=['last_run_local_date', 'last_run_at', 'last_error', 'updated_at'],
    )
    return {
        'skipped': False,
        'jobs': jobs,
        'job_ids': [j.id for j in jobs],
        'errors': errors,
    }


def dispatch_due_historical_syncs(*, now_utc: datetime | None = None) -> dict[str, Any]:
    """Point d'entrée du tick (manage.py / timer systemd)."""
    qs = (
        HistoricalSyncSettings.objects.filter(enabled=True)
        .select_related('user', 'user__preferences')
        .prefetch_related('targets')
    )
    ran = 0
    skipped = 0
    details: list[dict[str, Any]] = []

    for settings_obj in qs:
        if not is_settings_due(settings_obj, now_utc=now_utc):
            skipped += 1
            continue
        result = run_sync_for_settings(settings_obj, force=False, now_utc=now_utc)
        ran += 1
        details.append({
            'user_id': settings_obj.user_id,
            'job_ids': result.get('job_ids', []),
            'skipped': result.get('skipped'),
            'reason': result.get('reason'),
        })
        logger.info(
            'Historical sync tick user=%s jobs=%s skipped=%s',
            settings_obj.user_id,
            result.get('job_ids'),
            result.get('skipped'),
        )

    return {'ran': ran, 'skipped_not_due': skipped, 'details': details}
