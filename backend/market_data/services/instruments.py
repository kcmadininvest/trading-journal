"""Catalogue d'instruments racines (générique, pas de whitelist)."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from integrations.topstepx_client import TopStepXApiClient, TopStepXApiError
from trades.contract_utils.contract_family import get_base_symbol
from trades.contract_utils.contract_specs import FUTURES_CONTRACT_SPECS
from trades.contract_utils.topstep_aliases import (
    broker_symbol_from_contract_id,
    spec_symbol_from_topstep_name,
)
from trades.contract_utils.topstep_contract_catalog import TOPSTEP_LIVE_CONTRACTS

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class InstrumentInfo:
    instrument: str
    symbol_id: str
    broker_symbol: str
    name: str
    tick_size: float | None = None
    tick_value: float | None = None


def _instrument_from_row(row: dict[str, Any]) -> InstrumentInfo | None:
    contract_id = str(row.get('id') or row.get('contractId') or '').strip()
    name = str(row.get('name') or '').strip()
    symbol_id = str(row.get('symbolId') or '').strip()
    broker = broker_symbol_from_contract_id(contract_id) or ''
    root = (
        spec_symbol_from_topstep_name(name)
        or get_base_symbol(contract_id)
        or get_base_symbol(name)
    )
    if not root and broker and broker in FUTURES_CONTRACT_SPECS:
        root = broker
    if not root:
        return None
    tick_size = row.get('tickSize')
    tick_value = row.get('tickValue')
    try:
        tick_size_f = float(tick_size) if tick_size is not None else None
    except (TypeError, ValueError):
        tick_size_f = None
    try:
        tick_value_f = float(tick_value) if tick_value is not None else None
    except (TypeError, ValueError):
        tick_value_f = None
    return InstrumentInfo(
        instrument=root.upper(),
        symbol_id=symbol_id.upper() if symbol_id else '',
        broker_symbol=broker.upper() if broker else '',
        name=FUTURES_CONTRACT_SPECS.get(root.upper(), {}).get('name', root.upper()),
        tick_size=tick_size_f,
        tick_value=tick_value_f,
    )


def instruments_from_contract_rows(rows: list[dict[str, Any]]) -> list[InstrumentInfo]:
    by_root: dict[str, InstrumentInfo] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        info = _instrument_from_row(row)
        if info is None:
            continue
        existing = by_root.get(info.instrument)
        if existing is None:
            by_root[info.instrument] = info
            continue
        # Préférer une entrée avec symbol_id rempli
        if not existing.symbol_id and info.symbol_id:
            by_root[info.instrument] = info
    return sorted(by_root.values(), key=lambda i: i.instrument)


def list_instruments_from_catalog() -> list[InstrumentInfo]:
    return instruments_from_contract_rows(list(TOPSTEP_LIVE_CONTRACTS))


def list_instruments(
    client: TopStepXApiClient | None = None,
    auth_token: str | None = None,
) -> list[InstrumentInfo]:
    """
    Liste les instruments racines disponibles.
    Essaie Contract/available (live puis sim), sinon catalogue embarqué.
    """
    rows: list[dict[str, Any]] = []
    if client is not None and auth_token:
        for live in (True, False):
            try:
                batch = client.list_available_contracts(auth_token, live=live)
                if batch:
                    rows.extend(batch)
                    break
            except TopStepXApiError as exc:
                logger.warning('Contract/available live=%s failed: %s', live, exc)
    if not rows:
        rows = list(TOPSTEP_LIVE_CONTRACTS)
    return instruments_from_contract_rows(rows)


def search_instruments(
    search_text: str,
    client: TopStepXApiClient | None = None,
    auth_token: str | None = None,
) -> list[InstrumentInfo]:
    """Complète le catalogue via Contract/search."""
    base = list_instruments(client, auth_token)
    by_root = {i.instrument: i for i in base}
    if client is None or not auth_token or not search_text.strip():
        return base
    for live in (True, False):
        try:
            rows = client.search_contracts(auth_token, search_text=search_text, live=live)
        except TopStepXApiError as exc:
            logger.warning('Contract/search %s live=%s: %s', search_text, live, exc)
            continue
        for info in instruments_from_contract_rows(rows):
            by_root[info.instrument] = info
        if rows:
            break
    return sorted(by_root.values(), key=lambda i: i.instrument)
