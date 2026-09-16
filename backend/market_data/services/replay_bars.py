"""Lecture multi-timeframe des bougies pour Market Replay (JSON)."""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from django.utils.dateparse import parse_datetime

from market_data.services.bar_query import get_bars
from market_data.services.timeframes import UnknownTimeframe, parse_timeframe

# Garde-fous MVP : une journée dense multi-TF reste raisonnable.
MAX_BARS_PER_SERIES = 50_000
MAX_TOTAL_BARS = 150_000
MAX_RANGE_SECONDS = 7 * 24 * 3600  # 7 jours


class ReplayBarsError(ValueError):
    """Erreur métier / validation pour l'endpoint bars replay."""


def _parse_bound(value: str, *, end: bool = False) -> datetime:
    raw = (value or '').strip()
    normalized = raw.replace('Z', '+00:00') if raw.endswith('Z') else raw
    dt = parse_datetime(normalized)
    if dt is None:
        try:
            d = date.fromisoformat(raw[:10])
        except ValueError as exc:
            raise ReplayBarsError(f'Date invalide: {value!r}') from exc
        if end:
            dt = datetime(d.year, d.month, d.day, 23, 59, 59, tzinfo=timezone.utc)
        else:
            dt = datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _ts_iso(ts) -> str:
    if hasattr(ts, 'isoformat'):
        return ts.isoformat().replace('+00:00', 'Z')
    return str(ts)


def _row_to_candle(row: dict[str, Any]) -> dict[str, Any]:
    return {
        't': _ts_iso(row['timestamp_utc']),
        'o': float(row['open']),
        'h': float(row['high']),
        'l': float(row['low']),
        'c': float(row['close']),
        'v': int(row['volume'] or 0),
    }


def _parse_timeframes_param(raw: str) -> list[str]:
    parts = [p.strip() for p in (raw or '').split(',') if p.strip()]
    if not parts:
        raise ReplayBarsError('Paramètre timeframes requis (ex. 1m,5m,15m).')
    codes: list[str] = []
    seen: set[str] = set()
    for part in parts:
        try:
            code = parse_timeframe(part).code
        except UnknownTimeframe as exc:
            raise ReplayBarsError(str(exc)) from exc
        if code not in seen:
            seen.add(code)
            codes.append(code)
    return codes


def fetch_replay_bars(
    *,
    instrument: str,
    timeframes_raw: str,
    start: str,
    end: str,
    contract: str | None = 'front',
) -> dict[str, Any]:
    """
    Charge les séries natives demandées via get_bars.

    Retourne :
    {
      "instrument": "NQ",
      "contract_mode": "front",
      "start": "...",
      "end": "...",
      "series": { "1m": [{t,o,h,l,c,v}, ...], ... }
    }
    """
    instrument = (instrument or '').upper().strip()
    if not instrument:
        raise ReplayBarsError('Paramètre instrument requis.')
    start = (start or '').strip()
    end = (end or '').strip()
    if not start or not end:
        raise ReplayBarsError('Paramètres start et end requis.')

    timeframes = _parse_timeframes_param(timeframes_raw)

    start_dt = _parse_bound(start, end=False)
    end_dt = _parse_bound(end, end=True)
    if start_dt >= end_dt:
        raise ReplayBarsError('start doit être < end')
    span = (end_dt - start_dt).total_seconds()
    if span > MAX_RANGE_SECONDS:
        raise ReplayBarsError(
            f'Période trop longue ({int(span)}s). Maximum {MAX_RANGE_SECONDS}s.',
        )

    contract_key = (contract or 'front').strip() or 'front'
    contract_mode = contract_key if contract_key.lower() != 'front' else 'front'

    series: dict[str, list[dict[str, Any]]] = {}
    total = 0
    for tf in timeframes:
        try:
            df = get_bars(
                instrument,
                timeframe=tf,
                start=start_dt,
                end=end_dt,
                contract=contract_key,
            )
        except ValueError as exc:
            raise ReplayBarsError(str(exc)) from exc

        n = len(df)
        if n > MAX_BARS_PER_SERIES:
            raise ReplayBarsError(
                f'Trop de bougies pour {tf} ({n}). '
                f'Maximum {MAX_BARS_PER_SERIES} — réduisez la période.',
            )
        total += n
        if total > MAX_TOTAL_BARS:
            raise ReplayBarsError(
                f'Trop de bougies au total ({total}). '
                f'Maximum {MAX_TOTAL_BARS} — réduisez timeframes ou période.',
            )

        if df.empty:
            series[tf] = []
        else:
            series[tf] = [
                _row_to_candle(row)
                for row in df.to_dict(orient='records')
            ]

    return {
        'instrument': instrument,
        'contract_mode': contract_mode,
        'start': start_dt.isoformat().replace('+00:00', 'Z'),
        'end': end_dt.isoformat().replace('+00:00', 'Z'),
        'series': series,
    }
