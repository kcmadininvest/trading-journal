"""
Rolling period PnL KPIs (day / week / month) for the dashboard.
Independent of the dashboard date-range filter; uses the user's timezone.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, Optional

import pytz
from django.db.models import QuerySet, Sum
from django.db.models.functions import Coalesce

from .models import TradingAccount


def _change_pct(current: float, previous: float) -> Optional[float]:
    if previous == 0:
        return None
    return ((current - previous) / abs(previous)) * 100.0


def _return_on_capital_pct(pnl: float, initial_capital: float) -> Optional[float]:
    if not initial_capital or initial_capital == 0:
        return None
    return (pnl / initial_capital) * 100.0


def _day_bounds(user_tz: pytz.BaseTzInfo, day) -> tuple[datetime, datetime]:
    start = user_tz.localize(datetime.combine(day, datetime.min.time()))
    end = user_tz.localize(
        datetime.combine(day, datetime.min.time()).replace(hour=23, minute=59, second=59)
    )
    return start, end


def _sum_pnl(
    queryset: QuerySet,
    pnl_field: str,
    start_dt: datetime,
    end_dt: datetime,
) -> float:
    total = queryset.filter(
        entered_at__gte=start_dt,
        entered_at__lte=end_dt,
    ).aggregate(total=Sum(pnl_field))['total']
    if total is None:
        return 0.0
    return float(total)


def _period_entry(
    current_pnl: float,
    previous_pnl: float,
    initial_capital: float,
) -> Dict[str, Any]:
    return {
        'pnl': round(current_pnl, 2),
        'previous_pnl': round(previous_pnl, 2),
        'change_pct': (
            round(_change_pct(current_pnl, previous_pnl), 2)
            if _change_pct(current_pnl, previous_pnl) is not None
            else None
        ),
        'return_on_capital_pct': (
            round(_return_on_capital_pct(current_pnl, initial_capital), 2)
            if _return_on_capital_pct(current_pnl, initial_capital) is not None
            else None
        ),
    }


def compute_period_performance(
    trades_queryset: QuerySet,
    user_tz: pytz.BaseTzInfo,
    initial_capital: Decimal,
    pnl_field: str,
    reference_now: Optional[datetime] = None,
) -> Dict[str, Dict[str, Any]]:
    """
    Compute day / week / month PnL vs previous period and return on capital.

    Week: Monday (ISO) through today in user timezone.
    Month: 1st of calendar month through today.
    """
    now = reference_now or datetime.now(user_tz)
    if now.tzinfo is None:
        now = user_tz.localize(now)
    else:
        now = now.astimezone(user_tz)

    today = now.date()
    yesterday = today - timedelta(days=1)

    # This week: Monday -> today
    week_start = today - timedelta(days=today.weekday())
    last_week_end = week_start - timedelta(days=1)
    last_week_start = last_week_end - timedelta(days=6)

    this_month_start = today.replace(day=1)
    last_month_end = this_month_start - timedelta(days=1)
    last_month_start = last_month_end.replace(day=1)

    capital_float = float(initial_capital or 0)

    # Day
    today_start, today_end = _day_bounds(user_tz, today)
    y_start, y_end = _day_bounds(user_tz, yesterday)
    day_current = _sum_pnl(trades_queryset, pnl_field, today_start, today_end)
    day_previous = _sum_pnl(trades_queryset, pnl_field, y_start, y_end)

    # Week
    week_start_dt, _ = _day_bounds(user_tz, week_start)
    week_current = _sum_pnl(trades_queryset, pnl_field, week_start_dt, today_end)
    lw_start_dt, lw_end_dt = _day_bounds(user_tz, last_week_start)
    _, lw_end = _day_bounds(user_tz, last_week_end)
    week_previous = _sum_pnl(trades_queryset, pnl_field, lw_start_dt, lw_end)

    # Month
    month_start_dt, _ = _day_bounds(user_tz, this_month_start)
    month_current = _sum_pnl(trades_queryset, pnl_field, month_start_dt, today_end)
    lm_start_dt, _ = _day_bounds(user_tz, last_month_start)
    _, lm_end = _day_bounds(user_tz, last_month_end)
    month_previous = _sum_pnl(trades_queryset, pnl_field, lm_start_dt, lm_end)

    return {
        'day': _period_entry(day_current, day_previous, capital_float),
        'week': _period_entry(week_current, week_previous, capital_float),
        'month': _period_entry(month_current, month_previous, capital_float),
    }


def resolve_initial_capital_for_dashboard(
    user,
    trading_account_id: Optional[str],
) -> Decimal:
    """Sum initial_capital for filtered active account(s)."""
    qs = TradingAccount.objects.filter(user=user).exclude(status='archived')  # type: ignore
    if trading_account_id:
        try:
            qs = qs.filter(id=int(trading_account_id))
        except (ValueError, TypeError):
            pass
    total = qs.aggregate(total=Coalesce(Sum('initial_capital'), Decimal('0')))['total']
    return total or Decimal('0')
