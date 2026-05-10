"""
Sélection du champ Trade (pnl vs net_pnl) selon les préférences utilisateur.
"""
from decimal import Decimal
from typing import Any


def get_trade_pnl_field_for_request(user, request) -> str:
    """
    Champ ORM ('pnl' ou 'net_pnl') pour agrégations.
    Le paramètre GET ``pnl_display=net|gross`` prime sur les préférences utilisateur
    (même valeur que le toggle UI, sans attendre le PUT des préférences).
    """
    if request is not None:
        raw = request.query_params.get('pnl_display')
        if isinstance(raw, str):
            key = raw.strip().lower()
            if key in ('gross', 'brut'):
                return 'pnl'
            if key == 'net':
                return 'net_pnl'
    return get_trade_pnl_field(user)


def get_trade_pnl_field(user) -> str:
    """
    Retourne 'pnl' (brut) ou 'net_pnl' selon UserPreferences.pnl_display.
    Repli net_pnl si utilisateur anonyme ou préférences absentes.
    """
    if user is None or not getattr(user, 'is_authenticated', False):
        return 'net_pnl'
    if not hasattr(user, 'preferences'):
        return 'net_pnl'
    if user.preferences.pnl_display == 'gross':
        return 'pnl'
    return 'net_pnl'


def trade_pnl_as_decimal(trade: Any, field: str) -> Decimal:
    """
    Valeur PnL pour agrégations en Python. En mode brut, si pnl est null, repli sur net_pnl.
    """
    if field == 'pnl':
        raw = getattr(trade, 'pnl', None)
        if raw is not None:
            return raw if isinstance(raw, Decimal) else Decimal(str(raw))
        raw_net = getattr(trade, 'net_pnl', None)
        if raw_net is not None:
            return raw_net if isinstance(raw_net, Decimal) else Decimal(str(raw_net))
        return Decimal('0')
    raw = getattr(trade, 'net_pnl', None)
    if raw is not None:
        return raw if isinstance(raw, Decimal) else Decimal(str(raw))
    return Decimal('0')


def trade_pnl_as_float(trade: Any, field: str) -> float:
    """Alias pratique pour code historique basé sur float."""
    return float(trade_pnl_as_decimal(trade, field))


def get_trade_join_pnl_field(user) -> str:
    """Préfixe ORM pour TradeStrategy → trade (ex. trade__net_pnl)."""
    return f'trade__{get_trade_pnl_field(user)}'


def get_trade_join_pnl_field_for_request(user, request) -> str:
    """Comme get_trade_join_pnl_field, avec override query ``pnl_display``."""
    return f'trade__{get_trade_pnl_field_for_request(user, request)}'
