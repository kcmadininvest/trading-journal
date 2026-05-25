"""Indicateurs de discipline comportementale (revenge au niveau jour, sizing gagnants vs perdants)."""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, Literal, Optional

from trades.contract_utils.contract_family import trade_risk_units
from trades.pnl_basis import trade_pnl_as_float

AlertLevel = Literal['none', 'warning']

MIN_DAYS_PER_REVENGE_BUCKET = 3
MIN_TRADES_PER_SIZING_BUCKET = 5
REVENGE_PCT_ALERT_THRESHOLD = 15.0
SIZING_PCT_ALERT_THRESHOLD = 10.0


def compute_revenge_trading(daily_data: dict[date, dict[str, Any]]) -> dict[str, Any]:
    """
    Moyenne du nombre de trades sur les jours suivant un jour perdant vs gagnant.

    daily_data: clés date, valeurs avec au moins 'pnl' et 'trade_count'.
    """
    if not daily_data:
        return _empty_revenge_trading()

    sorted_days = sorted(daily_data.keys())
    after_negative: list[int] = []
    after_positive: list[int] = []

    for i in range(1, len(sorted_days)):
        prev_day = sorted_days[i - 1]
        curr_day = sorted_days[i]
        prev_pnl = daily_data[prev_day].get('pnl', 0)
        if not isinstance(prev_pnl, (int, float)):
            continue
        trade_count = daily_data[curr_day].get('trade_count', 0)
        if not isinstance(trade_count, int):
            trade_count = int(trade_count)

        if prev_pnl < 0:
            after_negative.append(trade_count)
        elif prev_pnl > 0:
            after_positive.append(trade_count)

    days_after_negative = len(after_negative)
    days_after_positive = len(after_positive)
    has_sufficient_data = (
        days_after_negative >= MIN_DAYS_PER_REVENGE_BUCKET
        and days_after_positive >= MIN_DAYS_PER_REVENGE_BUCKET
    )

    avg_neg = (
        sum(after_negative) / days_after_negative if days_after_negative else 0.0
    )
    avg_pos = (
        sum(after_positive) / days_after_positive if days_after_positive else 0.0
    )

    pct_increase: Optional[float] = None
    if avg_pos > 0:
        pct_increase = round(((avg_neg - avg_pos) / avg_pos) * 100, 1)

    alert_level: AlertLevel = 'none'
    if (
        has_sufficient_data
        and pct_increase is not None
        and pct_increase >= REVENGE_PCT_ALERT_THRESHOLD
    ):
        alert_level = 'warning'

    return {
        'avg_trades_after_negative_day': round(avg_neg, 2),
        'avg_trades_after_positive_day': round(avg_pos, 2),
        'pct_increase': pct_increase,
        'days_after_negative': days_after_negative,
        'days_after_positive': days_after_positive,
        'has_sufficient_data': has_sufficient_data,
        'alert_level': alert_level,
    }


def compute_sizing_discipline(trades_queryset, pnl_field: str) -> dict[str, Any]:
    """Moyenne d'exposition (risk_units) sur trades gagnants vs perdants."""
    winning_units: list[Decimal] = []
    losing_units: list[Decimal] = []
    skipped_unknown_contract = 0

    for trade in trades_queryset:
        units = trade_risk_units(trade)
        if units is None:
            skipped_unknown_contract += 1
            continue
        pnl = trade_pnl_as_float(trade, pnl_field)
        if pnl > 0:
            winning_units.append(units)
        elif pnl < 0:
            losing_units.append(units)

    winning_count = len(winning_units)
    losing_count = len(losing_units)
    has_sufficient_data = (
        winning_count >= MIN_TRADES_PER_SIZING_BUCKET
        and losing_count >= MIN_TRADES_PER_SIZING_BUCKET
    )

    avg_winners = (
        float(sum(winning_units) / winning_count) if winning_count else 0.0
    )
    avg_losers = float(sum(losing_units) / losing_count) if losing_count else 0.0

    pct_larger_on_losers: Optional[float] = None
    if avg_winners > 0:
        pct_larger_on_losers = round(
            ((avg_losers - avg_winners) / avg_winners) * 100, 1
        )

    alert_level: AlertLevel = 'none'
    if (
        has_sufficient_data
        and pct_larger_on_losers is not None
        and pct_larger_on_losers >= SIZING_PCT_ALERT_THRESHOLD
    ):
        alert_level = 'warning'

    return {
        'avg_size_winning_trades': round(avg_winners, 2),
        'avg_size_losing_trades': round(avg_losers, 2),
        'pct_larger_on_losers': pct_larger_on_losers,
        'winning_trades_count': winning_count,
        'losing_trades_count': losing_count,
        'skipped_unknown_contract': skipped_unknown_contract,
        'comparison_basis': 'risk_units',
        'has_sufficient_data': has_sufficient_data,
        'alert_level': alert_level,
    }


def _empty_revenge_trading() -> dict[str, Any]:
    return {
        'avg_trades_after_negative_day': 0.0,
        'avg_trades_after_positive_day': 0.0,
        'pct_increase': None,
        'days_after_negative': 0,
        'days_after_positive': 0,
        'has_sufficient_data': False,
        'alert_level': 'none',
    }


def _empty_sizing_discipline() -> dict[str, Any]:
    return {
        'avg_size_winning_trades': 0.0,
        'avg_size_losing_trades': 0.0,
        'pct_larger_on_losers': None,
        'winning_trades_count': 0,
        'losing_trades_count': 0,
        'skipped_unknown_contract': 0,
        'comparison_basis': 'risk_units',
        'has_sufficient_data': False,
        'alert_level': 'none',
    }


def empty_behavior_discipline() -> dict[str, Any]:
    return {
        'revenge_trading': _empty_revenge_trading(),
        'sizing_discipline': _empty_sizing_discipline(),
    }


def compute_behavior_discipline(
    daily_data: dict[date, dict[str, Any]],
    trades_queryset,
    pnl_field: str,
) -> dict[str, Any]:
    return {
        'revenge_trading': compute_revenge_trading(daily_data),
        'sizing_discipline': compute_sizing_discipline(trades_queryset, pnl_field),
    }
