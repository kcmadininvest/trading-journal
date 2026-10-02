"""Résumés des lancements manuels — une ligne par batch / instrument."""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from django.db.models import Count

from market_data.models import BarCoverage, BarQualityIssue, HistoricalDownloadJob
from market_data.services.timeframes import ALLOWED_TIMEFRAMES

MAX_LAUNCHES = 200
_EPOCH = datetime.min.replace(tzinfo=timezone.utc)

_SEVERITY_RANK = {
    BarQualityIssue.Severity.ERROR: 3,
    BarQualityIssue.Severity.WARNING: 2,
    BarQualityIssue.Severity.INFO: 1,
}

# Échantillon côté validateur — ne pas compter (les « manquantes » suffisent).
_EXCLUDED_ISSUE_TYPES = frozenset({
    BarQualityIssue.IssueType.GAP,
    BarQualityIssue.IssueType.EXPECTED_GAP,
})


def _job_timeframes(job: HistoricalDownloadJob) -> list[str]:
    raw = job.requested_timeframes or []
    if not raw:
        raw = [job.timeframe or '1m']
    wanted = {(str(x) or '').strip() for x in raw if str(x).strip()}
    return [code for code in ALLOWED_TIMEFRAMES if code in wanted] or list(wanted)


def _aggregate_job_status(statuses: list[str]) -> str:
    if not statuses:
        return HistoricalDownloadJob.Status.PENDING
    unique = set(statuses)
    if HistoricalDownloadJob.Status.RUNNING in unique:
        return HistoricalDownloadJob.Status.RUNNING
    if HistoricalDownloadJob.Status.PENDING in unique:
        return HistoricalDownloadJob.Status.PENDING
    if unique == {HistoricalDownloadJob.Status.COMPLETED}:
        return HistoricalDownloadJob.Status.COMPLETED
    failedish = {
        HistoricalDownloadJob.Status.FAILED,
        HistoricalDownloadJob.Status.CANCELLED,
    }
    if unique <= failedish:
        return HistoricalDownloadJob.Status.FAILED
    if HistoricalDownloadJob.Status.COMPLETED in unique and unique & failedish:
        return 'partial'
    return HistoricalDownloadJob.Status.FAILED


def _coverage_status(stored: int, expected: int, missing: int) -> str:
    if stored <= 0 and expected <= 0:
        return BarCoverage.Status.EMPTY
    if stored <= 0 and expected > 0:
        return BarCoverage.Status.EMPTY
    if missing == 0 and expected > 0:
        return BarCoverage.Status.COMPLETE
    if missing == 0 and stored > 0 and expected == 0:
        return BarCoverage.Status.COMPLETE
    return BarCoverage.Status.PARTIAL


def _dedupe_coverages(rows: list[BarCoverage]) -> list[BarCoverage]:
    """Une plage (contrat, tf, start, end) : garder la source la plus récente."""
    best: dict[tuple, BarCoverage] = {}
    for cov in rows:
        key = (cov.contract_id, cov.timeframe, cov.start_utc, cov.end_utc)
        prev = best.get(key)
        if prev is None or (cov.fetched_at or _EPOCH) >= (prev.fetched_at or _EPOCH):
            best[key] = cov
    return list(best.values())


def _sum_coverages(rows: list[BarCoverage]) -> dict[str, Any]:
    stored = sum(c.bars_stored or 0 for c in rows)
    expected = sum(c.bars_expected or 0 for c in rows)
    missing = sum(c.unexpected_missing_count or 0 for c in rows)
    complete = sum(1 for c in rows if c.status == BarCoverage.Status.COMPLETE)
    partial = sum(1 for c in rows if c.status == BarCoverage.Status.PARTIAL)
    return {
        'bars_stored': stored,
        'bars_expected': expected,
        'unexpected_missing_count': missing,
        'complete': complete,
        'partial': partial,
        'status': _coverage_status(stored, expected, missing) if rows else BarCoverage.Status.EMPTY,
    }


def _iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return dt.isoformat()


def _list_manual_batches(
    user,
    instrument: str | None = None,
    *,
    limit: int = MAX_LAUNCHES,
) -> list[dict[str, Any]]:
    """Construit les métadonnées des N derniers lancements manuels."""
    qs = HistoricalDownloadJob.objects.filter(
        user=user,
        trigger=HistoricalDownloadJob.Trigger.MANUAL,
        batch_id__isnull=False,
    )
    if instrument:
        qs = qs.filter(instrument=instrument.upper().strip())
    qs = qs.order_by('-created_at', '-id')

    order: list[UUID] = []
    seen: set[UUID] = set()
    for job in qs.iterator(chunk_size=500):
        bid = job.batch_id
        if bid is None or bid in seen:
            continue
        seen.add(bid)
        order.append(bid)
        if len(order) >= limit:
            break

    if not order:
        return []

    all_jobs = HistoricalDownloadJob.objects.filter(
        user=user,
        trigger=HistoricalDownloadJob.Trigger.MANUAL,
        batch_id__in=order,
    )
    if instrument:
        all_jobs = all_jobs.filter(instrument=instrument.upper().strip())

    batches: dict[UUID, list[HistoricalDownloadJob]] = defaultdict(list)
    for job in all_jobs:
        batches[job.batch_id].append(job)

    launches: list[dict[str, Any]] = []
    for bid in order:
        jobs = batches.get(bid) or []
        if not jobs:
            continue
        jobs_sorted = sorted(jobs, key=lambda j: (j.created_at, j.id))
        first = jobs_sorted[0]
        timeframes: list[str] = []
        seen_tf: set[str] = set()
        for job in jobs_sorted:
            for tf in _job_timeframes(job):
                if tf not in seen_tf:
                    seen_tf.add(tf)
                    timeframes.append(tf)
        launches.append({
            'batch_id': str(bid),
            'instrument': first.instrument,
            'contract_id': first.contract_id or '',
            'timeframes': timeframes,
            'start_utc': min(j.start_utc for j in jobs_sorted),
            'end_utc': max(j.end_utc for j in jobs_sorted),
            'launched_at': min(j.created_at for j in jobs_sorted),
            'job_status': _aggregate_job_status([j.status for j in jobs_sorted]),
            'job_ids': [j.id for j in jobs_sorted],
        })
    return launches


def _load_coverages_for_launches(
    user,
    launches: list[dict[str, Any]],
) -> dict[str, list[BarCoverage]]:
    """Charge en une requête les coverages utiles, ventilées par batch_id."""
    if not launches:
        return {}

    instruments = {row['instrument'] for row in launches}
    qs = BarCoverage.objects.filter(user=user, instrument__in=instruments)
    # Borne large : union des périodes
    min_start = min(row['start_utc'] for row in launches)
    max_end = max(row['end_utc'] for row in launches)
    qs = qs.filter(start_utc__lt=max_end, end_utc__gt=min_start)

    all_rows = list(qs)
    by_batch: dict[str, list[BarCoverage]] = {row['batch_id']: [] for row in launches}
    for launch in launches:
        bid = launch['batch_id']
        tf_set = set(launch['timeframes'])
        contract = launch['contract_id'] or ''
        start = launch['start_utc']
        end = launch['end_utc']
        matched: list[BarCoverage] = []
        for cov in all_rows:
            if cov.instrument != launch['instrument']:
                continue
            if tf_set and cov.timeframe not in tf_set:
                continue
            if contract and cov.contract_id != contract:
                continue
            if cov.end_utc <= start or cov.start_utc >= end:
                continue
            matched.append(cov)
        by_batch[bid] = _dedupe_coverages(matched)
    return by_batch


def _instrument_totals(user, instrument: str | None) -> dict[str, Any]:
    qs = BarCoverage.objects.filter(user=user)
    if instrument:
        qs = qs.filter(instrument=instrument.upper().strip())
    rows = _dedupe_coverages(list(qs))
    summed = _sum_coverages(rows)
    return {
        'bars_stored': summed['bars_stored'],
        'bars_expected': summed['bars_expected'],
        'unexpected_missing_count': summed['unexpected_missing_count'],
        'complete': summed['complete'],
        'partial': summed['partial'],
    }


def _issue_aggregates(
    user,
    batch_ids: list[str],
) -> dict[str, dict[str, Any]]:
    if not batch_ids:
        return {}
    qs = (
        BarQualityIssue.objects.filter(
            job__user=user,
            job__batch_id__in=batch_ids,
        )
        .exclude(issue_type__in=_EXCLUDED_ISSUE_TYPES)
        .values('job__batch_id', 'issue_type', 'severity')
        .annotate(count=Count('id'))
    )
    out: dict[str, dict[str, Any]] = {
        bid: {'issue_counts': {}, 'issue_total': 0, 'max_severity': ''}
        for bid in batch_ids
    }
    for row in qs:
        bid = str(row['job__batch_id'])
        bucket = out.setdefault(
            bid,
            {'issue_counts': {}, 'issue_total': 0, 'max_severity': ''},
        )
        itype = row['issue_type']
        count = int(row['count'] or 0)
        bucket['issue_counts'][itype] = bucket['issue_counts'].get(itype, 0) + count
        bucket['issue_total'] += count
        sev = row['severity'] or ''
        if _SEVERITY_RANK.get(sev, 0) > _SEVERITY_RANK.get(bucket['max_severity'], 0):
            bucket['max_severity'] = sev
    return out


def list_manual_launch_coverage(
    user,
    instrument: str | None = None,
    *,
    limit: int = MAX_LAUNCHES,
) -> dict[str, Any]:
    """Couverture actuelle par lancement manuel + anomalies non-gap + totaux."""
    launches_meta = _list_manual_batches(user, instrument, limit=limit)
    by_batch = _load_coverages_for_launches(user, launches_meta)
    issues = _issue_aggregates(user, [m['batch_id'] for m in launches_meta])
    empty_issues = {'issue_counts': {}, 'issue_total': 0, 'max_severity': ''}
    launches: list[dict[str, Any]] = []
    for meta in launches_meta:
        cov_sum = _sum_coverages(by_batch.get(meta['batch_id'], []))
        iss = issues.get(meta['batch_id']) or empty_issues
        launches.append({
            'batch_id': meta['batch_id'],
            'instrument': meta['instrument'],
            'contract_id': meta['contract_id'],
            'timeframes': meta['timeframes'],
            'start_utc': _iso(meta['start_utc']),
            'end_utc': _iso(meta['end_utc']),
            'launched_at': _iso(meta['launched_at']),
            'job_status': meta['job_status'],
            'bars_stored': cov_sum['bars_stored'],
            'bars_expected': cov_sum['bars_expected'],
            'unexpected_missing_count': cov_sum['unexpected_missing_count'],
            'coverage_status': cov_sum['status'],
            'issue_total': iss['issue_total'],
            'issue_counts': iss['issue_counts'],
            'max_severity': iss['max_severity'],
        })
    return {
        'totals': _instrument_totals(user, instrument),
        'launches': launches,
    }
