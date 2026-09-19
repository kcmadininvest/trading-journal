"""Dates de séance pour lesquelles des bougies sont stockées (Market Replay)."""
from __future__ import annotations

from datetime import date
from typing import Any

from market_data.models import HistoricalBar
from market_data.services.timeframes import UnknownTimeframe, parse_timeframe


def list_available_sessions(
    instrument: str,
    *,
    timeframe: str | None = '1m',
    contract: str | None = 'front',
) -> dict[str, Any]:
    """
    Liste distincte des ``session_date`` ayant au moins une bougie.

    - ``timeframe`` : filtre optionnel (défaut ``1m``). Chaîne vide = tous les TF.
    - ``contract`` : id réel, ou ``front`` / vide = tous les contrats de l'instrument.
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
    sessions = [d.isoformat() for d in dates if d is not None]
    return {
        'sessions': sessions,
        'earliest': sessions[0] if sessions else None,
        'latest': sessions[-1] if sessions else None,
    }
