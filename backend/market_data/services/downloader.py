"""Téléchargement historique TopStepX — chunks, retry, reprise, skip complete."""
from __future__ import annotations

import logging
import random
import time
from datetime import datetime, timedelta, timezone
from typing import Callable

from django.conf import settings
from django.utils import timezone as django_tz

from integrations.topstepx_auth import get_topstepx_integration, get_valid_session_token
from integrations.topstepx_client import TopStepXApiClient, TopStepXApiError
from market_data.models import (
    BarCoverage,
    BarQualityIssue,
    HistoricalDownloadJob,
)
from market_data.services.contracts import (
    list_contracts_for_instrument,
    upsert_futures_contract,
)
from market_data.services.ingester import bulk_insert_bars
from market_data.services.normalizer import normalize_bars
from market_data.services.roll import get_roll_method
from market_data.services.timeframes import parse_timeframe
from market_data.services.validator import ValidationReport, validate_bars

logger = logging.getLogger(__name__)

# M1 : ~1440 barres/jour max ; rester largement sous 20k
DEFAULT_CHUNK = timedelta(days=1)
MAX_BARS_LIMIT = 20_000
HISTORY_TIMEOUT = 60
# Sim d'abord (souvent le seul historique dispo), puis live.
# Un [] n'est pas un succès : on enchaîne sur le mode suivant.
DEFAULT_LIVE_PREFERENCE: tuple[bool, ...] = (False, True)


def _sleep_backoff(attempt: int, *, rate_limited: bool = False) -> None:
    if rate_limited:
        delay = 30.0 + random.uniform(0, 5)
    else:
        delay = min(60.0, (2 ** attempt) + random.uniform(0, 1))
    time.sleep(delay)


def _complete_coverages_overlapping(
    contract_id: str,
    timeframe: str,
    start: datetime,
    end: datetime,
) -> list[tuple[datetime, datetime]]:
    """Plages déjà complete qui chevauchent [start, end)."""
    qs = BarCoverage.objects.filter(
        contract_id=contract_id,
        timeframe=timeframe,
        status=BarCoverage.Status.COMPLETE,
        start_utc__lt=end,
        end_utc__gt=start,
    ).order_by('start_utc')
    return [(c.start_utc, c.end_utc) for c in qs]


def _subtract_ranges(
    start: datetime,
    end: datetime,
    covered: list[tuple[datetime, datetime]],
) -> list[tuple[datetime, datetime]]:
    """Retourne les sous-plages de [start,end) non couvertes par covered."""
    gaps = [(start, end)]
    for c_start, c_end in covered:
        new_gaps: list[tuple[datetime, datetime]] = []
        for g_start, g_end in gaps:
            if c_end <= g_start or c_start >= g_end:
                new_gaps.append((g_start, g_end))
                continue
            if g_start < c_start:
                new_gaps.append((g_start, c_start))
            if c_end < g_end:
                new_gaps.append((c_end, g_end))
        gaps = new_gaps
    return [(a, b) for a, b in gaps if a < b]


def _iter_chunks(
    start: datetime,
    end: datetime,
    chunk: timedelta = DEFAULT_CHUNK,
):
    cur = start
    while cur < end:
        nxt = min(cur + chunk, end)
        yield cur, nxt
        cur = nxt


def _persist_coverage(
    *,
    instrument: str,
    contract_id: str,
    timeframe: str,
    start: datetime,
    end: datetime,
    report: ValidationReport,
    source: str,
) -> BarCoverage:
    # Remplacer les coverages chevauchantes du même contrat/tf
    BarCoverage.objects.filter(
        contract_id=contract_id,
        timeframe=timeframe,
        start_utc=start,
        end_utc=end,
    ).delete()
    return BarCoverage.objects.create(
        instrument=instrument,
        contract_id=contract_id,
        timeframe=timeframe,
        start_utc=start,
        end_utc=end,
        bars_stored=report.bars_stored,
        bars_expected=report.bars_expected,
        expected_gap_count=report.expected_gap_count,
        unexpected_missing_count=report.unexpected_missing_count,
        status=report.status,
        source=source,
        fetched_at=django_tz.now(),
    )


def _persist_issues(
    job: HistoricalDownloadJob | None,
    *,
    instrument: str,
    contract_id: str,
    timeframe: str,
    report: ValidationReport,
) -> None:
    if not report.issues:
        return
    objs = [
        BarQualityIssue(
            job=job,
            issue_type=issue.issue_type,
            severity=issue.severity,
            instrument=instrument,
            contract_id=contract_id,
            timeframe=timeframe,
            timestamp_utc=issue.timestamp_utc,
            details=issue.details or {},
        )
        for issue in report.issues
        # Ne pas spammer expected_gap en base (info déjà dans expected_gap_count)
        if issue.issue_type != 'expected_gap'
    ]
    if objs:
        BarQualityIssue.objects.bulk_create(objs, batch_size=500)


def _is_non_retryable_topstep_error(exc: TopStepXApiError) -> bool:
    """errorCode 1 / compte invalide : inutile de retenter (surtout en live)."""
    code = str(getattr(exc, 'error_code', '') or '')
    msg = str(exc).lower()
    return code == '1' or 'introuvable' in msg or 'invalide' in msg


def retrieve_bars_with_retry(
    client: TopStepXApiClient,
    auth_token: str,
    *,
    contract_id: str,
    start: datetime,
    end: datetime,
    live: bool,
    timeframe: str = '1m',
    max_attempts: int = 5,
) -> list[dict]:
    spec = parse_timeframe(timeframe)
    last_exc: Exception | None = None
    for attempt in range(max_attempts):
        try:
            return client.retrieve_bars(
                auth_token,
                contract_id=contract_id,
                live=live,
                start_time=start,
                end_time=end,
                unit=spec.unit,
                unit_number=spec.unit_number,
                limit=MAX_BARS_LIMIT,
                include_partial_bar=False,
            )
        except TopStepXApiError as exc:
            last_exc = exc
            if _is_non_retryable_topstep_error(exc):
                break
            rate_limited = (
                getattr(exc, 'error_code', None) in ('429', 'http_error')
                or '429' in str(exc)
                or 'rate' in str(exc).lower()
            )
            if attempt >= max_attempts - 1:
                break
            logger.warning(
                'retrieveBars retry attempt=%s contract=%s: %s',
                attempt + 1, contract_id, exc,
            )
            _sleep_backoff(attempt, rate_limited=rate_limited)
    assert last_exc is not None
    raise last_exc


def download_contract_range(
    client: TopStepXApiClient,
    get_token: Callable[[], str],
    *,
    instrument: str,
    contract_id: str,
    symbol: str,
    start: datetime,
    end: datetime,
    timeframe: str = '1m',
    job: HistoricalDownloadJob | None = None,
    live_preference: tuple[bool, ...] = DEFAULT_LIVE_PREFERENCE,
    live_modes: list[bool] | None = None,
    progress_offset: float = 0.0,
    progress_weight: float = 1.0,
) -> dict:
    """
    Télécharge [start, end) pour un contrat, skip des plages complete,
    upsert coverage + issues.

    progress_offset / progress_weight : part de la barre globale (multi-contrats).
    live_modes : liste mutable partagée pour désactiver live sur tout le job.
    """
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)

    covered = _complete_coverages_overlapping(contract_id, timeframe, start, end)
    todo = _subtract_ranges(start, end, covered)
    total_bars = 0
    chunks_done = 0
    source_used = 'topstepx_sim'
    # Modes live à tenter ; on retire live dès qu'il échoue de façon non retryable.
    if live_modes is None:
        live_modes = list(live_preference)

    def _job_cancelled() -> bool:
        if not job:
            return False
        job.refresh_from_db(fields=['status'])
        return job.status == HistoricalDownloadJob.Status.CANCELLED

    def _update_job_progress(sub_end: datetime) -> None:
        if not job:
            return
        elapsed = (sub_end - start).total_seconds()
        total_span = max(1.0, (end - start).total_seconds())
        local_pct = min(1.0, max(0.0, elapsed / total_span))
        overall = progress_offset + progress_weight * local_pct
        job.progress_pct = min(99, max(1, int(100 * overall)))
        job.save(update_fields=[
            'bars_fetched', 'chunks_done', 'last_chunk_end',
            'progress_pct', 'updated_at',
        ])

    for chunk_start, chunk_end in todo:
        for sub_start, sub_end in _iter_chunks(chunk_start, chunk_end):
            if _job_cancelled():
                return {
                    'bars_fetched': total_bars,
                    'chunks_done': chunks_done,
                    'source': source_used,
                    'cancelled': True,
                }

            # Skip si déjà complete (re-check)
            if _complete_coverages_overlapping(contract_id, timeframe, sub_start, sub_end):
                still = _subtract_ranges(
                    sub_start, sub_end,
                    _complete_coverages_overlapping(contract_id, timeframe, sub_start, sub_end),
                )
                if not still:
                    continue
                sub_start, sub_end = still[0]

            raw_bars: list[dict] = []
            source_used = 'topstepx_sim'
            last_err: Exception | None = None
            had_http_success = False
            for live in list(live_modes):
                try:
                    def _do_retrieve(token: str, _live=live, _s=sub_start, _e=sub_end):
                        return retrieve_bars_with_retry(
                            client, token,
                            contract_id=contract_id,
                            start=_s,
                            end=_e,
                            live=_live,
                            timeframe=timeframe,
                        )

                    token = get_token()
                    candidate = _do_retrieve(token)
                    had_http_success = True
                    source_used = 'topstepx_live' if live else 'topstepx_sim'
                    if candidate:
                        raw_bars = candidate
                        break
                    logger.debug(
                        'retrieveBars empty contract=%s live=%s range=%s→%s',
                        contract_id, live, sub_start, sub_end,
                    )
                except TopStepXApiError as exc:
                    last_err = exc
                    logger.warning(
                        'retrieveBars failed contract=%s live=%s: %s',
                        contract_id, live, exc,
                    )
                    if live and _is_non_retryable_topstep_error(exc) and True in live_modes:
                        live_modes[:] = [m for m in live_modes if m is not True]
                        logger.info(
                            'Live history indisponible pour ce compte — suite en sim uniquement.',
                        )
            # Échec dur seulement si aucun mode n'a répondu avec succès HTTP
            if not raw_bars and not had_http_success and last_err:
                report = validate_bars(
                    [],
                    instrument=instrument,
                    start_utc=sub_start,
                    end_utc=sub_end,
                    timeframe=timeframe,
                )
                _persist_coverage(
                    instrument=instrument,
                    contract_id=contract_id,
                    timeframe=timeframe,
                    start=sub_start,
                    end=sub_end,
                    report=report,
                    source=source_used,
                )
                _persist_issues(
                    job,
                    instrument=instrument,
                    contract_id=contract_id,
                    timeframe=timeframe,
                    report=report,
                )
                if job:
                    job.chunks_done += 1
                    job.last_chunk_end = sub_end
                    job.error = str(last_err)[:2000]
                    job.save(update_fields=[
                        'chunks_done', 'last_chunk_end', 'error', 'updated_at',
                    ])
                raise last_err

            bars, _failed = normalize_bars(raw_bars, instrument=instrument)
            report = validate_bars(
                bars,
                instrument=instrument,
                start_utc=sub_start,
                end_utc=sub_end,
                timeframe=timeframe,
            )
            inserted = bulk_insert_bars(
                bars,
                instrument=instrument,
                symbol=symbol,
                contract_id=contract_id,
                timeframe=timeframe,
                source=source_used,
            )
            # Le statut vient du validator (comparaison aux timestamps attendus).
            # bars_stored = barres soumises à l'insert (idempotent via ignore_conflicts).
            report.bars_stored = max(report.bars_stored, inserted)

            _persist_coverage(
                instrument=instrument,
                contract_id=contract_id,
                timeframe=timeframe,
                start=sub_start,
                end=sub_end,
                report=report,
                source=source_used,
            )
            _persist_issues(
                job,
                instrument=instrument,
                contract_id=contract_id,
                timeframe=timeframe,
                report=report,
            )

            total_bars += inserted
            chunks_done += 1
            if job:
                job.bars_fetched = (job.bars_fetched or 0) + inserted
                job.chunks_done = (job.chunks_done or 0) + 1
                job.last_chunk_end = sub_end
                _update_job_progress(sub_end)

            # Rate limit: ~50 / 30s → pause légère entre chunks
            time.sleep(0.7)

    # Fin de ce contrat : ancrer la progression au plafond de sa tranche
    if job and not _job_cancelled():
        job.progress_pct = min(99, int(round(100 * (progress_offset + progress_weight))))
        job.save(update_fields=['progress_pct', 'updated_at'])

    return {
        'bars_fetched': total_bars,
        'chunks_done': chunks_done,
        'source': source_used,
    }


def _finalize_sync_run(job: HistoricalDownloadJob) -> None:
    """Remonte l'issue du job vers le run de sync (jamais bloquant)."""
    try:
        from market_data.services.sync_schedule import finalize_sync_status_for_job

        finalize_sync_status_for_job(job)
    except Exception:
        logger.exception('Failed to finalize sync run for job %s', job.pk)


def run_download_job(job_id: int) -> None:
    """Point d'entrée Celery / synchrone pour un HistoricalDownloadJob."""
    job = HistoricalDownloadJob.objects.select_related('user').get(pk=job_id)
    if job.status == HistoricalDownloadJob.Status.CANCELLED:
        _finalize_sync_run(job)
        return

    job.status = HistoricalDownloadJob.Status.RUNNING
    job.started_at = django_tz.now()
    job.error = ''
    job.progress_pct = max(job.progress_pct or 0, 1)
    job.save(update_fields=['status', 'started_at', 'error', 'progress_pct', 'updated_at'])

    integration = get_topstepx_integration(job.user)
    if integration is None:
        job.status = HistoricalDownloadJob.Status.FAILED
        job.error = 'Intégration TopStepX introuvable pour cet utilisateur.'
        job.finished_at = django_tz.now()
        job.save(update_fields=['status', 'error', 'finished_at', 'updated_at'])
        _finalize_sync_run(job)
        return

    timeout = getattr(settings, 'TOPSTEPX_HISTORY_TIMEOUT_SECONDS', HISTORY_TIMEOUT)
    client = TopStepXApiClient(timeout=timeout)
    live_modes = list(DEFAULT_LIVE_PREFERENCE)

    def get_token() -> str:
        return get_valid_session_token(integration)

    def _cancelled() -> bool:
        job.refresh_from_db(fields=['status'])
        return job.status == HistoricalDownloadJob.Status.CANCELLED

    start = job.start_utc
    end = job.end_utc
    if job.last_chunk_end and job.last_chunk_end > start:
        start = job.last_chunk_end

    try:
        if job.contract_id:
            contracts = list_contracts_for_instrument(
                job.instrument,
                client=client,
                auth_token=get_token(),
                start=start.date(),
                end=end.date(),
            )
            match = next((c for c in contracts if c.contract_id == job.contract_id), None)
            if match:
                upsert_futures_contract(match)
                symbol = match.symbol
            else:
                symbol = job.contract_id
            if not _cancelled():
                download_contract_range(
                    client, get_token,
                    instrument=job.instrument,
                    contract_id=job.contract_id,
                    symbol=symbol,
                    start=start,
                    end=end,
                    timeframe=job.timeframe,
                    job=job,
                    live_modes=live_modes,
                )
        else:
            contracts = list_contracts_for_instrument(
                job.instrument,
                client=client,
                auth_token=get_token(),
                start=start.date(),
                end=end.date(),
            )
            by_id = {}
            for resolved in contracts:
                upsert_futures_contract(resolved)
                if resolved.expiry_date:
                    if resolved.expiry_date < start.date() - timedelta(days=90):
                        continue
                    if resolved.expiry_date > end.date() + timedelta(days=120):
                        continue
                by_id[resolved.contract_id] = resolved

            # Une fenêtre front par contrat (roll calendaire) — pas toute la période
            # sur chaque échéance (sinon des mois vides × N contrats).
            segments = get_roll_method('calendar').segments(
                list(by_id.values()), start, end,
            )
            n = max(1, len(segments))
            for i, seg in enumerate(segments):
                if _cancelled():
                    return
                resolved = by_id.get(seg.contract_id)
                symbol = resolved.symbol if resolved else seg.contract_id
                download_contract_range(
                    client, get_token,
                    instrument=job.instrument,
                    contract_id=seg.contract_id,
                    symbol=symbol,
                    start=seg.start,
                    end=seg.end,
                    timeframe=job.timeframe,
                    job=job,
                    live_modes=live_modes,
                    progress_offset=i / n,
                    progress_weight=1 / n,
                )

        job.refresh_from_db()
        if job.status == HistoricalDownloadJob.Status.CANCELLED:
            _finalize_sync_run(job)
            return

        if (job.bars_fetched or 0) == 0:
            # Run terminé sans donnée : pas un échec technique (souvent profondeur API limitée).
            job.status = HistoricalDownloadJob.Status.COMPLETED
            job.progress_pct = 100
            job.error = (
                'Aucune bougie reçue de TopStepX pour cette période. '
                'L’historique sim est souvent limité au contrat front récent ; '
                'l’historique live peut être indisponible sur ce compte API. '
                'Réessayez avec le contrat actif et une période récente (quelques jours).'
            )
            job.finished_at = django_tz.now()
            job.save(update_fields=[
                'status', 'progress_pct', 'error', 'finished_at', 'updated_at',
            ])
            _finalize_sync_run(job)
            return

        job.status = HistoricalDownloadJob.Status.COMPLETED
        job.progress_pct = 100
        job.error = ''
        job.finished_at = django_tz.now()
        job.save(update_fields=[
            'status', 'progress_pct', 'error', 'finished_at', 'updated_at',
        ])
        _finalize_sync_run(job)
    except Exception as exc:
        job.refresh_from_db(fields=['status'])
        if job.status == HistoricalDownloadJob.Status.CANCELLED:
            _finalize_sync_run(job)
            return
        logger.exception('Download job %s failed', job_id)
        job.status = HistoricalDownloadJob.Status.FAILED
        job.error = str(exc)[:2000]
        job.finished_at = django_tz.now()
        job.save(update_fields=['status', 'error', 'finished_at', 'updated_at'])
        _finalize_sync_run(job)
        raise
