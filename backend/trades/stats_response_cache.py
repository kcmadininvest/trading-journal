"""Cache Redis des réponses stats/dashboard (cache-aside)."""
from __future__ import annotations

import hashlib
import json
from typing import Any, Dict, Mapping, Optional

from django.core.cache import cache

CACHE_TTL_SECONDS = 300
CACHE_VERSION = 'v2'


def _canonical_params(params: Mapping[str, Any]) -> str:
    payload = json.dumps(params, sort_keys=True, default=str, separators=(',', ':'))
    return hashlib.md5(payload.encode()).hexdigest()[:16]


def build_stats_cache_key(user_id: int, endpoint: str, params: Mapping[str, Any]) -> str:
    digest = _canonical_params(params)
    return f'stats:{CACHE_VERSION}:{endpoint}:{user_id}:{digest}'


def get_cached_stats_response(
    user_id: int,
    endpoint: str,
    params: Mapping[str, Any],
) -> Optional[Dict[str, Any]]:
    key = build_stats_cache_key(user_id, endpoint, params)
    result = cache.get(key)
    return result if isinstance(result, dict) else None


def set_cached_stats_response(
    user_id: int,
    endpoint: str,
    params: Mapping[str, Any],
    payload: Dict[str, Any],
) -> None:
    key = build_stats_cache_key(user_id, endpoint, params)
    cache.set(key, payload, CACHE_TTL_SECONDS)


def invalidate_user_stats_cache(user_id: int) -> None:
    """Invalide toutes les entrées stats d'un utilisateur."""
    pattern = f'stats:{CACHE_VERSION}:*:{user_id}:*'
    try:
        cache.delete_pattern(pattern)
    except AttributeError:
        # LocMemCache (dev sans Redis) : pas de delete_pattern
        pass


def extract_dashboard_cache_params(request) -> Dict[str, Any]:
    return {
        'trading_account': request.GET.get('trading_account') or '',
        'start_date': request.GET.get('start_date') or '',
        'end_date': request.GET.get('end_date') or '',
        'position_strategy': request.GET.get('position_strategy') or '',
        'pnl_display': request.GET.get('pnl_display') or 'net',
    }


def extract_viewset_cache_params(request) -> Dict[str, Any]:
    return {
        'trading_account': request.query_params.get('trading_account') or '',
        'start_date': request.query_params.get('start_date') or '',
        'end_date': request.query_params.get('end_date') or '',
        'year': request.query_params.get('year') or '',
        'month': request.query_params.get('month') or '',
        'position_strategy': request.query_params.get('position_strategy') or '',
        'pnl_display': request.query_params.get('pnl_display') or 'net',
        'convert_to': request.query_params.get('convert_to') or '',
    }
