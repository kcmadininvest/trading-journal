"""Fixtures M1 réalistes pour tests market_data."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal


def make_m1_bars(
    start: datetime,
    count: int,
    *,
    base_price: float = 20000.0,
    volume: int = 100,
    include_extra: bool = False,
) -> list[dict]:
    """Génère des bougies M1 OHLC cohérentes (timestamps UTC)."""
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    bars = []
    price = base_price
    for i in range(count):
        ts = start + timedelta(minutes=i)
        o = price
        c = price + (0.25 if i % 2 == 0 else -0.25)
        h = max(o, c) + 0.5
        l = min(o, c) - 0.5
        row = {
            't': ts.isoformat().replace('+00:00', 'Z'),
            'o': o,
            'h': h,
            'l': l,
            'c': c,
            'v': volume + i,
        }
        if include_extra:
            row['tradeCount'] = 10 + i
            row['openInterest'] = 1000 + i
        bars.append(row)
        price = c
    return bars


def nq_sample_rth_window() -> list[dict]:
    """Fenêtre RTH NY : 2025-03-10 14:00–14:10 UTC ≈ 10:00–10:10 ET (DST)."""
    start = datetime(2025, 3, 10, 14, 0, tzinfo=timezone.utc)
    return make_m1_bars(start, 10, base_price=20100.0, include_extra=True)


def es_sample_window() -> list[dict]:
    start = datetime(2025, 3, 10, 14, 0, tzinfo=timezone.utc)
    return make_m1_bars(start, 5, base_price=5700.0)
