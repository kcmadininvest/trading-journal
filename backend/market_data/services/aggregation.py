from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Iterable

from market_data.services.normalizer import NormalizedBar
from market_data.services.sessions import (
    count_expected_vs_gaps,
    compute_session_flags,
    expected_timestamps,
    session_bounds_utc,
)
from market_data.services.timeframes import parse_timeframe
from market_data.services.validator import ValidationReport


@dataclass(frozen=True)
class SessionAggregation:
    bars: list[NormalizedBar]
    report: ValidationReport


def aggregate_m1_session(
    m1_bars: Iterable[NormalizedBar],
    *,
    instrument: str,
    session_date: date,
    timeframe: str,
) -> SessionAggregation:
    spec = parse_timeframe(timeframe)
    if spec.code == '1m':
        raise ValueError('Le timeframe 1m est la source et ne peut pas être agrégé.')

    instrument = (instrument or '').upper().strip()
    if not instrument:
        raise ValueError('Instrument requis pour agréger les bougies.')

    session_start, session_end = session_bounds_utc(session_date, instrument)

    def bucket_open(timestamp: datetime) -> datetime:
        if spec.code == '1d':
            return session_start
        offset = int((timestamp - session_start).total_seconds())
        bucket_index = offset // spec.bar_seconds
        return session_start + timedelta(seconds=bucket_index * spec.bar_seconds)

    source_bars = list(m1_bars)
    buckets: dict[datetime, list[NormalizedBar]] = {}
    for bar in sorted(source_bars, key=lambda item: item.timestamp_utc):
        timestamp = bar.timestamp_utc
        if bar.session_date != session_date or not session_start <= timestamp < session_end:
            continue
        buckets.setdefault(bucket_open(timestamp), []).append(bar)

    aggregated: list[NormalizedBar] = []
    for bucket_start, bars in sorted(buckets.items()):
        flags = compute_session_flags(bucket_start, instrument)
        aggregated.append(NormalizedBar(
            timestamp_utc=bucket_start,
            open=bars[0].open,
            high=max(bar.high for bar in bars),
            low=min(bar.low for bar in bars),
            close=bars[-1].close,
            volume=sum(bar.volume for bar in bars),
            ny_date=flags.ny_date,
            ny_time=flags.ny_time,
            session_date=session_date,
            is_rth=flags.is_rth,
            is_eth=flags.is_eth,
            is_us_session=flags.is_us_session,
            profile_known=flags.profile_known,
            extra_raw={},
        ))

    expected_minutes = expected_timestamps(
        session_start,
        session_end,
        instrument,
        bar_seconds=60,
    )
    expected_buckets = {bucket_open(timestamp) for timestamp in expected_minutes}
    actual_minutes = {
        bar.timestamp_utc
        for bar in source_bars
        if bar.session_date == session_date and session_start <= bar.timestamp_utc < session_end
    }
    incomplete_buckets = {
        bucket_open(timestamp) for timestamp in set(expected_minutes) - actual_minutes
    }
    bars_expected = len(expected_buckets)
    expected_gap_count = count_expected_vs_gaps(
        session_start,
        session_end,
        instrument,
        bar_seconds=60,
    )[1]

    report = ValidationReport(
        bars_expected=bars_expected,
        expected_gap_count=expected_gap_count,
        unexpected_missing_count=len(incomplete_buckets),
        bars_stored=len(aggregated),
    )
    if not expected_buckets and not aggregated:
        report.status = 'complete'
    elif not aggregated:
        report.status = 'empty'
    elif not incomplete_buckets and len(aggregated) == bars_expected:
        report.status = 'complete'
    else:
        report.status = 'partial'

    return SessionAggregation(bars=aggregated, report=report)
