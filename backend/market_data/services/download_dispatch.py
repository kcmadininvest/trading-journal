"""Dispatch des jobs de téléchargement historique (Celery ou thread)."""
from __future__ import annotations

import logging
import threading
from datetime import timedelta

from django.db import close_old_connections
from django.utils import timezone

from market_data.models import HistoricalDownloadJob

logger = logging.getLogger(__name__)

# Jobs PENDING sans worker restent bloqués — abandon après ce délai.
STALE_PENDING_MINUTES = 2
# Jobs RUNNING sans heartbeat (updated_at) — abandon (thread mort / process redémarré).
STALE_RUNNING_MINUTES = 15


def celery_workers_available(timeout: float = 0.5) -> bool:
    """True si au moins un worker Celery de *cette* app répond au ping."""
    try:
        from trading_journal_api.celery import app

        inspector = app.control.inspect(timeout=timeout)
        if inspector is None:
            return False
        ping = inspector.ping()
        return bool(ping)
    except Exception as exc:
        logger.debug('Celery inspect failed: %s', exc)
        return False


def _finalize_sync_runs(job_ids: list[int]) -> None:
    """Conclut les runs de sync dont les jobs viennent d'être forcés en terminal."""
    if not job_ids:
        return
    try:
        from market_data.services.sync_schedule import finalize_sync_status_for_job

        for job in HistoricalDownloadJob.objects.filter(id__in=job_ids):
            finalize_sync_status_for_job(job)
    except Exception:
        logger.exception('Failed to finalize sync runs for jobs %s', job_ids)


def abandon_stale_pending_jobs(*, older_than_minutes: int = STALE_PENDING_MINUTES) -> int:
    """Marque en failed les jobs PENDING trop anciens (pas de worker / file morte)."""
    cutoff = timezone.now() - timedelta(minutes=older_than_minutes)
    qs = HistoricalDownloadJob.objects.filter(
        status=HistoricalDownloadJob.Status.PENDING,
        created_at__lt=cutoff,
    )
    job_ids = list(qs.values_list('id', flat=True))
    updated = qs.update(
        status=HistoricalDownloadJob.Status.FAILED,
        error='Téléchargement abandonné : aucun worker n’a pris en charge le job.',
        finished_at=timezone.now(),
    )
    _finalize_sync_runs(job_ids)
    return updated


def abandon_stale_running_jobs(*, older_than_minutes: int = STALE_RUNNING_MINUTES) -> int:
    """Marque en failed les jobs RUNNING sans mise à jour récente."""
    cutoff = timezone.now() - timedelta(minutes=older_than_minutes)
    qs = HistoricalDownloadJob.objects.filter(
        status=HistoricalDownloadJob.Status.RUNNING,
        updated_at__lt=cutoff,
    )
    job_ids = list(qs.values_list('id', flat=True))
    updated = qs.update(
        status=HistoricalDownloadJob.Status.FAILED,
        error='Téléchargement abandonné : job bloqué (plus de progression).',
        finished_at=timezone.now(),
    )
    _finalize_sync_runs(job_ids)
    return updated


def cancel_active_jobs_for_user(user, *, reason: str = '') -> int:
    """Annule les jobs PENDING/RUNNING de l’utilisateur (relance / stop manuel)."""
    msg = (reason or 'Téléchargement annulé.').strip()[:2000]
    qs = HistoricalDownloadJob.objects.filter(
        user=user,
        status__in=[
            HistoricalDownloadJob.Status.PENDING,
            HistoricalDownloadJob.Status.RUNNING,
        ],
    )
    job_ids = list(qs.values_list('id', flat=True))
    updated = qs.update(
        status=HistoricalDownloadJob.Status.CANCELLED,
        error=msg,
        finished_at=timezone.now(),
    )
    _finalize_sync_runs(job_ids)
    return updated


def _run_download_job_safe(job_id: int) -> None:
    close_old_connections()
    try:
        from market_data.services.downloader import run_download_job

        run_download_job(job_id)
    except Exception:
        logger.exception('Download job %s failed in background thread', job_id)
    finally:
        close_old_connections()


def run_download_job_in_thread(job_id: int) -> None:
    """Exécute le téléchargement hors requête HTTP (processus web sans Celery worker)."""
    thread = threading.Thread(
        target=_run_download_job_safe,
        args=(job_id,),
        name=f'historical-download-{job_id}',
        daemon=True,
    )
    thread.start()
    logger.info('Historical download job %s started in background thread', job_id)


def dispatch_historical_download(job_id: int, *, allow_inline: bool = False) -> str:
    """
    Enqueue via Celery si un worker trading_journal est dispo, sinon exécute.

    ``allow_inline`` est réservé aux processus éphémères (tick systemd oneshot) :
    un thread daemon y serait tué dès la fin de la commande, laissant le job
    bloqué en pending. L'appelant attend donc la fin du téléchargement.

    Returns:
        ``'celery'``, ``'inline'`` ou ``'thread'`` selon le mode choisi.
    """
    if celery_workers_available():
        try:
            from market_data.tasks import run_historical_download

            run_historical_download.delay(job_id)
            logger.info('Historical download job %s queued on Celery', job_id)
            return 'celery'
        except Exception as exc:
            logger.warning(
                'Celery enqueue failed for job %s, falling back to local run: %s',
                job_id, exc,
            )

    if allow_inline:
        logger.info('Historical download job %s run inline (no Celery worker)', job_id)
        _run_download_job_safe(job_id)
        return 'inline'

    run_download_job_in_thread(job_id)
    return 'thread'
