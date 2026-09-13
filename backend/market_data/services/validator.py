"""Validation des bougies — anomalies enregistrées, jamais silencieuses."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from market_data.services.normalizer import NormalizedBar
from market_data.services.sessions import (
    count_expected_vs_gaps,
    expected_timestamps,
    get_session_profile,
    is_expected_gap_minute,
)
from market_data.services.timeframes import parse_timeframe


@dataclass
class QualityIssue:
    issue_type: str
    severity: str
    timestamp_utc: datetime | None = None
    details: dict[str, Any] = field(default_factory=dict)


@dataclass
class ValidationReport:
    issues: list[QualityIssue] = field(default_factory=list)
    bars_expected: int = 0
    expected_gap_count: int = 0
    unexpected_missing_count: int = 0
    bars_stored: int = 0
    status: str = 'partial'  # complete | partial | empty

    def add(self, issue: QualityIssue) -> None:
        self.issues.append(issue)


def _ohlc_ok(bar: NormalizedBar) -> bool:
    return (
        bar.high >= bar.low
        and bar.high >= bar.open
        and bar.high >= bar.close
        and bar.low <= bar.open
        and bar.low <= bar.close
    )


def validate_bars(
    bars: list[NormalizedBar],
    *,
    instrument: str,
    start_utc: datetime,
    end_utc: datetime,
    timeframe: str = '1m',
) -> ValidationReport:
    """
    Valide une série normalisée pour une plage.
    Ne supprime aucune barre — produit uniquement un rapport.
    """
    report = ValidationReport()
    report.bars_stored = len(bars)

    if start_utc.tzinfo is None:
        start_utc = start_utc.replace(tzinfo=timezone.utc)
    if end_utc.tzinfo is None:
        end_utc = end_utc.replace(tzinfo=timezone.utc)

    bar_seconds = parse_timeframe(timeframe).bar_seconds
    expected_list = expected_timestamps(start_utc, end_utc, instrument, bar_seconds=bar_seconds)
    bars_expected, expected_gap_count = count_expected_vs_gaps(
        start_utc, end_utc, instrument, bar_seconds=bar_seconds,
    )
    report.bars_expected = bars_expected
    report.expected_gap_count = expected_gap_count

    if get_session_profile(instrument) is None:
        report.add(QualityIssue(
            issue_type='unknown_session_profile',
            severity='info',
            details={'instrument': instrument},
        ))

    seen: set[datetime] = set()
    prev_ts: datetime | None = None
    present: set[datetime] = set()

    for bar in bars:
        ts = bar.timestamp_utc
        present.add(ts)

        if ts in seen:
            report.add(QualityIssue(
                issue_type='duplicate',
                severity='warning',
                timestamp_utc=ts,
                details={'contract_hint': 'in_batch'},
            ))
        seen.add(ts)

        if prev_ts is not None and ts < prev_ts:
            report.add(QualityIssue(
                issue_type='non_monotonic',
                severity='error',
                timestamp_utc=ts,
                details={'previous': prev_ts.isoformat()},
            ))
        prev_ts = ts

        if bar.timestamp_utc is None:
            report.add(QualityIssue(
                issue_type='missing_timestamp',
                severity='error',
            ))

        if not _ohlc_ok(bar):
            report.add(QualityIssue(
                issue_type='ohlc_inconsistent',
                severity='error',
                timestamp_utc=ts,
                details={
                    'o': str(bar.open),
                    'h': str(bar.high),
                    'l': str(bar.low),
                    'c': str(bar.close),
                },
            ))

        if bar.volume < 0:
            report.add(QualityIssue(
                issue_type='invalid_volume',
                severity='error',
                timestamp_utc=ts,
                details={'volume': bar.volume},
            ))

    missing = [ts for ts in expected_list if ts not in present]
    report.unexpected_missing_count = len(missing)

    # Enregistrer un échantillon de gaps (pas tous pour éviter des millions de lignes)
    sample = missing[:50]
    for ts in sample:
        if is_expected_gap_minute(ts, instrument):
            report.add(QualityIssue(
                issue_type='expected_gap',
                severity='info',
                timestamp_utc=ts,
            ))
        else:
            report.add(QualityIssue(
                issue_type='gap',
                severity='warning',
                timestamp_utc=ts,
            ))
    if len(missing) > 50:
        report.add(QualityIssue(
            issue_type='gap',
            severity='warning',
            details={'truncated': True, 'total_missing': len(missing)},
        ))

    if report.bars_stored == 0 and report.bars_expected > 0:
        report.status = 'empty'
    elif report.unexpected_missing_count == 0 and report.bars_expected > 0:
        report.status = 'complete'
    elif report.bars_stored == 0 and report.bars_expected == 0:
        # Plage entièrement en expected_gap (week-end)
        report.status = 'complete'
    else:
        report.status = 'partial'

    return report
