"""Alias symboles ProjectX / TopStepX → clés FUTURES_CONTRACT_SPECS."""
from __future__ import annotations

import re
from typing import Any, Optional

from .contract_specs import FUTURES_CONTRACT_SPECS
from .topstep_contract_catalog import TOPSTEP_LIVE_CONTRACTS

# Suffixe mois/année sur le champ API « name » (ex. NQU5, 6BU5, SR3Z5)
_TOPSTEP_NAME_SUFFIX = re.compile(r'^[FGHJKMNQUVXZ]\d{1,2}$', re.I)


def spec_symbol_from_topstep_name(name: str) -> Optional[str]:
    """
    Déduit le symbole specs à partir du nom court TopStep (ex. NQU5 → NQ, 6BU5 → 6B).
    """
    symbol = (name or '').upper().strip()
    if not symbol:
        return None
    for length in range(min(4, len(symbol)), 0, -1):
        prefix = symbol[:length]
        if prefix not in FUTURES_CONTRACT_SPECS:
            continue
        suffix = symbol[length:]
        if not suffix or _TOPSTEP_NAME_SUFFIX.match(suffix):
            return prefix
    return None


def broker_symbol_from_contract_id(contract_id: str) -> Optional[str]:
    """Segment broker dans CON.F.US.XXX.M26 → XXX."""
    parts = (contract_id or '').strip().split('.')
    if len(parts) >= 4 and parts[0] == 'CON':
        return parts[-2].upper()
    if len(parts) == 2 and parts[0] == 'CON':
        return parts[1].upper()
    return None


def build_broker_symbol_aliases_from_contracts(
    contracts: list[dict[str, Any]],
) -> dict[str, str]:
    """
    Construit la table broker → specs à partir de la réponse Contract/available.

    Chaque entrée API fournit id (CON.F.US.ENQ.U25) et name (NQU5).
    """
    aliases: dict[str, str] = {}
    for row in contracts:
        contract_id = row.get('id') or row.get('contractId') or ''
        name = row.get('name') or ''
        broker = broker_symbol_from_contract_id(str(contract_id))
        spec = spec_symbol_from_topstep_name(str(name))
        if not broker or not spec or broker == spec:
            continue
        existing = aliases.get(broker)
        if existing is not None and existing != spec:
            raise ValueError(
                f'Conflit alias TopStep pour {broker}: {existing} vs {spec} '
                f'(contrat {contract_id!r})'
            )
        aliases[broker] = spec
    return aliases


def merge_broker_symbol_aliases(
    *sources: dict[str, str],
) -> dict[str, str]:
    merged: dict[str, str] = {}
    for source in sources:
        for broker, spec in source.items():
            prev = merged.get(broker)
            if prev is not None and prev != spec:
                raise ValueError(f'Conflit alias {broker}: {prev} vs {spec}')
            merged[broker] = spec
    return merged


def default_broker_symbol_aliases() -> dict[str, str]:
    """Alias broker → specs pour le catalogue TopStep live intégré."""
    return build_broker_symbol_aliases_from_contracts(TOPSTEP_LIVE_CONTRACTS)


# Catalogue TopStep live (27 contrats) — rafraîchir via fetch_topstep_contract_aliases
DEFAULT_BROKER_SYMBOL_ALIASES: dict[str, str] = default_broker_symbol_aliases()
