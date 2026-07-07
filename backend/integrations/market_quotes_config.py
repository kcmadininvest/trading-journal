"""Configuration et résolution des contrats pour le bandeau cours TopStepX."""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import date
from typing import Any

from integrations.topstepx_client import TopStepXApiClient, TopStepXApiError

logger = logging.getLogger(__name__)

# Codes mois CME (lettre → mois calendaire)
_FUTURES_MONTH = {
    'F': 1,
    'G': 2,
    'H': 3,
    'J': 4,
    'K': 5,
    'M': 6,
    'N': 7,
    'Q': 8,
    'U': 9,
    'V': 10,
    'X': 11,
    'Z': 12,
}

_CONTRACT_SUFFIX = re.compile(r'^[FGHJKMNQUVXZ](\d{1,2})$', re.I)


@dataclass(frozen=True)
class MarketQuoteInstrument:
    key: str
    label: str
    search_text: str
    symbol_id: str
    broker_symbol: str | None = None


MARKET_QUOTE_INSTRUMENTS: tuple[MarketQuoteInstrument, ...] = (
    MarketQuoteInstrument('nasdaq', 'Nasdaq', 'NQ', 'F.US.ENQ', 'ENQ'),
    MarketQuoteInstrument('sp500', 'S&P 500', 'ES', 'F.US.EP', 'EP'),
    MarketQuoteInstrument('gold', 'Or', 'MGC', 'F.US.MGC', 'MGC'),
    MarketQuoteInstrument('eurusd', 'EUR/USD', 'M6E', 'F.US.M6E', 'M6E'),
    MarketQuoteInstrument('bitcoin', 'Bitcoin', 'MBT', 'F.US.MBT', 'MBT'),
)

# Décimales minimales à l'affichage (bandeau dashboard).
DEFAULT_MIN_DISPLAY_DECIMALS = 2

INSTRUMENT_MIN_DISPLAY_DECIMALS: dict[str, int] = {
    'eurusd': 4,
}

INSTRUMENT_DEFAULT_TICK_SIZE: dict[str, float] = {
    'eurusd': 0.0001,
}


def min_display_decimals_for_instrument(instrument_key: str) -> int:
    return INSTRUMENT_MIN_DISPLAY_DECIMALS.get(instrument_key, DEFAULT_MIN_DISPLAY_DECIMALS)


def default_tick_size_for_instrument(instrument_key: str) -> float:
    return INSTRUMENT_DEFAULT_TICK_SIZE.get(instrument_key, 0.01)


@dataclass
class ResolvedMarketContract:
    key: str
    label: str
    contract_id: str
    symbol_id: str
    tick_size: float
    name: str


def _expiry_from_contract_id(contract_id: str, today: date | None = None) -> date | None:
    """Déduit une date d'échéance approximative depuis CON.F.US.ENQ.U25."""
    today = today or date.today()
    parts = (contract_id or '').strip().split('.')
    if len(parts) < 2:
        return None
    suffix = parts[-1].upper()
    match = _CONTRACT_SUFFIX.match(suffix)
    if not match:
        return None
    month_letter = suffix[0]
    year_digits = int(match.group(1))
    month = _FUTURES_MONTH.get(month_letter)
    if month is None:
        return None
    century = today.year // 100 * 100
    year = century + year_digits
    if year < today.year - 1:
        year += 100
    try:
        return date(year, month, 28)
    except ValueError:
        return None


def _contract_matches_instrument(
    row: dict[str, Any],
    *,
    symbol_id: str,
    broker_symbol: str | None,
) -> bool:
    cid = str(row.get('id') or row.get('contractId') or '')
    if not cid.startswith('CON.'):
        return False
    sid = str(row.get('symbolId') or '').upper()
    symbol_id_upper = symbol_id.upper()
    broker_upper = (broker_symbol or '').upper()
    parts = cid.split('.')
    broker = parts[-2].upper() if len(parts) >= 4 else ''
    return sid == symbol_id_upper or broker == broker_upper


def _is_active_contract(row: dict[str, Any]) -> bool:
    raw = row.get('activeContract')
    if raw is True or raw == 1:
        return True
    if isinstance(raw, str):
        return raw.strip().lower() in ('true', '1', 'yes')
    return False


def _pick_front_month_contract(
    contracts: list[dict[str, Any]],
    *,
    symbol_id: str,
    broker_symbol: str | None,
    today: date | None = None,
) -> dict[str, Any] | None:
    today = today or date.today()
    month_start = today.replace(day=1)
    candidates: list[tuple[date, dict[str, Any]]] = []
    symbol_matches: list[tuple[date, dict[str, Any]]] = []

    for row in contracts:
        cid = str(row.get('id') or row.get('contractId') or '')
        if not _contract_matches_instrument(
            row,
            symbol_id=symbol_id,
            broker_symbol=broker_symbol,
        ):
            continue
        expiry = _expiry_from_contract_id(cid, today)
        sort_date = expiry or date(9999, 12, 31)
        symbol_matches.append((sort_date, row))
        if expiry is None or expiry >= month_start:
            candidates.append((sort_date, row))

    if candidates:
        candidates.sort(key=lambda item: item[0])
        return candidates[0][1]

    if symbol_matches:
        symbol_matches.sort(key=lambda item: item[0], reverse=True)
        return symbol_matches[0][1]

    return None


def _search_contracts_for_instrument(
    client: TopStepXApiClient,
    auth_token: str,
    search_text: str,
) -> list[dict[str, Any]]:
    """Essaie live puis sim : certains comptes API n'exposent que les contrats sim."""
    for live in (True, False):
        try:
            rows = client.search_contracts(
                auth_token,
                search_text=search_text,
                live=live,
            )
            if rows:
                return rows
        except TopStepXApiError as exc:
            logger.warning(
                'Contract/search échoué search_text=%s live=%s: %s',
                search_text,
                live,
                exc.error_code or exc,
            )
            continue
    return []


def _pick_contract_for_instrument(
    contracts: list[dict[str, Any]],
    *,
    symbol_id: str,
    broker_symbol: str | None,
    today: date | None = None,
) -> dict[str, Any] | None:
    """Choisit le contrat actif TopStep (activeContract) ou repli échéance CME."""
    matches = [
        row
        for row in contracts
        if _contract_matches_instrument(row, symbol_id=symbol_id, broker_symbol=broker_symbol)
    ]
    if not matches:
        return None

    active_rows = [row for row in matches if _is_active_contract(row)]
    if len(active_rows) == 1:
        return active_rows[0]
    if len(active_rows) > 1:
        chosen = _pick_front_month_contract(
            active_rows,
            symbol_id=symbol_id,
            broker_symbol=broker_symbol,
            today=today,
        )
        if chosen is not None:
            return chosen
        return active_rows[0]

    return _pick_front_month_contract(
        matches,
        symbol_id=symbol_id,
        broker_symbol=broker_symbol,
        today=today,
    )


def _fetch_available_contract_catalog(
    client: TopStepXApiClient,
    auth_token: str,
) -> list[dict[str, Any]]:
    """Catalogue complet via Contract/available (live puis sim)."""
    for live in (True, False):
        try:
            rows = client.list_available_contracts(auth_token, live=live)
            if rows:
                logger.debug('Contract/available live=%s: %d contrat(s)', live, len(rows))
                return rows
        except TopStepXApiError as exc:
            logger.warning(
                'Contract/available échoué live=%s: %s',
                live,
                exc.error_code or exc,
            )
    return []


def _resolved_from_row(
    instrument: MarketQuoteInstrument,
    chosen: dict[str, Any],
) -> ResolvedMarketContract:
    contract_id = str(chosen.get('id') or chosen.get('contractId') or '')
    tick_raw = chosen.get('tickSize')
    try:
        tick_size = float(tick_raw) if tick_raw is not None else 0.01
    except (TypeError, ValueError):
        tick_size = 0.01
    return ResolvedMarketContract(
        key=instrument.key,
        label=instrument.label,
        contract_id=contract_id,
        symbol_id=str(chosen.get('symbolId') or instrument.symbol_id),
        tick_size=tick_size,
        name=str(chosen.get('name') or instrument.search_text),
    )


def resolve_market_quote_contracts(
    client: TopStepXApiClient,
    auth_token: str,
    *,
    today: date | None = None,
) -> list[ResolvedMarketContract]:
    """Résout les contrats actifs (activeContract) pour chaque instrument du bandeau."""
    resolved: list[ResolvedMarketContract] = []
    today = today or date.today()
    catalog = _fetch_available_contract_catalog(client, auth_token)

    for instrument in MARKET_QUOTE_INSTRUMENTS:
        chosen = None
        if catalog:
            chosen = _pick_contract_for_instrument(
                catalog,
                symbol_id=instrument.symbol_id,
                broker_symbol=instrument.broker_symbol,
                today=today,
            )
        if chosen is None:
            rows = _search_contracts_for_instrument(
                client,
                auth_token,
                instrument.search_text,
            )
            chosen = _pick_contract_for_instrument(
                rows,
                symbol_id=instrument.symbol_id,
                broker_symbol=instrument.broker_symbol,
                today=today,
            )
        if chosen is None:
            logger.warning(
                'Aucun contrat pour instrument=%s symbol_id=%s',
                instrument.key,
                instrument.symbol_id,
            )
            continue

        resolved.append(_resolved_from_row(instrument, chosen))

    return resolved
