"""Familles de contrats futures et exposition comparable (micro / e-mini)."""
from __future__ import annotations

from decimal import Decimal
from typing import Any, Optional

from .contract_specs import FUTURES_CONTRACT_SPECS
from .topstep_aliases import DEFAULT_BROKER_SYMBOL_ALIASES

# Micro → symbole canonique de famille (e-mini / contrat parent)
MICRO_TO_FAMILY_PARENT: dict[str, str] = {
    'MNQ': 'NQ',
    'MES': 'ES',
    'MYM': 'YM',
    'M2K': 'RTY',
    'MCL': 'CL',
    'MGC': 'GC',
    'M6E': '6E',
    'M6B': '6B',
    'M6A': '6A',
    'MJY': '6J',
    'MBT': 'BTC',
    'MET': 'ETH',
}

# E-mini / mini liés au même sous-jacent que le contrat plein
RELATED_MINI_TO_FAMILY_PARENT: dict[str, str] = {
    'QM': 'CL',
    'QG': 'NG',
    'QC': 'ZC',
    'SIL': 'SI',
    'E7': '6E',
    'MCD': '6C',
}

# Symboles ProjectX / TopStepX (segment CON.F.US.XXX) → FUTURES_CONTRACT_SPECS
# Liste par défaut issue de Contract/available ; rafraîchir via manage.py fetch_topstep_contract_aliases
BROKER_SYMBOL_ALIASES: dict[str, str] = dict(DEFAULT_BROKER_SYMBOL_ALIASES)


def normalize_contract_symbol(contract_id: Any) -> str:
    """
    Extrait le symbole affichable depuis un intitulé brut.

    Exemples:
        NQM6 -> NQM6 (puis get_base_symbol -> NQ)
        CON.F.US.MNQ.M26 -> MNQ
        CON.F.US.ENQ.M26 -> ENQ (puis alias -> NQ)
        CON.NQ -> NQ
    """
    if contract_id is None:
        return ''
    cid = str(contract_id).strip()
    if not cid:
        return ''
    parts = cid.split('.')
    if len(parts) >= 4 and parts[0] == 'CON':
        return parts[-2]
    if len(parts) == 2 and parts[0] == 'CON':
        return parts[1]
    return cid


def _apply_broker_symbol_alias(symbol: str) -> str:
    upper = symbol.upper()
    return BROKER_SYMBOL_ALIASES.get(upper, upper)


def get_base_symbol(contract_name: str) -> Optional[str]:
    """Symbole racine dans FUTURES_CONTRACT_SPECS (ex. NQM6 -> NQ, CON.F.US.ENQ.M26 -> NQ)."""
    normalized = normalize_contract_symbol(contract_name)
    if not normalized:
        return None
    token = normalized.upper()
    if token in BROKER_SYMBOL_ALIASES:
        aliased = BROKER_SYMBOL_ALIASES[token]
        if aliased in FUTURES_CONTRACT_SPECS:
            return aliased
    if token in FUTURES_CONTRACT_SPECS:
        return token
    for length in range(min(4, len(normalized)), 0, -1):
        base_symbol = normalized[:length].upper()
        if not base_symbol.isalnum():
            continue
        aliased = _apply_broker_symbol_alias(base_symbol)
        if aliased in FUTURES_CONTRACT_SPECS:
            return aliased
    return None


def get_contract_family_key(contract_name: str) -> Optional[str]:
    """Clé de famille pour regrouper micro et e-mini (ex. MNQ et NQ -> NQ)."""
    base = get_base_symbol(contract_name)
    if base is None:
        return None
    return MICRO_TO_FAMILY_PARENT.get(base) or RELATED_MINI_TO_FAMILY_PARENT.get(base) or base


def resolve_point_value_for_contract(contract_name: str, trade_point_value: Any = None) -> Optional[Decimal]:
    """Valeur du point : specs sur symbole normalisé (alias broker inclus), puis champ trade."""
    base = get_base_symbol(contract_name)
    if base is not None and base in FUTURES_CONTRACT_SPECS:
        return Decimal(str(FUTURES_CONTRACT_SPECS[base]['point_value']))
    if trade_point_value is not None:
        try:
            return (
                trade_point_value
                if isinstance(trade_point_value, Decimal)
                else Decimal(str(trade_point_value))
            )
        except Exception:
            return None
    return None


def _trade_size_decimal(trade: Any) -> Decimal | None:
    raw = getattr(trade, 'size', None)
    if raw is None:
        return None
    try:
        return raw if isinstance(raw, Decimal) else Decimal(str(raw))
    except Exception:
        return None


def trade_risk_units(trade: Any) -> Optional[Decimal]:
    """Exposition comparable : size × point_value."""
    size = _trade_size_decimal(trade)
    if size is None:
        return None
    contract_name = getattr(trade, 'contract_name', None) or ''
    point_value = resolve_point_value_for_contract(
        contract_name,
        getattr(trade, 'point_value', None),
    )
    if point_value is None:
        return None
    return size * point_value


def risk_units_from_values(
    size: Any,
    contract_name: str,
    point_value: Any = None,
) -> Optional[Decimal]:
    """Même logique que trade_risk_units pour payloads replay (dict)."""
    if size is None:
        return None
    try:
        size_dec = size if isinstance(size, Decimal) else Decimal(str(size))
    except Exception:
        return None
    pv = resolve_point_value_for_contract(contract_name or '', point_value)
    if pv is None:
        return None
    return size_dec * pv
