"""Taux de change pour normalisation multi-devises (source Frankfurter, sans clé API)."""
from __future__ import annotations

import logging
from datetime import date
from typing import Any, Optional

import requests
from django.core.cache import cache

logger = logging.getLogger(__name__)

FRANKFURTER_LATEST_URL = 'https://api.frankfurter.app/latest'
CACHE_TTL_SECONDS = 3600
CACHE_KEY_PREFIX = 'fx_rates:latest'


def _cache_key(base: str, symbols: tuple[str, ...]) -> str:
    sym = ','.join(sorted(symbols))
    return f'{CACHE_KEY_PREFIX}:{base}:{sym}'


def fetch_latest_rates(base_currency: str, symbols: list[str]) -> Optional[dict[str, float]]:
    """
    Retourne un dict {CODE: taux} où 1 unité de CODE = rate unités de base_currency.
    Ex. base USD, EUR rate 0.92 => 1 EUR = 0.92 USD (Frankfurter retourne 1 base = x quote).
    """
    base = (base_currency or 'USD').strip().upper()
    wanted = sorted({s.strip().upper() for s in symbols if s and s.upper() != base})
    if not wanted:
        return {}

    cache_key = _cache_key(base, tuple(wanted))
    cached = cache.get(cache_key)
    if isinstance(cached, dict):
        return cached

    try:
        response = requests.get(
            FRANKFURTER_LATEST_URL,
            params={'from': base, 'to': ','.join(wanted)},
            timeout=8,
        )
        response.raise_for_status()
        payload: dict[str, Any] = response.json()
        rates_raw = payload.get('rates') or {}
        rates: dict[str, float] = {}
        for code in wanted:
            val = rates_raw.get(code)
            if val is None:
                logger.warning('fx_rates missing pair %s/%s', base, code)
                return None
            rate = float(val)
            if rate <= 0:
                return None
            rates[code] = rate
        cache.set(cache_key, rates, CACHE_TTL_SECONDS)
        return rates
    except Exception:
        logger.exception('fx_rates fetch failed base=%s symbols=%s', base, wanted)
        return None


def convert_amount_to_base(
    amount: float,
    from_currency: str,
    base_currency: str,
    rates: dict[str, float],
) -> Optional[float]:
    """Convertit un montant de from_currency vers base_currency."""
    base = base_currency.strip().upper()
    frm = from_currency.strip().upper()
    if frm == base:
        return amount
    rate = rates.get(frm)
    if rate is None or rate <= 0:
        return None
    return amount / rate


def rates_available_for_symbols(
    base_currency: str,
    symbols: list[str],
) -> bool:
    rates = fetch_latest_rates(base_currency, symbols)
    if rates is None:
        return False
    wanted = {s.strip().upper() for s in symbols if s and s.upper() != base_currency.strip().upper()}
    return wanted.issubset(set(rates.keys()))
