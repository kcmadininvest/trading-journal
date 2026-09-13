"""Normalisation des barres API → structures prêtes pour insertion."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any

from django.utils.dateparse import parse_datetime

from market_data.services.sessions import compute_session_flags

KNOWN_BAR_KEYS = frozenset({'t', 'timestamp', 'o', 'h', 'l', 'c', 'v', 'open', 'high', 'low', 'close', 'volume'})


@dataclass
class NormalizedBar:
    timestamp_utc: datetime
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: int
    ny_date: Any
    ny_time: Any
    session_date: Any
    is_rth: bool
    is_eth: bool
    is_us_session: bool
    profile_known: bool
    extra_raw: dict[str, Any] = field(default_factory=dict)


def _parse_ts(raw: Any) -> datetime | None:
    if raw is None:
        return None
    if isinstance(raw, datetime):
        dt = raw
    else:
        dt = parse_datetime(str(raw))
        if dt is None:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).replace(microsecond=0)


def _to_decimal(raw: Any) -> Decimal | None:
    if raw is None:
        return None
    try:
        return Decimal(str(raw))
    except (InvalidOperation, ValueError, TypeError):
        return None


def _to_volume(raw: Any) -> int | None:
    if raw is None:
        return 0
    try:
        return int(float(raw))
    except (TypeError, ValueError):
        return None


def normalize_bar_row(
    row: dict[str, Any],
    *,
    instrument: str,
) -> NormalizedBar | None:
    """
    Normalise une ligne API (clés t/o/h/l/c/v ou timestamp/open/…).
    Les clés inconnues sont conservées dans extra_raw.
    """
    ts = _parse_ts(row.get('t') or row.get('timestamp'))
    if ts is None:
        return None

    o = _to_decimal(row.get('o') if 'o' in row else row.get('open'))
    h = _to_decimal(row.get('h') if 'h' in row else row.get('high'))
    l = _to_decimal(row.get('l') if 'l' in row else row.get('low'))
    c = _to_decimal(row.get('c') if 'c' in row else row.get('close'))
    v = _to_volume(row.get('v') if 'v' in row else row.get('volume'))

    if o is None or h is None or l is None or c is None or v is None:
        return None

    extra = {k: val for k, val in row.items() if k not in KNOWN_BAR_KEYS}
    flags = compute_session_flags(ts, instrument)

    return NormalizedBar(
        timestamp_utc=ts,
        open=o,
        high=h,
        low=l,
        close=c,
        volume=v,
        ny_date=flags.ny_date,
        ny_time=flags.ny_time,
        session_date=flags.session_date,
        is_rth=flags.is_rth,
        is_eth=flags.is_eth,
        is_us_session=flags.is_us_session,
        profile_known=flags.profile_known,
        extra_raw=extra,
    )


def normalize_bars(
    rows: list[dict[str, Any]],
    *,
    instrument: str,
) -> tuple[list[NormalizedBar], list[dict[str, Any]]]:
    """
    Normalise + déduplique en mémoire (garde la dernière occurrence d'un timestamp).
    Retourne (bars_triées, raw_rows_échouées).
    """
    by_ts: dict[datetime, NormalizedBar] = {}
    failed: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            failed.append({'row': row, 'reason': 'not_dict'})
            continue
        bar = normalize_bar_row(row, instrument=instrument)
        if bar is None:
            failed.append(row)
            continue
        by_ts[bar.timestamp_utc] = bar
    bars = sorted(by_ts.values(), key=lambda b: b.timestamp_utc)
    return bars, failed
