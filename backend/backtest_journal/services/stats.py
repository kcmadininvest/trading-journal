from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from decimal import Decimal
from typing import Any, Iterable
from zoneinfo import ZoneInfo

from django.utils import timezone

from ..models import FINAL_RESULT_STATUSES, ManualBacktestObservation

SAMPLE_LABELS = (
    (30, 'insufficient'),
    (100, 'preliminary'),
    (200, 'extended'),
)


def sample_label(count: int) -> str:
    if count < 30:
        return 'insufficient'
    if count < 100:
        return 'preliminary'
    if count < 200:
        return 'extended'
    return 'important'


def _to_float(value: Decimal | None) -> float | None:
    if value is None:
        return None
    return float(value)


def is_primary_stat_row(obs: ManualBacktestObservation) -> bool:
    return (
        bool(obs.trade_taken)
        and obs.result_status in FINAL_RESULT_STATUSES
        and obs.result_r is not None
    )


def is_theoretical_refused_row(obs: ManualBacktestObservation) -> bool:
    return (
        not bool(obs.trade_taken)
        and obs.result_status in FINAL_RESULT_STATUSES
        and obs.result_r is not None
    )


def _sort_key(obs: ManualBacktestObservation) -> tuple:
    dt = obs.market_datetime or timezone.now()
    created = obs.created_at or dt
    return (dt, created, obs.pk or 0)


def compute_metrics(rows: Iterable[ManualBacktestObservation]) -> dict[str, Any]:
    finalized = [obs for obs in rows if obs.result_r is not None]
    finalized.sort(key=_sort_key)
    n = len(finalized)
    if n == 0:
        return {
            'sample_size': 0,
            'sample_label': sample_label(0),
            'wins': 0,
            'losses': 0,
            'breakevens': 0,
            'win_rate': None,
            'avg_win_r': None,
            'avg_loss_r_abs': None,
            'expectancy_r': None,
            'profit_factor': None,
            'profit_factor_not_applicable': False,
            'total_r': 0,
            'best_r': None,
            'worst_r': None,
            'max_drawdown_r': 0,
            'max_win_streak': 0,
            'max_loss_streak': 0,
        }

    rs = [Decimal(obs.result_r) for obs in finalized]
    wins = [value for value in rs if value > 0]
    losses = [value for value in rs if value < 0]
    breakevens = [value for value in rs if value == 0]
    total = sum(rs, Decimal('0'))
    avg_win = (sum(wins, Decimal('0')) / len(wins)) if wins else None
    avg_loss_abs = (
        abs(sum(losses, Decimal('0')) / len(losses)) if losses else None
    )
    expectancy = total / n
    positive_sum = sum(wins, Decimal('0'))
    negative_sum = sum(losses, Decimal('0'))
    if not losses:
        profit_factor = None
        pf_na = True
    else:
        profit_factor = float(positive_sum / abs(negative_sum))
        pf_na = False

    equity = Decimal('0')
    peak = Decimal('0')
    max_dd = Decimal('0')
    win_streak = 0
    loss_streak = 0
    max_win_streak = 0
    max_loss_streak = 0
    for value in rs:
        equity += value
        if equity > peak:
            peak = equity
        dd = peak - equity
        if dd > max_dd:
            max_dd = dd
        if value > 0:
            win_streak += 1
            loss_streak = 0
        elif value < 0:
            loss_streak += 1
            win_streak = 0
        else:
            win_streak = 0
            loss_streak = 0
        max_win_streak = max(max_win_streak, win_streak)
        max_loss_streak = max(max_loss_streak, loss_streak)

    return {
        'sample_size': n,
        'sample_label': sample_label(n),
        'wins': len(wins),
        'losses': len(losses),
        'breakevens': len(breakevens),
        'win_rate': float(len(wins) / n) if n else None,
        'avg_win_r': _to_float(avg_win),
        'avg_loss_r_abs': _to_float(avg_loss_abs),
        'expectancy_r': _to_float(expectancy),
        'profit_factor': profit_factor,
        'profit_factor_not_applicable': pf_na,
        'total_r': _to_float(total),
        'best_r': _to_float(max(rs)),
        'worst_r': _to_float(min(rs)),
        'max_drawdown_r': _to_float(max_dd),
        'max_win_streak': max_win_streak,
        'max_loss_streak': max_loss_streak,
    }


def compute_campaign_statistics(
    observations: list[ManualBacktestObservation],
) -> dict[str, Any]:
    taken = [obs for obs in observations if is_primary_stat_row(obs)]
    refused_all = [obs for obs in observations if not obs.trade_taken]
    refused_with_r = [obs for obs in observations if is_theoretical_refused_row(obs)]
    open_count = sum(1 for obs in observations if obs.result_status == 'OPEN')
    missing_r = sum(
        1
        for obs in observations
        if obs.trade_taken
        and obs.result_status in FINAL_RESULT_STATUSES
        and obs.result_r is None
    )
    metrics = compute_metrics(taken)
    accepted = sum(1 for obs in observations if obs.trade_taken)
    total = len(observations)
    metrics.update(
        {
            'observations': total,
            'trades_taken': accepted,
            'setups_refused': len(refused_all),
            'acceptance_rate': (accepted / total) if total else None,
            'excluded_open': open_count,
            'excluded_missing_r': missing_r,
            'refused_with_result': compute_metrics(refused_with_r),
        }
    )
    return metrics


def equity_series(
    observations: list[ManualBacktestObservation],
    *,
    theoretical: bool = False,
) -> list[dict[str, Any]]:
    if theoretical:
        rows = [obs for obs in observations if is_theoretical_refused_row(obs)]
    else:
        rows = [obs for obs in observations if is_primary_stat_row(obs)]
    rows.sort(key=_sort_key)
    cumulative = Decimal('0')
    peak = Decimal('0')
    points: list[dict[str, Any]] = []
    for obs in rows:
        cumulative += Decimal(obs.result_r)
        if cumulative > peak:
            peak = cumulative
        drawdown = peak - cumulative
        points.append(
            {
                'id': obs.pk,
                'market_datetime': obs.market_datetime.isoformat()
                if obs.market_datetime
                else None,
                'result_r': _to_float(Decimal(obs.result_r)),
                'cumulative_r': _to_float(cumulative),
                'drawdown_r': _to_float(drawdown),
                'trade_taken': obs.trade_taken,
            }
        )
    return points


def _hour_in_tz(dt: datetime, tz_name: str) -> int:
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo('UTC')
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.utc)
    return dt.astimezone(tz).hour


def _weekday_in_tz(dt: datetime, tz_name: str) -> int:
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo('UTC')
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.utc)
    return dt.astimezone(tz).weekday()


def group_observations(
    observations: list[ManualBacktestObservation],
    group_by: str,
    tz_name: str,
) -> list[dict[str, Any]]:
    buckets: dict[str, list[ManualBacktestObservation]] = defaultdict(list)
    for obs in observations:
        if group_by == 'direction':
            key = obs.direction
        elif group_by == 'weekday':
            key = str(_weekday_in_tz(obs.market_datetime, tz_name))
        elif group_by == 'hour':
            key = str(_hour_in_tz(obs.market_datetime, tz_name))
        elif group_by == 'result':
            key = obs.result_status
        elif group_by == 'trade_taken':
            key = 'taken' if obs.trade_taken else 'refused'
        else:
            key = 'all'
        buckets[key].append(obs)

    grouped = []
    for key, rows in sorted(buckets.items(), key=lambda item: str(item[0])):
        metrics = compute_metrics(rows)
        metrics['group'] = key
        grouped.append(metrics)
    return grouped
