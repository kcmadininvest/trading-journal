"""Libellés et champs résumés pour les événements de replay."""
from __future__ import annotations

from typing import Any

from trades.sync.topstepx_mapper import _side_to_trade_type

ORDER_TYPE_LABELS: dict[int, str] = {
    0: 'unknown',
    1: 'limit',
    2: 'market',
    3: 'stop_limit',
    4: 'stop',
    5: 'trailing_stop',
    6: 'join_bid',
    7: 'join_ask',
}

ORDER_STATUS_LABELS: dict[int, str] = {
    0: 'none',
    1: 'open',
    2: 'filled',
    3: 'cancelled',
    4: 'expired',
    5: 'rejected',
    6: 'pending',
}


def format_contract_label(contract_id: Any) -> str:
    from trades.contract_utils.contract_family import normalize_contract_symbol

    return normalize_contract_symbol(contract_id)


def _enum_label(mapping: dict[int, str], raw: Any, default: str = 'unknown') -> str:
    if raw is None:
        return default
    try:
        key = int(raw)
    except (TypeError, ValueError):
        return default
    return mapping.get(key, default)


def order_summary(order: dict[str, Any]) -> dict[str, Any]:
    """Champs normalisés pour affichage (ordre TopStep / ProjectX)."""
    side_raw = order.get('side')
    order_type_raw = order.get('type')
    if order_type_raw is None:
        order_type_raw = order.get('orderType')
    status_raw = order.get('status')
    fill_volume = order.get('fillVolume')
    size = order.get('size')
    summary: dict[str, Any] = {
        'contract_name': format_contract_label(order.get('contractId')),
        'trade_type': _side_to_trade_type(side_raw) if side_raw is not None else None,
        'side_code': side_raw,
        'size': size,
        'fill_volume': fill_volume,
        'order_type': _enum_label(ORDER_TYPE_LABELS, order_type_raw),
        'order_status': _enum_label(ORDER_STATUS_LABELS, status_raw),
        'limit_price': order.get('limitPrice'),
        'stop_price': order.get('stopPrice'),
        'filled_price': order.get('filledPrice'),
    }
    if summary['filled_price'] is None and order.get('price') is not None:
        summary['filled_price'] = order.get('price')
    return {k: v for k, v in summary.items() if v is not None and v != ''}


def fill_summary(fill: dict[str, Any]) -> dict[str, Any]:
    side_raw = fill.get('side')
    summary: dict[str, Any] = {
        'contract_name': format_contract_label(fill.get('contractId')),
        'trade_type': _side_to_trade_type(side_raw) if side_raw is not None else None,
        'side_code': side_raw,
        'size': fill.get('size'),
        'price': fill.get('price'),
        'pnl': fill.get('profitAndLoss'),
    }
    return {k: v for k, v in summary.items() if v is not None and v != ''}
