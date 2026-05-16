"""
Rolling period PnL KPIs (day / week / month / year) for the dashboard.
Independent of the dashboard date-range filter; uses the user's timezone.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, Optional

import pytz
from django.db.models import QuerySet, Sum
from django.db.models.functions import Coalesce, TruncDate

from .models import TradingAccount


def _change_pct(current: float, previous: float) -> Optional[float]:
    if previous == 0:
        return None
    return ((current - previous) / abs(previous)) * 100.0


def _return_on_capital_pct(pnl: float, initial_capital: float) -> Optional[float]:
    if not initial_capital or initial_capital == 0:
        return None
    return (pnl / initial_capital) * 100.0


def _same_calendar_day_last_year(day):
    """Même jour calendaire l'année précédente (29 fév. → 28 fév.)."""
    try:
        return day.replace(year=day.year - 1)
    except ValueError:
        return day.replace(year=day.year - 1, day=28)


def _effective_date_qs(
    queryset: QuerySet,
    user_tz: pytz.BaseTzInfo,
) -> QuerySet:
    """Filtre commun : trade_day prioritaire, sinon date locale de entered_at."""
    return queryset.annotate(
        eff_date=Coalesce(
            'trade_day',
            TruncDate('entered_at', tzinfo=user_tz),
        )
    )


def _sum_pnl(
    queryset: QuerySet,
    pnl_field: str,
    start_day: date,
    end_day: date,
    user_tz: pytz.BaseTzInfo,
) -> float:
    """
    Somme le PnL sur la plage calendaire [start_day, end_day].

    Utilise trade_day (jour de trading) en priorité, comme les agrégats du dashboard ;
    sinon la date locale de entered_at. Évite d'exclure les trades importés dont
    entered_at ne correspond pas au jour réel.
    """
    total = (
        _effective_date_qs(queryset, user_tz)
        .filter(
            eff_date__gte=start_day,
            eff_date__lte=end_day,
        )
        .aggregate(total=Sum(pnl_field))['total']
    )
    if total is None:
        return 0.0
    return float(total)


def _count_trades_in_range(
    queryset: QuerySet,
    start_day: date,
    end_day: date,
    user_tz: pytz.BaseTzInfo,
) -> int:
    return (
        _effective_date_qs(queryset, user_tz)
        .filter(
            eff_date__gte=start_day,
            eff_date__lte=end_day,
        )
        .count()
    )


def _period_entry(
    current_pnl: float,
    previous_pnl: float,
    initial_capital: float,
    **extra: Any,
) -> Dict[str, Any]:
    entry: Dict[str, Any] = {
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
    entry.update(extra)
    return entry


def compute_period_performance(
    trades_queryset: QuerySet,
    user_tz: pytz.BaseTzInfo,
    initial_capital: Decimal,
    pnl_field: str,
    reference_now: Optional[datetime] = None,
) -> Dict[str, Dict[str, Any]]:
    """
    Compute day / week / month / year PnL vs previous period and return on capital.

    Week: Monday (ISO) through today in user timezone.
    Month: 1st of calendar month through today.
    Year: 1 Jan through today vs same slice one calendar year earlier; if that
    slice has no trades, vs the full prior calendar year (1 Jan – 31 Dec).
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

    this_year_start = today.replace(month=1, day=1)
    last_year_start = this_year_start.replace(year=this_year_start.year - 1)
    last_year_same_day = _same_calendar_day_last_year(today)

    capital_float = float(initial_capital or 0)

    # Day
    day_current = _sum_pnl(trades_queryset, pnl_field, today, today, user_tz)
    day_previous = _sum_pnl(trades_queryset, pnl_field, yesterday, yesterday, user_tz)

    # Week
    week_current = _sum_pnl(trades_queryset, pnl_field, week_start, today, user_tz)
    week_previous = _sum_pnl(
        trades_queryset, pnl_field, last_week_start, last_week_end, user_tz
    )

    # Month
    month_current = _sum_pnl(trades_queryset, pnl_field, this_month_start, today, user_tz)
    month_previous = _sum_pnl(
        trades_queryset, pnl_field, last_month_start, last_month_end, user_tz
    )

    # Year (YTD vs même période l'an dernier, ou année civile complète si vide)
    prior_calendar_year = today.year - 1
    last_year_end = date(prior_calendar_year, 12, 31)
    year_current = _sum_pnl(trades_queryset, pnl_field, this_year_start, today, user_tz)
    ytd_prior_trade_count = _count_trades_in_range(
        trades_queryset, last_year_start, last_year_same_day, user_tz
    )
    if ytd_prior_trade_count == 0:
        full_prior_trade_count = _count_trades_in_range(
            trades_queryset, last_year_start, last_year_end, user_tz
        )
        if full_prior_trade_count > 0:
            year_previous = _sum_pnl(
                trades_queryset, pnl_field, last_year_start, last_year_end, user_tz
            )
            year_comparison_basis = 'full_prior_calendar_year'
        else:
            year_previous = 0.0
            year_comparison_basis = 'same_period_prior_year'
    else:
        year_previous = _sum_pnl(
            trades_queryset, pnl_field, last_year_start, last_year_same_day, user_tz
        )
        year_comparison_basis = 'same_period_prior_year'

    return {
        'day': _period_entry(day_current, day_previous, capital_float),
        'week': _period_entry(week_current, week_previous, capital_float),
        'month': _period_entry(month_current, month_previous, capital_float),
        'year': _period_entry(
            year_current,
            year_previous,
            capital_float,
            comparison_basis=year_comparison_basis,
            prior_calendar_year=prior_calendar_year,
        ),
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
