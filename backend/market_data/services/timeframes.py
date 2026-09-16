"""Catalogue des timeframes historiques TopstepX / ProjectX."""
from __future__ import annotations

from dataclasses import dataclass


UNIT_SECOND = 1
UNIT_MINUTE = 2
UNIT_HOUR = 3
UNIT_DAY = 4


@dataclass(frozen=True)
class TimeframeSpec:
    code: str
    unit: int
    unit_number: int
    bar_seconds: int


_SPECS: dict[str, TimeframeSpec] = {
    '1m': TimeframeSpec('1m', UNIT_MINUTE, 1, 60),
    '2m': TimeframeSpec('2m', UNIT_MINUTE, 2, 120),
    '5m': TimeframeSpec('5m', UNIT_MINUTE, 5, 300),
    '15m': TimeframeSpec('15m', UNIT_MINUTE, 15, 900),
    '30m': TimeframeSpec('30m', UNIT_MINUTE, 30, 1800),
    '1h': TimeframeSpec('1h', UNIT_HOUR, 1, 3600),
    '4h': TimeframeSpec('4h', UNIT_HOUR, 4, 14400),
    '1d': TimeframeSpec('1d', UNIT_DAY, 1, 86400),
}

ALLOWED_TIMEFRAMES: tuple[str, ...] = tuple(_SPECS.keys())


class UnknownTimeframe(ValueError):
    """Timeframe non supporté."""


def parse_timeframe(code: str) -> TimeframeSpec:
    """
    Résout un code timeframe (ex. ``5m``, ``1h``, ``1d``) vers unit / unitNumber / bar_seconds.
    """
    key = (code or '').strip().lower()
    # Alias historiques éventuels
    if key in ('1min', 'm1'):
        key = '1m'
    elif key in ('daily', 'd1', '1day'):
        key = '1d'
    spec = _SPECS.get(key)
    if spec is None:
        raise UnknownTimeframe(
            f'Timeframe non supporté: {code!r}. '
            f'Autorisés: {", ".join(ALLOWED_TIMEFRAMES)}'
        )
    return spec
