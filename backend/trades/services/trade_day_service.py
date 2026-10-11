"""
Recalcul de ImportedTrade.trade_day (jour d'entrée dans le fuseau du propriétaire).

Utilisé quand le fuseau de l'utilisateur change (Paramètres) et par la commande
`recalculate_trade_days`. Les trades sont mis à jour sans passer par save() (pas de
signaux par trade) ; les données dérivées du jour sont ensuite recalculées une fois :
rollups journaliers, métriques MLL et cache de statistiques.
"""
from __future__ import annotations

import logging
from datetime import date
from typing import Dict

from django.contrib.auth import get_user_model
from django.db import transaction

from ..models import ImportedTrade
from ..timezone_utils import get_timezone_for_user, local_trade_day

logger = logging.getLogger(__name__)


def recalculate_trade_days_for_user(user_id: int, dry_run: bool = False) -> int:
    """
    Aligne trade_day sur le fuseau actuel de l'utilisateur.
    Retourne le nombre de trades dont le jour a changé.
    """
    user = get_user_model().objects.select_related('preferences').filter(pk=user_id).first()
    if user is None:
        return 0
    tz = get_timezone_for_user(user)

    changed = []
    # Plus petite date touchée (ancienne ou nouvelle) par compte, pour le recalcul MLL
    earliest_by_account: Dict[int, date] = {}
    trades = (
        ImportedTrade.objects.filter(user_id=user_id)
        .order_by()
        .only('id', 'entered_at', 'trade_day', 'trading_account_id')
    )
    for trade in trades.iterator(chunk_size=500):
        new_day = local_trade_day(trade.entered_at, tz)
        if new_day is None or new_day == trade.trade_day:
            continue
        if trade.trading_account_id:
            touched = min(d for d in (trade.trade_day, new_day) if d is not None)
            current = earliest_by_account.get(trade.trading_account_id)
            earliest_by_account[trade.trading_account_id] = min(current, touched) if current else touched
        trade.trade_day = new_day
        changed.append(trade)

    if not changed or dry_run:
        return len(changed)

    with transaction.atomic():
        ImportedTrade.objects.bulk_update(changed, ['trade_day'], batch_size=500)

    _refresh_day_derived_data(user_id, earliest_by_account)
    logger.info('trade_day recalculé pour %s trade(s) de l\'utilisateur %s', len(changed), user_id)
    return len(changed)


def _refresh_day_derived_data(user_id: int, earliest_by_account: Dict[int, date]) -> None:
    from ..models import AccountDailyMetrics, TradingAccount
    from ..stats_response_cache import invalidate_user_stats_cache
    from .metrics_calculator import AccountMetricsCalculator
    from .rollup_service import rebuild_rollups_for_user, user_has_rollups

    if user_has_rollups(user_id):
        rebuild_rollups_for_user(user_id)

    calculator = AccountMetricsCalculator()
    for account in TradingAccount.objects.filter(id__in=earliest_by_account.keys(), mll_enabled=True):
        from_date = earliest_by_account[account.id]
        try:
            # Jours vidés par le déplacement : supprimer leur métrique (comme à la suppression d'un trade)
            trade_days = ImportedTrade.objects.filter(
                trading_account=account, trade_day__gte=from_date
            ).values_list('trade_day', flat=True)
            AccountDailyMetrics.objects.filter(trading_account=account, date__gte=from_date).exclude(
                date__in=trade_days
            ).delete()
            calculator.recalculate_metrics_from_date(account, from_date)
        except Exception as exc:  # pragma: no cover - journalisé, ne bloque pas les autres comptes
            logger.error('Recalcul MLL après changement de trade_day (compte %s) : %s', account.id, exc)

    invalidate_user_stats_cache(user_id)
