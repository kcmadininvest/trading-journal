"""Cache Redis et en-têtes HTTP pour les endpoints market-holidays."""
from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Mapping, Optional

from django.core.cache import cache
from rest_framework.response import Response

CACHE_VERSION = 'v1'
CACHE_TTL_SECONDS = 3600
MARKET_HOLIDAYS_HTTP_MAX_AGE = 300


def _utc_date_key() -> str:
    return date.today().isoformat()


def _normalize_markets(markets: List[str]) -> str:
    return ','.join(sorted(markets))


def build_market_holidays_cache_key(endpoint: str, params: Mapping[str, Any]) -> str:
    markets = params.get('markets') or ''
    count = params.get('count')
    utc_date = params.get('utc_date') or _utc_date_key()
    if count is not None:
        return f'market_holidays:{CACHE_VERSION}:{endpoint}:{markets}:{count}:{utc_date}'
    return f'market_holidays:{CACHE_VERSION}:{endpoint}:{markets}:{utc_date}'


def get_cached_market_holidays_response(
    endpoint: str,
    params: Mapping[str, Any],
) -> Optional[Dict[str, Any]]:
    key = build_market_holidays_cache_key(endpoint, params)
    result = cache.get(key)
    return result if isinstance(result, dict) else None


def set_cached_market_holidays_response(
    endpoint: str,
    params: Mapping[str, Any],
    payload: Dict[str, Any],
) -> None:
    key = build_market_holidays_cache_key(endpoint, params)
    cache.set(key, payload, CACHE_TTL_SECONDS)


def extract_today_cache_params(markets: List[str]) -> Dict[str, Any]:
    return {
        'markets': _normalize_markets(markets),
        'utc_date': _utc_date_key(),
    }


def extract_bundle_cache_params(markets: List[str], count: int) -> Dict[str, Any]:
    return {
        'markets': _normalize_markets(markets),
        'count': count,
        'utc_date': _utc_date_key(),
    }


def extract_upcoming_cache_params(markets: List[str], count: int) -> Dict[str, Any]:
    return extract_bundle_cache_params(markets, count)


def market_holidays_json_response(payload: Dict[str, Any]) -> Response:
    response = Response(payload)
    response['Cache-Control'] = f'public, max-age={MARKET_HOLIDAYS_HTTP_MAX_AGE}'
    return response
