"""Dates de séance pour lesquelles des bougies sont stockées (Market Replay)."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

from django.utils.dateparse import parse_date

from market_data.models import HistoricalBar
from market_data.services.contracts import (
    ResolvedContract,
    list_contracts_for_instrument,
    parse_expiry_from_contract_id,
)
from market_data.services.roll import front_contract_id_on_date
from market_data.services.timeframes import UnknownTimeframe, parse_timeframe


def _contracts_for_front_filter(instrument: str) -> list[ResolvedContract]:
    """Catalogue + contrats déjà présents en base (avec échéance si dérivable)."""
    today = datetime.now(timezone.utc).date()
    contracts = list(
        list_contracts_for_instrument(
            instrument,
            start=today - timedelta(days=400),
            end=today + timedelta(days=400),
        )
    )
    known_ids = {c.contract_id for c in contracts}
    db_cids = (
        HistoricalBar.objects.filter(instrument=instrument)
        .values_list('contract_id', flat=True)
        .distinct()
    )
    for cid in db_cids:
        if cid in known_ids:
            continue
        month, year, expiry = parse_expiry_from_contract_id(cid)
        contracts.append(ResolvedContract(
            contract_id=cid,
            instrument=instrument,
            symbol='',
            symbol_id='',
            broker_symbol='',
            expiry_month=month,
            expiry_year=year,
            expiry_date=expiry,
            raw={},
        ))
        known_ids.add(cid)
    return contracts


def list_available_sessions(
    instrument: str,
    *,
    timeframe: str | None = '1m',
    contract: str | None = 'front',
) -> dict[str, Any]:
    """
    Liste distincte des ``session_date`` ayant au moins une bougie.

    - ``timeframe`` : filtre optionnel (défaut ``1m``). Chaîne vide = tous les TF.
    - ``contract`` : id réel, ou ``front`` = séances du contrat front calendaire
      (aligné sur ``get_bars(..., contract='front')``). Si le roll n'est pas
      résolvable (pas d'échéances), retombe sur tous les contrats.
    """
    instrument = (instrument or '').upper().strip()
    if not instrument:
        return {'sessions': [], 'earliest': None, 'latest': None}

    qs = HistoricalBar.objects.filter(
        instrument=instrument,
        session_date__isnull=False,
    )

    tf_raw = (timeframe or '').strip()
    if tf_raw:
        try:
            spec = parse_timeframe(tf_raw)
        except UnknownTimeframe as exc:
            raise ValueError(str(exc)) from exc
        qs = qs.filter(timeframe=spec.code)

    contract_key = (contract or '').strip()
    if contract_key and contract_key.lower() != 'front':
        qs = qs.filter(contract_id=contract_key)
        dates: list[date] = list(
            qs.values_list('session_date', flat=True).distinct().order_by('session_date')
        )
    else:
        pairs = list(qs.values_list('session_date', 'contract_id').distinct())
        if not pairs:
            dates = []
        else:
            contracts = _contracts_for_front_filter(instrument)
            by_date: dict[date, set[str]] = {}
            for session_d, cid in pairs:
                if session_d is None:
                    continue
                by_date.setdefault(session_d, set()).add(cid)
            dates = []
            for session_d in sorted(by_date):
                front_id = front_contract_id_on_date(instrument, session_d, contracts)
                if front_id is None:
                    dates.append(session_d)
                elif front_id in by_date[session_d]:
                    dates.append(session_d)

    sessions = [d.isoformat() for d in dates if d is not None]
    return {
        'sessions': sessions,
        'earliest': sessions[0] if sessions else None,
        'latest': sessions[-1] if sessions else None,
    }


def list_session_timeframes(
    instrument: str,
    session_date: str | date,
    *,
    contract: str | None = 'front',
) -> list[str]:
    """
    Timeframes stockés pour une séance et un instrument donnés.

    - ``contract`` : id réel, ou ``front`` = contrat front calendaire du jour
      (aligné sur les bars replay). Roll non résolvable → tous les contrats.
    Retourne les codes de timeframe triés par durée croissante.
    """
    instrument = (instrument or '').upper().strip()
    if not instrument:
        return []

    if isinstance(session_date, str):
        parsed = parse_date(session_date)
        if parsed is None:
            raise ValueError(f'Date de séance invalide: {session_date!r}')
        session_date = parsed

    qs = HistoricalBar.objects.filter(
        instrument=instrument,
        session_date=session_date,
    )

    contract_key = (contract or '').strip()
    if contract_key and contract_key.lower() != 'front':
        qs = qs.filter(contract_id=contract_key)
    else:
        contracts = _contracts_for_front_filter(instrument)
        front_id = front_contract_id_on_date(instrument, session_date, contracts)
        if front_id is not None:
            qs = qs.filter(contract_id=front_id)

    codes = list(
        qs.values_list('timeframe', flat=True).distinct()
    )

    parsed: list[tuple[int, str]] = []
    for code in codes:
        try:
            spec = parse_timeframe(code)
            parsed.append((spec.bar_seconds, spec.code))
        except UnknownTimeframe:
            continue
    parsed.sort(key=lambda x: x[0])
    return [code for _, code in parsed]
