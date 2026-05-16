"""
Mapping API TopStepX (Trade/search) → format TopStepTrade.

Stratégie topstep_id (spike documenté):
- L'API renvoie des fills (demi-tours). On apparie entrée (profitAndLoss null) + sortie (PnL renseigné).
- topstep_id = str(id) du fill de sortie (clôture), aligné sur l'identifiant broker quand l'export
  CSV utilise le même Id pour le round-trip.
- Si un trade CSV existe déjà avec le même topstep_id, la sync l'ignore (insert-only).
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any

from django.utils.dateparse import parse_datetime

from trades.contract_utils.contract_specs import get_point_value_from_contract


def parse_api_timestamp(value: str) -> datetime:
    dt = parse_datetime(value)
    if dt is None:
        raise ValueError(f'Timestamp API invalide: {value!r}')
    if dt.tzinfo is None:
        from django.utils import timezone as django_tz
        return django_tz.make_aware(dt)
    return dt


def _side_to_trade_type(side: int | None, default: str = 'Long') -> str:
    if side == 1:
        return 'Short'
    if side == 0:
        return 'Long'
    return default


def _decimal(value: Any) -> Decimal | None:
    if value is None:
        return None
    return Decimal(str(value))


def _build_parsed_round_trip(
    entry: dict[str, Any] | None,
    exit_fill: dict[str, Any],
) -> dict[str, Any]:
    exit_ts = parse_api_timestamp(exit_fill['creationTimestamp'])
    entry_ts = parse_api_timestamp(entry['creationTimestamp']) if entry else exit_ts

    entry_price = _decimal(entry['price']) if entry else _decimal(exit_fill['price'])
    exit_price = _decimal(exit_fill['price'])
    entry_fees = _decimal(entry.get('fees')) if entry else Decimal('0')
    exit_fees = _decimal(exit_fill.get('fees')) or Decimal('0')
    fees = (entry_fees or Decimal('0')) + exit_fees
    commissions = fees

    trade_type = _side_to_trade_type(entry.get('side') if entry else exit_fill.get('side'))
    contract_name = str(
        exit_fill.get('contractId') or (entry.get('contractId') if entry else None) or 'UNKNOWN'
    )
    size = _decimal(exit_fill.get('size')) or _decimal(entry.get('size') if entry else None) or Decimal('1')
    pnl = _decimal(exit_fill.get('profitAndLoss'))

    if entry_ts and exit_ts and exit_ts >= entry_ts:
        trade_duration = exit_ts - entry_ts
        entered_at = entry_ts
        exited_at = exit_ts
    else:
        trade_duration = None
        entered_at = entry_ts
        exited_at = exit_ts

    trade_day = entered_at.date() if entered_at else exit_ts.date()

    return {
        'topstep_id': str(exit_fill['id']),
        'contract_name': contract_name,
        'entered_at': entered_at,
        'exited_at': exited_at,
        'entry_price': entry_price,
        'exit_price': exit_price,
        'fees': fees,
        'size': size,
        'trade_type': trade_type,
        'trade_day': trade_day,
        'trade_duration': trade_duration,
        'commissions': commissions,
        'point_value': get_point_value_from_contract(contract_name),
        'pnl': pnl,
        'raw_data': {
            'source': 'topstepx_api',
            'entry_fill': entry,
            'exit_fill': exit_fill,
        },
    }


def aggregate_fills_to_round_trips(fills: list[dict[str, Any]]) -> list[dict]:
    """Apparie les fills en round-trips fermés."""
    active = [f for f in fills if not f.get('voided')]
    active.sort(key=lambda f: f.get('creationTimestamp') or '')

    by_contract: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for fill in active:
        key = str(fill.get('contractId') or '_unknown')
        by_contract[key].append(fill)

    parsed_rows: list[dict] = []
    for contract_fills in by_contract.values():
        i = 0
        while i < len(contract_fills):
            fill = contract_fills[i]
            pnl = fill.get('profitAndLoss')
            if pnl is not None:
                entry = None
                if i > 0 and contract_fills[i - 1].get('profitAndLoss') is None:
                    entry = contract_fills[i - 1]
                try:
                    parsed_rows.append(_build_parsed_round_trip(entry, fill))
                except (ValueError, KeyError):
                    pass
                i += 1
                continue

            if i + 1 < len(contract_fills) and contract_fills[i + 1].get('profitAndLoss') is not None:
                try:
                    parsed_rows.append(_build_parsed_round_trip(fill, contract_fills[i + 1]))
                except (ValueError, KeyError):
                    pass
                i += 2
            else:
                i += 1
    return parsed_rows


def map_api_trades_to_parsed_rows(api_trades: list[dict[str, Any]]) -> list[dict]:
    return aggregate_fills_to_round_trips(api_trades)
