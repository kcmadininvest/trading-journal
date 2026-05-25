"""Agrégation par tranche de durée — alignée sur frontend/src/utils/tradeDurationBuckets.ts."""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Iterable, Literal, Optional

DurationBucketKey = Literal['5m', '5-10m', '10-20m', '20-30m', '30-45m', '45-60m']

DURATION_BUCKET_ORDER: tuple[DurationBucketKey, ...] = (
    '5m',
    '5-10m',
    '10-20m',
    '20-30m',
    '30-45m',
    '45-60m',
)


def format_duration_bucket_label(key: DurationBucketKey) -> str:
    if key == '5m':
        return '< 5m'
    if key == '30-45m':
        return '> 30m'
    return key


def categorize_duration(minutes: float) -> DurationBucketKey:
    if minutes < 5:
        return '5m'
    if minutes < 10:
        return '5-10m'
    if minutes < 20:
        return '10-20m'
    if minutes < 30:
        return '20-30m'
    if minutes < 45:
        return '30-45m'
    if minutes < 60:
        return '45-60m'
    return '30-45m'


def trade_duration_minutes(trade_duration) -> Optional[float]:
    if trade_duration is None:
        return None
    total_seconds = trade_duration.total_seconds()
    if total_seconds <= 0:
        return None
    return total_seconds / 60.0


def trade_display_pnl(trade, pnl_field: str) -> Optional[Decimal]:
    value = getattr(trade, pnl_field, None)
    if value is None:
        return None
    return Decimal(value)


def classify_outcome(pnl: Decimal) -> str:
    if pnl > 0:
        return 'win'
    if pnl < 0:
        return 'loss'
    return 'breakeven'


@dataclass
class BucketAccumulator:
    pnl_sum: Decimal = Decimal('0')
    trade_count: int = 0
    wins: int = 0
    losses: int = 0
    breakeven: int = 0


def aggregate_duration_performance(trades: Iterable, pnl_field: str) -> list[dict]:
    buckets: dict[DurationBucketKey, BucketAccumulator] = {
        key: BucketAccumulator() for key in DURATION_BUCKET_ORDER
    }

    for trade in trades:
        minutes = trade_duration_minutes(trade.trade_duration)
        if minutes is None:
            continue
        pnl = trade_display_pnl(trade, pnl_field)
        if pnl is None:
            continue

        key = categorize_duration(minutes)
        bucket = buckets[key]
        bucket.pnl_sum += pnl
        bucket.trade_count += 1
        outcome = classify_outcome(pnl)
        if outcome == 'win':
            bucket.wins += 1
        elif outcome == 'loss':
            bucket.losses += 1
        else:
            bucket.breakeven += 1

    rows: list[dict] = []
    for key in DURATION_BUCKET_ORDER:
        bucket = buckets[key]
        if bucket.trade_count == 0:
            continue
        rows.append(
            {
                'label': format_duration_bucket_label(key),
                'avg_pnl': float(bucket.pnl_sum / bucket.trade_count),
                'win_rate': (bucket.wins / bucket.trade_count) * 100,
                'trade_count': bucket.trade_count,
                'winning_count': bucket.wins,
                'losing_count': bucket.losses,
                'breakeven_count': bucket.breakeven,
            }
        )
    return rows
