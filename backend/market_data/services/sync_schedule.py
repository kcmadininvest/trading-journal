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
    HistoricalSyncRun,
    HistoricalSyncSchedulerState,
    HistoricalSyncSettings,
    HistoricalSyncTarget,
    SyncRunStatus,
)
from market_data.services.download_dispatch import (
    abandon_stale_pending_jobs,
    abandon_stale_running_jobs,
    dispatch_historical_download,
)
from market_data.services.timeframes import UnknownTimeframe, parse_timeframe

logger = logging.getLogger(__name__)

BOOTSTRAP_LOOKBACK_DAYS = 7
# Fenêtre de déclenchement alignée sur le timer systemd (15 min).
DUE_WINDOW_MINUTES = 14
# Au-delà, le timer système ne tourne probablement plus.
SCHEDULER_STALE_MINUTES = 25
# Statuts de job qui bloquent la conclusion d'un run.
ACTIVE_JOB_STATUSES = (
    HistoricalDownloadJob.Status.PENDING,
    HistoricalDownloadJob.Status.RUNNING,
)


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
        status__in=ACTIVE_JOB_STATUSES,
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
    dispatch: bool = True,
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
    if dispatch:
        dispatch_historical_download(job.id)
    return job


def _purge_old_runs(user) -> None:
    stale_ids = list(
        HistoricalSyncRun.objects.filter(user=user)
        .values_list('id', flat=True)[HistoricalSyncRun.MAX_RUNS_PER_USER:],
    )
    if stale_ids:
        HistoricalSyncRun.objects.filter(id__in=stale_ids).delete()


def _start_run(user, *, trigger: str, started_at: datetime) -> HistoricalSyncRun:
    run = HistoricalSyncRun.objects.create(
        user=user,
        trigger=trigger,
        status=SyncRunStatus.RUNNING,
        started_at=started_at,
    )
    _purge_old_runs(user)
    return run


def _mirror_run_to_settings(
    settings_obj: HistoricalSyncSettings,
    run: HistoricalSyncRun,
    *,
    local_date: date | None = None,
) -> None:
    """Recopie l'état du run sur le profil (source de l'API sync-settings)."""
    settings_obj.last_run_at = run.started_at
    settings_obj.last_finished_at = run.finished_at
    settings_obj.last_status = run.status
    settings_obj.last_sync_job_ids = list(run.job_ids or [])
    settings_obj.last_error = run.error
    fields = [
        'last_run_at',
        'last_finished_at',
        'last_status',
        'last_sync_job_ids',
        'last_error',
        'updated_at',
    ]
    if local_date is not None:
        settings_obj.last_run_local_date = local_date
        fields.append('last_run_local_date')
    settings_obj.save(update_fields=fields)


def _conclude_run(
    run: HistoricalSyncRun,
    *,
    status: str,
    error: str = '',
    bars_fetched_total: int = 0,
) -> bool:
    """
    Marque le run comme terminé. False si un autre appel l'a déjà conclu.

    Deux jobs qui finissent en parallèle peuvent tenter la conclusion en même
    temps — seul le premier update (filtré sur ``running``) l'emporte.
    """
    finished_at = timezone.now()
    updated = HistoricalSyncRun.objects.filter(
        pk=run.pk,
        status=SyncRunStatus.RUNNING,
    ).update(
        status=status,
        error=error[:2000],
        bars_fetched_total=bars_fetched_total,
        finished_at=finished_at,
    )
    if not updated:
        return False
    run.status = status
    run.error = error[:2000]
    run.bars_fetched_total = bars_fetched_total
    run.finished_at = finished_at
    return True


def finalize_sync_status_for_job(job: HistoricalDownloadJob) -> HistoricalSyncRun | None:
    """
    Conclut le run de sync auquel appartient ``job``, si tous ses jobs sont terminés.

    Succès = chaque job terminé avec des bougies récupérées et sans erreur.
    """
    candidates = HistoricalSyncRun.objects.filter(
        user_id=job.user_id,
        status=SyncRunStatus.RUNNING,
    )[:20]
    run = next((r for r in candidates if job.id in (r.job_ids or [])), None)
    if run is None:
        return None

    jobs = list(HistoricalDownloadJob.objects.filter(id__in=run.job_ids or []))
    if any(j.status in ACTIVE_JOB_STATUSES for j in jobs):
        return None

    messages = [run.error] if run.error else []
    total_bars = sum(j.bars_fetched or 0 for j in jobs)
    for j in jobs:
        label = f'{j.instrument}/{j.timeframe}'
        if j.status == HistoricalDownloadJob.Status.COMPLETED:
            if (j.bars_fetched or 0) == 0:
                messages.append(
                    f'{label}: aucune bougie récupérée '
                    f'({j.error or "réponse vide du fournisseur"}).',
                )
            elif j.error:
                messages.append(f'{label}: {j.error}')
        else:
            messages.append(f'{label}: {j.error or j.get_status_display()}')

    status = SyncRunStatus.ERROR if messages else SyncRunStatus.SUCCESS
    if not _conclude_run(
        run,
        status=status,
        error='; '.join(messages),
        bars_fetched_total=total_bars,
    ):
        return None

    settings_obj = HistoricalSyncSettings.objects.filter(user_id=job.user_id).first()
    if settings_obj is not None and _is_latest_run(run):
        _mirror_run_to_settings(settings_obj, run)
    logger.info(
        'Historical sync run %s concluded status=%s bars=%s',
        run.pk, run.status, run.bars_fetched_total,
    )
    return run


def _is_latest_run(run: HistoricalSyncRun) -> bool:
    latest_id = (
        HistoricalSyncRun.objects.filter(user_id=run.user_id)
        .values_list('id', flat=True)
        .first()
    )
    return latest_id == run.pk


def run_sync_for_settings(
    settings_obj: HistoricalSyncSettings,
    *,
    force: bool = False,
    trigger: str | None = None,
    now_utc: datetime | None = None,
    allow_inline: bool = False,
) -> dict[str, Any]:
    """
    Enqueue les jobs pour toutes les cibles du profil et ouvre un run traçable.

    force=True ignore la fenêtre horaire / last_run (run-now UI).
    allow_inline=True fait exécuter les téléchargements par l'appelant quand
    aucun worker Celery n'est disponible (tick systemd, processus éphémère).
    """
    user = settings_obj.user
    job_trigger = trigger or (
        HistoricalDownloadJob.Trigger.MANUAL
        if force
        else HistoricalDownloadJob.Trigger.SCHEDULED
    )
    started_at = timezone.now()

    if user_has_active_download(user):
        # Rien n'a été exécuté : pas de run, et surtout pas d'écrasement du
        # statut du run réellement en cours (l'appelant renvoie un 409 explicite).
        return {'skipped': True, 'reason': 'active_job', 'jobs': []}

    targets = list(settings_obj.targets.all())
    if not targets:
        msg = 'Aucune cible de synchronisation configurée.'
        run = _start_run(user, trigger=job_trigger, started_at=started_at)
        _conclude_run(run, status=SyncRunStatus.ERROR, error=msg)
        _mirror_run_to_settings(settings_obj, run)
        return {'skipped': True, 'reason': 'no_targets', 'jobs': [], 'run': run}

    run = _start_run(user, trigger=job_trigger, started_at=started_at)
    jobs: list[HistoricalDownloadJob] = []
    errors: list[str] = []

    for target in targets:
        try:
            job = enqueue_target_job(
                user,
                target,
                trigger=job_trigger,
                now_utc=now_utc,
                dispatch=False,
            )
            if job is not None:
                jobs.append(job)
        except Exception as exc:
            logger.exception('Failed enqueue sync target id=%s', target.pk)
            errors.append(f'{target.instrument}/{target.timeframe}: {exc}')

    local_date = local_now_for_user(user, now_utc=now_utc).date()
    error_text = '; '.join(errors)
    if jobs:
        # Les ids doivent être persistés avant le dispatch : un job exécuté en
        # thread peut se terminer immédiatement et chercher son run.
        run.job_ids = [j.id for j in jobs]
        run.error = error_text[:2000]
        run.save(update_fields=['job_ids', 'error'])
        _mirror_run_to_settings(settings_obj, run, local_date=local_date)
        for job in jobs:
            dispatch_historical_download(job.id, allow_inline=allow_inline)
    else:
        if errors:
            status = SyncRunStatus.ERROR
        else:
            status = SyncRunStatus.UP_TO_DATE
            error_text = ''
        _conclude_run(run, status=status, error=error_text)
        _mirror_run_to_settings(settings_obj, run, local_date=local_date)

    return {
        'skipped': False,
        'jobs': jobs,
        'job_ids': [j.id for j in jobs],
        'errors': errors,
        'run': run,
    }


def record_scheduler_tick(*, ran: int, not_due: int) -> HistoricalSyncSchedulerState:
    """Heartbeat du tick — permet de voir en UI si le timer système tourne."""
    state = HistoricalSyncSchedulerState.load()
    state.last_tick_at = timezone.now()
    state.last_tick_ran = ran
    state.last_tick_not_due = not_due
    state.save(update_fields=['last_tick_at', 'last_tick_ran', 'last_tick_not_due', 'updated_at'])
    return state


def scheduler_is_healthy(
    state: HistoricalSyncSchedulerState | None,
    *,
    now_utc: datetime | None = None,
) -> bool:
    if state is None or state.last_tick_at is None:
        return False
    now = now_utc or timezone.now()
    return (now - state.last_tick_at) <= timedelta(minutes=SCHEDULER_STALE_MINUTES)


def dispatch_due_historical_syncs(
    *,
    now_utc: datetime | None = None,
    allow_inline: bool = True,
) -> dict[str, Any]:
    """
    Point d'entrée du tick (manage.py / timer systemd).

    Le tick étant un processus éphémère, les téléchargements y sont exécutés
    en direct faute de worker Celery — sinon ils mourraient avec le processus.
    """
    # Un job bloqué maintient user_has_active_download à True et gèlerait la sync.
    abandon_stale_pending_jobs()
    abandon_stale_running_jobs()

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
        result = run_sync_for_settings(
            settings_obj,
            force=False,
            now_utc=now_utc,
            allow_inline=allow_inline,
        )
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

    record_scheduler_tick(ran=ran, not_due=skipped)
    return {'ran': ran, 'skipped_not_due': skipped, 'details': details}
