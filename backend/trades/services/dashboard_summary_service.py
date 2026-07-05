"""Calcul consolidé du dashboard summary (partagé views + Celery warm cache)."""
from __future__ import annotations

import logging
from datetime import datetime

import pytz
from django.db.models import Count, Q, Sum
from django.db.models.functions import Coalesce, TruncDate

from ..account_balance import build_dashboard_balance_context
from ..compliance_streaks import (
    compute_dashboard_next_badge,
    compute_next_record_milestone,
    compute_strategy_compliance_context,
    get_position_strategy_family_ids,
    get_rolling_twelve_month_date_range,
)
from ..models import DayStrategyCompliance, TopStepTrade, TradingAccount
from ..period_performance import compute_period_performance, resolve_initial_capital_for_dashboard
from ..serializers import TopStepTradeListSerializer, TradeStrategySerializer
from ..pnl_basis import get_trade_pnl_field_for_request
from .rollup_service import (
    get_active_account_ids,
    get_daily_aggregates_from_rollups,
    resolve_strategy_root_from_filter,
    rollups_cover_period,
)

logger = logging.getLogger(__name__)


def _parse_user_tz(user):
    user_timezone = getattr(getattr(user, 'preferences', None), 'timezone', None)
    try:
        return pytz.timezone(user_timezone) if user_timezone else pytz.timezone('Europe/Paris')
    except pytz.exceptions.UnknownTimeZoneError:
        logger.warning('Timezone inconnue: %s, utilisation de Europe/Paris', user_timezone)
        return pytz.timezone('Europe/Paris')
    except Exception as exc:
        logger.error('Erreur timezone: %s', exc)
        return pytz.timezone('Europe/Paris')


def compute_dashboard_summary_payload(request, *, include_lists: bool = True) -> dict:
    from django.contrib.auth import get_user_model

    User = get_user_model()
    if getattr(request, 'user', None) and request.user.is_authenticated:
        request.user = User.objects.select_related('preferences').get(pk=request.user.pk)

    trading_account_id = request.GET.get('trading_account')
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    position_strategy_id = request.GET.get('position_strategy')
    start_date_obj = None
    end_date_obj = None
    parsed_strategy_id = None

    trades_queryset = TopStepTrade.objects.filter(user=request.user)  # type: ignore

    if trading_account_id:
        trades_queryset = trades_queryset.filter(trading_account_id=trading_account_id)
        active_accounts = None
    else:
        active_accounts = list(
            TradingAccount.objects.filter(user=request.user)  # type: ignore
            .exclude(status='archived')
            .values_list('id', flat=True)
        )
        trades_queryset = trades_queryset.filter(trading_account_id__in=active_accounts)

    if position_strategy_id:
        try:
            parsed_strategy_id = int(position_strategy_id)
            family_ids = get_position_strategy_family_ids(request.user, parsed_strategy_id)
            trades_queryset = trades_queryset.filter(position_strategy_id__in=family_ids)
        except (ValueError, TypeError):
            parsed_strategy_id = None

    user_tz = _parse_user_tz(request.user)

    if start_date:
        try:
            start_datetime = datetime.strptime(start_date, '%Y-%m-%d')
            start_date_obj = start_datetime.date()
            start_datetime = user_tz.localize(start_datetime)
            trades_queryset = trades_queryset.filter(entered_at__gte=start_datetime)
        except ValueError:
            start_date_obj = None

    if end_date:
        try:
            end_datetime = datetime.strptime(end_date, '%Y-%m-%d')
            end_date_obj = end_datetime.date()
            end_datetime = end_datetime.replace(hour=23, minute=59, second=59)
            end_datetime = user_tz.localize(end_datetime)
            trades_queryset = trades_queryset.filter(entered_at__lte=end_datetime)
        except ValueError:
            end_date_obj = None

    _dash_pf = get_trade_pnl_field_for_request(request.user, request)
    use_gross = _dash_pf == 'pnl'

    account_ids = get_active_account_ids(
        request.user,
        int(trading_account_id) if trading_account_id else None,
    )
    strategy_root = resolve_strategy_root_from_filter(request.user, parsed_strategy_id)

    convert_to = (request.GET.get('convert_to') or '').strip()
    use_rollups = not convert_to and rollups_cover_period(
        request.user,
        account_ids,
        start_date_obj,
        end_date_obj,
        strategy_root,
    )

    if use_rollups:
        daily_data = get_daily_aggregates_from_rollups(
            request.user,
            account_ids,
            start_date_obj,
            end_date_obj,
            strategy_root,
            use_gross=use_gross,
        )
    else:
        daily_aggregates = trades_queryset.annotate(
            date=Coalesce('trade_day', TruncDate('entered_at'))
        ).values('date').annotate(
            day_pnl=Sum(_dash_pf),
            day_pnl_net=Sum('net_pnl'),
            day_pnl_gross=Sum('pnl'),
            trade_count=Count('id'),
            winning_count=Count('id', filter=Q(**{f'{_dash_pf}__gt': 0})),
            losing_count=Count('id', filter=Q(**{f'{_dash_pf}__lt': 0})),
        ).order_by('date')

        daily_data = []
        for item in daily_aggregates:
            if item['date']:
                date_str = (
                    item['date'].strftime('%Y-%m-%d')
                    if hasattr(item['date'], 'strftime')
                    else str(item['date'])
                )
                pnl_net = float(item['day_pnl_net'] or 0)
                pnl_gross = float(item['day_pnl_gross'] or 0)
                daily_data.append({
                    'date': date_str,
                    'pnl': float(item['day_pnl'] or 0),
                    'pnl_net': pnl_net,
                    'pnl_gross': pnl_gross,
                    'trade_count': item['trade_count'],
                    'winning_count': item['winning_count'],
                    'losing_count': item['losing_count'],
                })

    active_dates = {row['date'] for row in daily_data}

    day_compliance_filter = DayStrategyCompliance.objects.filter(  # type: ignore
        user=request.user,
        strategy_respected__isnull=False,
    )
    if trading_account_id:
        day_compliance_filter = day_compliance_filter.filter(trading_account_id=trading_account_id)
    elif active_accounts is not None:
        day_compliance_filter = day_compliance_filter.filter(trading_account_id__in=active_accounts)

    if start_date_obj:
        day_compliance_filter = day_compliance_filter.filter(date__gte=start_date_obj)
    if end_date_obj:
        day_compliance_filter = day_compliance_filter.filter(date__lte=end_date_obj)

    for compliance_date in day_compliance_filter.values_list('date', flat=True).distinct():
        if compliance_date:
            active_dates.add(compliance_date.isoformat())

    active_days_count = len(active_dates)

    limited_trades = trades_queryset.select_related('trading_account')[:500]
    trades_data = TopStepTradeListSerializer(limited_trades, many=True).data if include_lists else []

    compliance_stats = None
    strategies_data = []
    try:
        ta_id = int(trading_account_id) if trading_account_id else None
        pos_id = parsed_strategy_id
        ctx = compute_strategy_compliance_context(
            request.user,
            trading_account_id=ta_id,
            position_strategy_id=pos_id,
            start_date=start_date,
            end_date=end_date,
            year=None,
            month=None,
        )
        strategies_data = TradeStrategySerializer(ctx['strategies_queryset'], many=True).data if include_lists else []

        streak_start, streak_end = get_rolling_twelve_month_date_range(user_tz)
        # La série de discipline est une métrique compte (12 mois), indépendante du filtre stratégie du dashboard.
        streak_ctx = compute_strategy_compliance_context(
            request.user,
            trading_account_id=ta_id,
            position_strategy_id=None,
            start_date=streak_start,
            end_date=streak_end,
            year=None,
            month=None,
        )
        compliance_stats = {
            'current_streak': streak_ctx['current_streak'],
            'current_streak_start': streak_ctx['current_streak_start'],
            'current_streak_trades': streak_ctx['current_streak_trades'],
            'current_not_respect_streak': streak_ctx['current_not_respect_streak'],
            'current_not_respect_streak_start': streak_ctx['current_not_respect_streak_start'],
            'current_not_respect_streak_trades': streak_ctx['current_not_respect_streak_trades'],
            'best_streak': streak_ctx['best_streak'],
            'best_streak_trades': streak_ctx['best_streak_trades'],
            'best_not_respect_streak': streak_ctx['best_not_respect_streak'],
            'best_not_respect_streak_trades': streak_ctx['best_not_respect_streak_trades'],
            'next_badge': compute_dashboard_next_badge(streak_ctx['current_streak']),
            'next_record_milestone': compute_next_record_milestone(streak_ctx['best_streak']),
        }
    except (ValueError, TypeError):
        strategies_data = []
    except Exception as exc:
        logger.error('Erreur compliance dashboard: %s', exc)
        strategies_data = []

    period_trades_qs = TopStepTrade.objects.filter(user=request.user)  # type: ignore
    if trading_account_id:
        period_trades_qs = period_trades_qs.filter(trading_account_id=trading_account_id)
    elif active_accounts is not None:
        period_trades_qs = period_trades_qs.filter(trading_account_id__in=active_accounts)
    if parsed_strategy_id:
        try:
            family_ids = get_position_strategy_family_ids(request.user, parsed_strategy_id)
            period_trades_qs = period_trades_qs.filter(position_strategy_id__in=family_ids)
        except (ValueError, TypeError):
            pass

    initial_capital = resolve_initial_capital_for_dashboard(request.user, trading_account_id)
    period_performance = compute_period_performance(
        period_trades_qs,
        user_tz,
        initial_capital,
        _dash_pf,
    )

    recent_trades_qs = period_trades_qs.select_related('trading_account').order_by('-entered_at')[:20]
    recent_trades_data = TopStepTradeListSerializer(recent_trades_qs, many=True).data if include_lists else []

    balance_context = None
    if trading_account_id:
        try:
            account = TradingAccount.objects.get(  # type: ignore
                id=int(trading_account_id),
                user=request.user,
            )
            balance_context = build_dashboard_balance_context(account, start_date_obj)
        except (TradingAccount.DoesNotExist, ValueError, TypeError):  # type: ignore
            balance_context = None

    response_data = {
        'daily_aggregates': daily_data,
        'trades': trades_data,
        'strategies': strategies_data,
        'compliance_stats': compliance_stats,
        'active_days': active_days_count,
        'count': len(daily_data),
        'period_performance': period_performance,
        'recent_trades': recent_trades_data,
    }
    if balance_context is not None:
        response_data['balance_context'] = balance_context
    return response_data
