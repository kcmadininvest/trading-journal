"""Pont contract_name (trades) → clés instruments bandeau marché (nasdaq, sp500, …)."""
from __future__ import annotations

from integrations.market_quotes_config import MARKET_QUOTE_INSTRUMENTS

from .contract_family import (
    get_base_symbol,
    get_contract_family_key,
    normalize_contract_symbol,
)

_INSTRUMENT_LABELS = {item.key: item.label for item in MARKET_QUOTE_INSTRUMENTS}


def resolve_market_quote_instrument_key(contract_name: str | None) -> str | None:
    """
    Mappe un contract_name trade vers la clé instrument du bandeau marché.

    Réutilise normalize_contract_symbol / get_base_symbol / get_contract_family_key
    (alias broker TopStep, specs futures) puis MARKET_QUOTE_INSTRUMENTS.
    """
    if not contract_name:
        return None

    normalized = normalize_contract_symbol(contract_name).upper()
    base = get_base_symbol(contract_name)
    family = get_contract_family_key(contract_name)

    tokens: set[str] = set()
    if normalized:
        tokens.add(normalized)
    if base:
        tokens.add(base.upper())
    if family:
        tokens.add(family.upper())

    if not tokens:
        return None

    for inst in MARKET_QUOTE_INSTRUMENTS:
        if inst.search_text.upper() in tokens:
            return inst.key
        if inst.broker_symbol and inst.broker_symbol.upper() in tokens:
            return inst.key

    return None


def market_quote_instrument_label(instrument_key: str) -> str:
    return _INSTRUMENT_LABELS.get(instrument_key, instrument_key)


def instruments_from_contract_names(contract_names: list[str]) -> list[dict[str, str]]:
    """Déduplique les contract_name tradés en instruments bandeau marché."""
    seen: dict[str, str] = {}
    for contract_name in contract_names:
        if not contract_name:
            continue
        key = resolve_market_quote_instrument_key(contract_name)
        if key and key not in seen:
            seen[key] = market_quote_instrument_label(key)
    return [
        {'key': key, 'label': label, 'name': label}
        for key, label in sorted(seen.items(), key=lambda item: item[1].lower())
    ]
