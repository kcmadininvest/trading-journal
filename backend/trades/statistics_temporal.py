"""Métriques temporelles pour les statistiques de trading."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Iterable, Optional

import pytz
from django.utils import timezone

DEFAULT_USER_TZ = pytz.timezone('Europe/Paris')


def format_duration_from_seconds(total_seconds: float) -> str:
    if total_seconds <= 0:
        return '00:00:00'
    total = int(round(total_seconds))
    hours, remainder = divmod(total, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f'{hours:02d}:{minutes:02d}:{seconds:02d}'


def _aware(dt: datetime) -> datetime:
    if timezone.is_naive(dt):
        return timezone.make_aware(dt, timezone.utc)
    return dt


def _to_local(dt: datetime, user_tz) -> datetime:
    return _aware(dt).astimezone(user_tz)


def _row_value(row, key: str):
    if isinstance(row, dict):
        return row.get(key)
    return getattr(row, key, None)


def _trade_day(row, user_tz=DEFAULT_USER_TZ) -> Optional[date]:
    entered_at = _row_value(row, 'entered_at')
    if entered_at:
        return _to_local(entered_at, user_tz).date()
    return _row_value(row, 'trade_day')


def _duration_timedelta(value) -> Optional[timedelta]:
    if value is None:
        return None
    if isinstance(value, timedelta):
        return value if value.total_seconds() > 0 else None
    if isinstance(value, str) and value.strip():
        parts = value.strip().split(':')
        try:
            if len(parts) == 3:
                hours, minutes, seconds = parts
                secs = float(seconds)
                return timedelta(
                    hours=int(hours),
                    minutes=int(minutes),
                    seconds=int(secs),
                    microseconds=int((secs % 1) * 1_000_000),
                )
        except (TypeError, ValueError):
            return None
    return None


def compute_avg_time_between_trades(trades: Iterable, user_tz=DEFAULT_USER_TZ) -> str:
    """Temps moyen entre deux entrées consécutives le même jour de trading."""
    by_day: dict = defaultdict(list)
    for trade in trades:
        entered_at = _row_value(trade, 'entered_at')
        trade_day = _trade_day(trade, user_tz)
        if entered_at and trade_day:
            by_day[trade_day].append(_to_local(entered_at, user_tz))

    gaps: list[float] = []
    for times in by_day.values():
        sorted_times = sorted(times)
        for idx in range(1, len(sorted_times)):
            delta = (sorted_times[idx] - sorted_times[idx - 1]).total_seconds()
            if delta > 0:
                gaps.append(delta)

    if not gaps:
        return '00:00:00'
    return format_duration_from_seconds(sum(gaps) / len(gaps))


def _trade_interval(row, user_tz=DEFAULT_USER_TZ) -> Optional[tuple[datetime, datetime]]:
    entered_at = _row_value(row, 'entered_at')
    exited_at = _row_value(row, 'exited_at')
    trade_duration = _duration_timedelta(_row_value(row, 'trade_duration'))
    if not entered_at:
        return None

    start = _to_local(entered_at, user_tz)
    end: Optional[datetime] = None

    if exited_at:
        end = _to_local(exited_at, user_tz)
    if trade_duration:
        end_from_duration = start + trade_duration
        if end is None or end <= start:
            end = end_from_duration
    elif end is None:
        return None

    if end <= start:
        return None
    return start, end


def _duration_seconds(row, user_tz=DEFAULT_USER_TZ) -> float:
    trade_duration = _duration_timedelta(_row_value(row, 'trade_duration'))
    if trade_duration:
        return trade_duration.total_seconds()

    interval = _trade_interval(row, user_tz)
    if interval:
        return (interval[1] - interval[0]).total_seconds()
    return 0.0


def _merge_intervals(intervals: list[tuple[datetime, datetime]]) -> list[tuple[datetime, datetime]]:
    if not intervals:
        return []

    sorted_intervals = sorted(intervals, key=lambda item: item[0])
    merged = [sorted_intervals[0]]
    for start, end in sorted_intervals[1:]:
        last_start, last_end = merged[-1]
        if start <= last_end:
            merged[-1] = (last_start, max(last_end, end))
        else:
            merged.append((start, end))
    return merged


def compute_avg_daily_exposure_time(trades: Iterable, user_tz=DEFAULT_USER_TZ) -> str:
    """Temps moyen cumulé en position par jour (intervalles fusionnés, repli sur durées)."""
    by_day_intervals: dict = defaultdict(list)
    by_day_duration_sum: dict = defaultdict(float)

    for trade in trades:
        trade_day = _trade_day(trade, user_tz)
        if not trade_day:
            continue

        interval = _trade_interval(trade, user_tz)
        if interval:
            by_day_intervals[trade_day].append(interval)

        duration_seconds = _duration_seconds(trade, user_tz)
        if duration_seconds > 0:
            by_day_duration_sum[trade_day] += duration_seconds

    daily_totals: list[float] = []
    for trade_day in set(by_day_intervals) | set(by_day_duration_sum):
        total = 0.0
        intervals = by_day_intervals.get(trade_day, [])
        if intervals:
            merged = _merge_intervals(intervals)
            total = sum((end - start).total_seconds() for start, end in merged)

        if total <= 0:
            total = by_day_duration_sum.get(trade_day, 0.0)

        if total > 0:
            daily_totals.append(total)

    if not daily_totals:
        return '00:00:00'
    return format_duration_from_seconds(sum(daily_totals) / len(daily_totals))
