"""Résolution de contrats ProjectX pour un instrument quelconque."""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

from integrations.topstepx_client import TopStepXApiClient, TopStepXApiError
from trades.contract_utils.contract_family import get_base_symbol
from trades.contract_utils.topstep_aliases import (
    broker_symbol_from_contract_id,
    spec_symbol_from_topstep_name,
)
from trades.contract_utils.topstep_contract_catalog import TOPSTEP_LIVE_CONTRACTS

logger = logging.getLogger(__name__)

_FUTURES_MONTH = {
    'F': 1, 'G': 2, 'H': 3, 'J': 4, 'K': 5, 'M': 6,
    'N': 7, 'Q': 8, 'U': 9, 'V': 10, 'X': 11, 'Z': 12,
}
_MONTH_TO_LETTER = {v: k for k, v in _FUTURES_MONTH.items()}
_CONTRACT_SUFFIX = re.compile(r'^[FGHJKMNQUVXZ](\d{1,2})$', re.I)

# Cycles d'échéance par famille (mois calendaires)
QUARTERLY_HMUZ = (3, 6, 9, 12)
MONTHLY_ALL = tuple(range(1, 13))

EQUITY_INDEX_ROOTS = frozenset({
    'NQ', 'MNQ', 'ES', 'MES', 'RTY', 'M2K', 'YM', 'MYM', 'EMD',
})


@dataclass(frozen=True)
class ResolvedContract:
    contract_id: str
    instrument: str
    symbol: str
    symbol_id: str
    broker_symbol: str
    expiry_month: int | None
    expiry_year: int | None
    expiry_date: date | None
    raw: dict[str, Any]


def expiry_cycle_months(instrument: str) -> tuple[int, ...]:
    root = (instrument or '').upper()
    if root in EQUITY_INDEX_ROOTS:
        return QUARTERLY_HMUZ
    # Défaut conservateur : mensuel (énergies / métaux / FX souvent mensuels)
    return MONTHLY_ALL


def parse_expiry_from_contract_id(contract_id: str, today: date | None = None) -> tuple[int | None, int | None, date | None]:
    today = today or date.today()
    parts = (contract_id or '').strip().split('.')
    if len(parts) < 2:
        return None, None, None
    suffix = parts[-1].upper()
    match = _CONTRACT_SUFFIX.match(suffix)
    if not match:
        return None, None, None
    month_letter = suffix[0]
    year_digits = int(match.group(1))
    month = _FUTURES_MONTH.get(month_letter)
    if month is None:
        return None, None, None
    century = today.year // 100 * 100
    year = century + year_digits
    if year < today.year - 1:
        year += 100
    # Approximation : 3e vendredi du mois pour indices ; sinon fin de mois
    expiry = _third_friday(year, month) if month in QUARTERLY_HMUZ else date(year, month, 28)
    try:
        return month, year, expiry
    except ValueError:
        return month, year, None


def _third_friday(year: int, month: int) -> date:
    d = date(year, month, 1)
    # Premier vendredi
    while d.weekday() != 4:
        d += timedelta(days=1)
    return d + timedelta(weeks=2)


def _row_to_resolved(row: dict[str, Any], instrument_hint: str | None = None) -> ResolvedContract | None:
    contract_id = str(row.get('id') or row.get('contractId') or '').strip()
    if not contract_id.startswith('CON.'):
        return None
    name = str(row.get('name') or '').strip()
    symbol_id = str(row.get('symbolId') or '').strip().upper()
    broker = broker_symbol_from_contract_id(contract_id) or ''
    root = (
        instrument_hint
        or spec_symbol_from_topstep_name(name)
        or get_base_symbol(contract_id)
        or get_base_symbol(name)
    )
    if not root:
        return None
    month, year, expiry = parse_expiry_from_contract_id(contract_id)
    return ResolvedContract(
        contract_id=contract_id,
        instrument=root.upper(),
        symbol=name or contract_id,
        symbol_id=symbol_id,
        broker_symbol=broker.upper(),
        expiry_month=month,
        expiry_year=year,
        expiry_date=expiry,
        raw=dict(row),
    )


def _matches_instrument(row: dict[str, Any], instrument: str) -> bool:
    resolved = _row_to_resolved(row, instrument_hint=None)
    if resolved is None:
        return False
    return resolved.instrument.upper() == instrument.upper()


def _broker_and_symbol_id_for_instrument(instrument: str) -> tuple[str, str]:
    """Déduit broker_symbol / symbolId depuis le catalogue embarqué."""
    instrument = instrument.upper()
    for row in TOPSTEP_LIVE_CONTRACTS:
        resolved = _row_to_resolved(row)
        if resolved and resolved.instrument == instrument:
            return resolved.broker_symbol, resolved.symbol_id
    # Heuristique : broker = instrument, symbolId = F.US.{instrument}
    return instrument, f'F.US.{instrument}'


def generate_contract_ids(
    instrument: str,
    start: date,
    end: date,
) -> list[str]:
    """Génère des contract_id potentiels selon le cycle de l'instrument."""
    broker, _ = _broker_and_symbol_id_for_instrument(instrument)
    months = expiry_cycle_months(instrument)
    ids: list[str] = []
    # Couvrir un peu avant/après pour les rolls
    y, m = start.year, start.month
    end_y, end_m = end.year, end.month
    # Avancer mois par mois
    while (y < end_y) or (y == end_y and m <= end_m + 3):
        if m in months:
            letter = _MONTH_TO_LETTER[m]
            yy = y % 100
            ids.append(f'CON.F.US.{broker}.{letter}{yy:02d}')
        m += 1
        if m > 12:
            m = 1
            y += 1
        if y > end_y + 2:
            break
    return ids


def list_contracts_for_instrument(
    instrument: str,
    *,
    client: TopStepXApiClient | None = None,
    auth_token: str | None = None,
    start: date | None = None,
    end: date | None = None,
) -> list[ResolvedContract]:
    """
    Liste les échéances pour un instrument.
    Combine Contract/search + catalogue + IDs générés si période fournie.
    """
    instrument = instrument.upper().strip()
    rows: list[dict[str, Any]] = []

    if client is not None and auth_token:
        for search_text in (instrument,):
            for live in (True, False):
                try:
                    batch = client.search_contracts(
                        auth_token, search_text=search_text, live=live,
                    )
                    rows.extend(batch or [])
                    if batch:
                        break
                except TopStepXApiError as exc:
                    logger.warning(
                        'Contract/search instrument=%s live=%s: %s',
                        instrument, live, exc,
                    )
        try:
            available = client.list_available_contracts(auth_token, live=True)
            rows.extend(available or [])
        except TopStepXApiError:
            pass

    rows.extend(TOPSTEP_LIVE_CONTRACTS)

    by_id: dict[str, ResolvedContract] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        if not _matches_instrument(row, instrument):
            # Aussi accepter si hint force
            resolved = _row_to_resolved(row, instrument_hint=instrument)
            if resolved is None or resolved.instrument != instrument:
                # Vérifier match via base symbol
                if not _matches_instrument(row, instrument):
                    continue
            resolved = _row_to_resolved(row) or resolved
        else:
            resolved = _row_to_resolved(row)
        if resolved is None or resolved.instrument != instrument:
            continue
        by_id[resolved.contract_id] = resolved

    if start and end:
        for cid in generate_contract_ids(instrument, start, end):
            if cid in by_id:
                continue
            month, year, expiry = parse_expiry_from_contract_id(cid)
            broker, symbol_id = _broker_and_symbol_id_for_instrument(instrument)
            by_id[cid] = ResolvedContract(
                contract_id=cid,
                instrument=instrument,
                symbol='',
                symbol_id=symbol_id,
                broker_symbol=broker,
                expiry_month=month,
                expiry_year=year,
                expiry_date=expiry,
                raw={},
            )

    # Plus récent → plus ancien (échéance décroissante).
    result = sorted(
        by_id.values(),
        key=lambda c: (c.expiry_date or date.min, c.contract_id),
        reverse=True,
    )
    return result


def upsert_futures_contract(resolved: ResolvedContract, source: str = 'topstepx'):
    """Persiste / met à jour FuturesContract."""
    from market_data.models import FuturesContract

    obj, _created = FuturesContract.objects.update_or_create(
        contract_id=resolved.contract_id,
        defaults={
            'instrument': resolved.instrument,
            'symbol': resolved.symbol,
            'symbol_id': resolved.symbol_id,
            'broker_symbol': resolved.broker_symbol,
            'expiry_month': resolved.expiry_month,
            'expiry_year': resolved.expiry_year,
            'expiry_date': resolved.expiry_date,
            'source': source,
            'raw': resolved.raw or {},
        },
    )
    return obj
