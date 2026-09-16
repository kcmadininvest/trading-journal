"""Timeframes réellement disponibles pour un instrument (couverture / bars)."""
from __future__ import annotations

from datetime import date
from typing import Any

from django.db.models import Max

from market_data.models import BarCoverage, HistoricalBar
from market_data.services.sessions import get_session_profile, session_date_for
from market_data.services.timeframes import UnknownTimeframe, parse_timeframe


def _label_for_spec(code: str, bar_seconds: int) -> str:
    """Libellé technique court dérivé de la durée (pas de liste i18n hardcodée)."""
    if bar_seconds % 86400 == 0 and bar_seconds >= 86400:
        days = bar_seconds // 86400
        return f'{days} day' if days == 1 else f'{days} days'
    if bar_seconds % 3600 == 0 and bar_seconds >= 3600:
        hours = bar_seconds // 3600
        return f'{hours} hour' if hours == 1 else f'{hours} hours'
    if bar_seconds % 60 == 0 and bar_seconds >= 60:
        minutes = bar_seconds // 60
        return f'{minutes} minute' if minutes == 1 else f'{minutes} minutes'
    return f'{bar_seconds} seconds' if bar_seconds != 1 else '1 second'


def list_available_timeframes(instrument: str) -> list[dict[str, Any]]:
    """
    Retourne les timeframes pour lesquels l'instrument a des données stockées.

    Source : union BarCoverage (bars_stored > 0, status != empty) et HistoricalBar.
    Enrichissement via parse_timeframe (duration_seconds). Les codes inconnus
    du catalogue sont ignorés (pas de durée fiable).
    """
    instrument = (instrument or '').upper().strip()
    if not instrument:
        return []

    codes: set[str] = set()

    cov_qs = (
        BarCoverage.objects.filter(instrument=instrument)
        .exclude(status=BarCoverage.Status.EMPTY)
        .filter(bars_stored__gt=0)
        .values_list('timeframe', flat=True)
        .distinct()
    )
    codes.update(cov_qs)

    bar_qs = (
        HistoricalBar.objects.filter(instrument=instrument)
        .values_list('timeframe', flat=True)
        .distinct()
    )
    codes.update(bar_qs)

    result: list[dict[str, Any]] = []
    for raw in codes:
        try:
            spec = parse_timeframe(raw)
        except UnknownTimeframe:
            continue
        result.append({
            'value': spec.code,
            'label': _label_for_spec(spec.code, spec.bar_seconds),
            'duration_seconds': spec.bar_seconds,
        })

    result.sort(key=lambda row: row['duration_seconds'])
    return result


def latest_replay_coverage(instrument: str) -> dict[str, str | None]:
    """
    Dernière bougie stockée et date de séance suggérée pour Market Replay.
    """
    instrument = (instrument or '').upper().strip()
    if not instrument:
        return {'last_bar_at': None, 'latest_session_date': None}

    agg = (
        HistoricalBar.objects.filter(instrument=instrument)
        .aggregate(last=Max('timestamp_utc'))
    )
    last_ts = agg.get('last')
    if last_ts is None:
        return {'last_bar_at': None, 'latest_session_date': None}

    profile = get_session_profile(instrument)
    session_d: date = session_date_for(last_ts, profile)
    return {
        'last_bar_at': last_ts.isoformat().replace('+00:00', 'Z'),
        'latest_session_date': session_d.isoformat(),
    }


def list_instruments_with_stored_bars() -> list[str]:
    """Instruments racines ayant au moins une couverture ou une bougie."""
    from_cov = set(
        BarCoverage.objects.exclude(status=BarCoverage.Status.EMPTY)
        .filter(bars_stored__gt=0)
        .values_list('instrument', flat=True)
        .distinct()
    )
    from_bars = set(
        HistoricalBar.objects.values_list('instrument', flat=True).distinct()
    )
    return sorted(from_cov | from_bars)
