"""Service de rollups journaliers (option B : dimension strategy_root_id)."""
from __future__ import annotations

import logging
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple

import pytz
from django.contrib.auth import get_user_model
from django.db import models
from django.db.models import Count, Max, Min, Q, Sum
from django.db.models.functions import Coalesce, Extract, TruncDate

from ..compliance_streaks import get_position_strategy_family_ids
from ..models import PositionStrategy, ImportedTrade, TradingAccount
from ..models_rollup import STRATEGY_ROOT_UNASSIGNED, TradeDailyRollup

logger = logging.getLogger(__name__)
User = get_user_model()

RollupBucket = Tuple[int, date, int]


def resolve_strategy_root_id(user, position_strategy_id: Optional[int]) -> int:
    if not position_strategy_id:
        return STRATEGY_ROOT_UNASSIGNED
    try:
        strategy = PositionStrategy.objects.get(id=position_strategy_id, user=user)
        return strategy.parent_strategy_id or strategy.id
    except PositionStrategy.DoesNotExist:
        return STRATEGY_ROOT_UNASSIGNED


def resolve_strategy_root_from_filter(user, position_strategy_id: Optional[int]) -> Optional[int]:
    if not position_strategy_id:
        return None
    return resolve_strategy_root_id(user, position_strategy_id)


def get_trade_day(trade: ImportedTrade, user_tz=None) -> Optional[date]:
    if trade.trade_day:
        return trade.trade_day
    if trade.entered_at:
        tz = user_tz or pytz.UTC
        entered = trade.entered_at
        if entered.tzinfo is None:
            entered = pytz.UTC.localize(entered)
        return entered.astimezone(tz).date()
    return None


def user_has_rollups(user_id: int) -> bool:
    return TradeDailyRollup.objects.filter(user_id=user_id).exists()


def _trade_buckets_in_period(
    user,
    account_ids: Iterable[int],
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    strategy_root_id: Optional[int] = None,
) -> Set[RollupBucket]:
    """Buckets (compte, jour, strategy_root) présents dans les trades filtrés."""
    if not account_ids:
        return set()

    qs = ImportedTrade.objects.filter(user=user, trading_account_id__in=account_ids)
    if start_date:
        qs = qs.filter(
            Q(trade_day__gte=start_date)
            | Q(trade_day__isnull=True, entered_at__date__gte=start_date)
        )
    if end_date:
        qs = qs.filter(
            Q(trade_day__lte=end_date)
            | Q(trade_day__isnull=True, entered_at__date__lte=end_date)
        )
    if strategy_root_id is not None:
        if strategy_root_id == STRATEGY_ROOT_UNASSIGNED:
            qs = qs.filter(position_strategy_id__isnull=True)
        else:
            family_ids = get_position_strategy_family_ids(user, strategy_root_id)
            qs = qs.filter(position_strategy_id__in=family_ids)

    buckets: Set[RollupBucket] = set()
    for trade in qs.only('trading_account_id', 'trade_day', 'entered_at', 'position_strategy_id').iterator(
        chunk_size=500
    ):
        trade_day = get_trade_day(trade)
        if not trade_day or not trade.trading_account_id:
            continue
        if start_date and trade_day < start_date:
            continue
        if end_date and trade_day > end_date:
            continue
        root = resolve_strategy_root_id(user, trade.position_strategy_id)
        buckets.add((trade.trading_account_id, trade_day, root))
    return buckets


def rollups_cover_period(
    user,
    account_ids: Iterable[int],
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    strategy_root_id: Optional[int] = None,
) -> bool:
    """
    True si chaque bucket (compte, jour, strategy_root) actif a une ligne rollup.
    """
    account_list = list(account_ids)
    if not account_list or not user_has_rollups(user.id):
        return False

    buckets = _trade_buckets_in_period(user, account_list, start_date, end_date, strategy_root_id)
    if not buckets:
        return True

    for account_id, trade_day, root_id in buckets:
        if not TradeDailyRollup.objects.filter(
            user=user,
            trading_account_id=account_id,
            trade_day=trade_day,
            strategy_root_id=root_id,
        ).exists():
            return False
    return True


def _trades_for_bucket(user_id: int, account_id: int, trade_day: date, strategy_root_id: int):
    qs = ImportedTrade.objects.filter(
        user_id=user_id,
        trading_account_id=account_id,
    ).annotate(
        effective_day=Coalesce('trade_day', TruncDate('entered_at')),
    ).filter(effective_day=trade_day)

    if strategy_root_id == STRATEGY_ROOT_UNASSIGNED:
        return qs.filter(position_strategy_id__isnull=True)

    family_ids = get_position_strategy_family_ids(
        User.objects.get(id=user_id),
        strategy_root_id,
    )
    return qs.filter(position_strategy_id__in=family_ids)


def recalculate_rollup_bucket(user_id: int, account_id: int, trade_day: date, strategy_root_id: int) -> None:
    trades = _trades_for_bucket(user_id, account_id, trade_day, strategy_root_id)
    filter_kwargs = {
        'user_id': user_id,
        'trading_account_id': account_id,
        'trade_day': trade_day,
        'strategy_root_id': strategy_root_id,
    }

    if not trades.exists():
        TradeDailyRollup.objects.filter(**filter_kwargs).delete()
        return

    duration_seconds = Sum(
        Extract('trade_duration', 'epoch'),
        output_field=models.BigIntegerField(),
    )
    agg = trades.aggregate(
        pnl_net=Sum('net_pnl'),
        pnl_gross=Sum('pnl'),
        trade_count=Count('id'),
        win_count=Count('id', filter=Q(net_pnl__gt=0)),
        loss_count=Count('id', filter=Q(net_pnl__lt=0)),
        sum_win_pnl=Sum('net_pnl', filter=Q(net_pnl__gt=0)),
        sum_loss_pnl=Sum('net_pnl', filter=Q(net_pnl__lt=0)),
        sum_duration_seconds=duration_seconds,
        largest_win=Max('net_pnl', filter=Q(net_pnl__gt=0)),
        largest_loss=Min('net_pnl', filter=Q(net_pnl__lt=0)),
    )

    TradeDailyRollup.objects.update_or_create(
        **filter_kwargs,
        defaults={
            'pnl_net': agg['pnl_net'] or Decimal('0'),
            'pnl_gross': agg['pnl_gross'] or Decimal('0'),
            'trade_count': agg['trade_count'] or 0,
            'win_count': agg['win_count'] or 0,
            'loss_count': agg['loss_count'] or 0,
            'sum_win_pnl': agg['sum_win_pnl'] or Decimal('0'),
            'sum_loss_pnl': agg['sum_loss_pnl'] or Decimal('0'),
            'sum_duration_seconds': int(agg['sum_duration_seconds'] or 0),
            'largest_win': agg['largest_win'] or Decimal('0'),
            'largest_loss': agg['largest_loss'] or Decimal('0'),
        },
    )


def buckets_for_trade(trade: ImportedTrade, user_tz=None) -> Set[RollupBucket]:
    if not trade.trading_account_id:
        return set()
    trade_day = get_trade_day(trade, user_tz)
    if not trade_day:
        return set()
    root = resolve_strategy_root_id(trade.user, trade.position_strategy_id)
    return {(trade.trading_account_id, trade_day, root)}


def handle_trade_rollup_update(instance: ImportedTrade, old_instance: Optional[ImportedTrade] = None) -> None:
    if not instance.user_id:
        return

    user_tz = None
    try:
        prefs = getattr(instance.user, 'preferences', None)
        if prefs and prefs.timezone:
            user_tz = pytz.timezone(prefs.timezone)
    except Exception:
        pass

    buckets: Set[RollupBucket] = set()
    buckets.update(buckets_for_trade(instance, user_tz))

    if old_instance:
        buckets.update(buckets_for_trade(old_instance, user_tz))

    for account_id, trade_day, strategy_root_id in buckets:
        try:
            recalculate_rollup_bucket(instance.user_id, account_id, trade_day, strategy_root_id)
        except Exception as exc:
            logger.error(
                'Erreur recalcul rollup user=%s acc=%s day=%s strat=%s: %s',
                instance.user_id,
                account_id,
                trade_day,
                strategy_root_id,
                exc,
            )


def _rollup_queryset(
    user,
    account_ids: Iterable[int],
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    strategy_root_id: Optional[int] = None,
):
    qs = TradeDailyRollup.objects.filter(user=user, trading_account_id__in=account_ids)
    if start_date:
        qs = qs.filter(trade_day__gte=start_date)
    if end_date:
        qs = qs.filter(trade_day__lte=end_date)
    if strategy_root_id is not None:
        qs = qs.filter(strategy_root_id=strategy_root_id)
    return qs


def get_daily_aggregates_from_rollups(
    user,
    account_ids: List[int],
    start_date: Optional[date],
    end_date: Optional[date],
    strategy_root_id: Optional[int],
    *,
    use_gross: bool = False,
) -> List[Dict[str, Any]]:
    if not account_ids:
        return []

    pnl_field = 'pnl_gross' if use_gross else 'pnl_net'
    rows = (
        _rollup_queryset(user, account_ids, start_date, end_date, strategy_root_id)
        .values('trade_day')
        .annotate(
            day_pnl=Sum(pnl_field),
            day_pnl_net=Sum('pnl_net'),
            day_pnl_gross=Sum('pnl_gross'),
            trade_count=Sum('trade_count'),
            winning_count=Sum('win_count'),
            losing_count=Sum('loss_count'),
        )
        .order_by('trade_day')
    )

    return [
        {
            'date': row['trade_day'].strftime('%Y-%m-%d'),
            'pnl': float(row['day_pnl'] or 0),
            'pnl_net': float(row['day_pnl_net'] or 0),
            'pnl_gross': float(row['day_pnl_gross'] or 0),
            'trade_count': int(row['trade_count'] or 0),
            'winning_count': int(row['winning_count'] or 0),
            'losing_count': int(row['losing_count'] or 0),
        }
        for row in rows
    ]


def get_active_account_ids(user, trading_account_id: Optional[int]) -> List[int]:
    if trading_account_id:
        return [int(trading_account_id)]
    return list(
        TradingAccount.objects.filter(user=user)
        .exclude(status='archived')
        .values_list('id', flat=True)
    )


def rebuild_rollups_for_user(user_id: int) -> int:
    """Recalcule tous les rollups d'un utilisateur. Retourne le nombre de lignes créées."""
    TradeDailyRollup.objects.filter(user_id=user_id).delete()

    trades = ImportedTrade.objects.filter(user_id=user_id).select_related('user', 'trading_account')
    buckets: Set[RollupBucket] = set()

    for trade in trades.iterator(chunk_size=500):
        buckets.update(buckets_for_trade(trade))

    for account_id, trade_day, strategy_root_id in buckets:
        recalculate_rollup_bucket(user_id, account_id, trade_day, strategy_root_id)

    return TradeDailyRollup.objects.filter(user_id=user_id).count()
