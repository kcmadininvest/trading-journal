"""Création idempotente de trades broker (CSV et API)."""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction

from trades.models import TopStepTrade
from trades.utils import _recalculate_mll_for_topstep_accounts


def trade_exists(user, trading_account, topstep_id: str) -> bool:
    return TopStepTrade.objects.filter(
        user=user,
        trading_account=trading_account,
        topstep_id=topstep_id,
    ).exists()


def create_trade_from_parsed(user, trading_account, parsed: dict) -> TopStepTrade | None:
    """Crée un trade si topstep_id absent. Ne met jamais à jour un trade existant."""
    topstep_id = parsed['topstep_id']
    if trade_exists(user, trading_account, topstep_id):
        return None
    return TopStepTrade.objects.create(
        user=user,
        trading_account=trading_account,
        topstep_id=topstep_id,
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
def import_parsed_trades(user, trading_account, parsed_rows: list[dict]) -> dict[str, int]:
    created = 0
    skipped = 0
    for parsed in parsed_rows:
        if create_trade_from_parsed(user, trading_account, parsed):
            created += 1
        else:
            skipped += 1
    if created:
        _recalculate_mll_for_topstep_accounts([trading_account])
    return {'created': created, 'skipped': skipped}
