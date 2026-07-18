"""Création idempotente de trades broker (CSV et API)."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.db import transaction

from trades.models import ImportedTrade
from trades.utils import _recalculate_mll_for_topstep_accounts


def trade_exists(user, trading_account, external_trade_id: str) -> bool:
    return ImportedTrade.objects.filter(
        user=user,
        trading_account=trading_account,
        external_trade_id=external_trade_id,
    ).exists()


def create_trade_from_parsed(user, trading_account, parsed: dict) -> ImportedTrade | None:
    """Crée un trade si external_trade_id absent. Ne met jamais à jour un trade existant."""
    external_trade_id = parsed['external_trade_id']
    if trade_exists(user, trading_account, external_trade_id):
        return None
    return ImportedTrade.objects.create(
        user=user,
        trading_account=trading_account,
        external_trade_id=external_trade_id,
        contract_name=parsed['contract_name'],
        entered_at=parsed['entered_at'],
        exited_at=parsed.get('exited_at'),
        entry_price=parsed['entry_price'],
        exit_price=parsed.get('exit_price'),
        fees=parsed.get('fees') or Decimal('0'),
        size=parsed['size'],
        trade_type=parsed['trade_type'],
        trade_day=parsed.get('trade_day'),
        trade_duration=parsed.get('trade_duration'),
        commissions=parsed.get('commissions') or Decimal('0'),
        point_value=parsed.get('point_value'),
        pnl=parsed.get('pnl'),
        raw_data=parsed.get('raw_data'),
    )


@transaction.atomic
def import_parsed_trades(user, trading_account, parsed_rows: list[dict]) -> dict:
    created = 0
    skipped = 0
    created_trade_days: set[date] = set()
    for parsed in parsed_rows:
        trade = create_trade_from_parsed(user, trading_account, parsed)
        if trade:
            created += 1
            trade_day = trade.trade_day or parsed.get('trade_day')
            if trade_day:
                created_trade_days.add(trade_day)
        else:
            skipped += 1
    if created:
        _recalculate_mll_for_topstep_accounts([trading_account])
    return {
        'created': created,
        'skipped': skipped,
        'created_trade_days': created_trade_days,
    }
