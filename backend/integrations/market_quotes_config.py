"""Configuration et résolution des contrats pour le bandeau cours TopStepX."""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from typing import Any

from integrations.topstepx_client import TopStepXApiClient, TopStepXApiError

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


def _pick_front_month_contract(
    contracts: list[dict[str, Any]],
    *,
    symbol_id: str,
    broker_symbol: str | None,
    today: date | None = None,
) -> dict[str, Any] | None:
    today = today or date.today()
    candidates: list[tuple[date, dict[str, Any]]] = []
    symbol_id_upper = symbol_id.upper()
    broker_upper = (broker_symbol or '').upper()

    for row in contracts:
        cid = str(row.get('id') or row.get('contractId') or '')
        sid = str(row.get('symbolId') or '')
        if not cid.startswith('CON.'):
            continue
        parts = cid.split('.')
        broker = parts[-2].upper() if len(parts) >= 4 else ''
        if sid.upper() != symbol_id_upper and broker != broker_upper:
            continue
        expiry = _expiry_from_contract_id(cid, today)
        if expiry is None or expiry >= today.replace(day=1):
            sort_date = expiry or date(9999, 12, 31)
            candidates.append((sort_date, row))

    if not candidates:
        return None
    candidates.sort(key=lambda item: item[0])
    return candidates[0][1]


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
        except TopStepXApiError:
            continue
    return []


def resolve_market_quote_contracts(
    client: TopStepXApiClient,
    auth_token: str,
    *,
    today: date | None = None,
) -> list[ResolvedMarketContract]:
    """Résout les contract_id front month pour chaque instrument du bandeau."""
    resolved: list[ResolvedMarketContract] = []
    today = today or date.today()

    for instrument in MARKET_QUOTE_INSTRUMENTS:
        rows = _search_contracts_for_instrument(
            client,
            auth_token,
            instrument.search_text,
        )

        chosen = _pick_front_month_contract(
            rows,
            symbol_id=instrument.symbol_id,
            broker_symbol=instrument.broker_symbol,
            today=today,
        )
        if chosen is None:
            continue

        contract_id = str(chosen.get('id') or chosen.get('contractId') or '')
        tick_raw = chosen.get('tickSize')
        try:
            tick_size = float(tick_raw) if tick_raw is not None else 0.01
        except (TypeError, ValueError):
            tick_size = 0.01

        resolved.append(
            ResolvedMarketContract(
                key=instrument.key,
                label=instrument.label,
                contract_id=contract_id,
                symbol_id=str(chosen.get('symbolId') or instrument.symbol_id),
                tick_size=tick_size,
                name=str(chosen.get('name') or instrument.search_text),
            )
        )

    return resolved
