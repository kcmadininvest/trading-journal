"""Cache Redis court pour la vérification blacklist JWT (évite requête DB par appel)."""
from __future__ import annotations

from django.core.cache import cache

CACHE_TTL_SECONDS = 60
_CACHE_PREFIX = 'jwt_blacklist:jti:'


def _cache_key(jti: str) -> str:
    return f'{_CACHE_PREFIX}{str(jti)}'


def is_jti_blacklisted(jti: str) -> bool:
    """Retourne True si le JTI est blacklisté. Fail-closed sur erreur cache miss → DB."""
    if not jti:
        return False
    key = _cache_key(jti)
    cached = cache.get(key)
    if cached is True:
        return True
    if cached is False:
        return False

    from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken

    jti_str = str(jti)
    blacklisted = BlacklistedToken.objects.filter(token__jti=jti_str).exists()
    cache.set(key, blacklisted, CACHE_TTL_SECONDS)
    return blacklisted


def mark_jti_blacklisted(jti: str) -> None:
    """Invalidation immédiate à chaque blacklist."""
    if jti:
        cache.set(_cache_key(jti), True, CACHE_TTL_SECONDS)


def clear_jti_blacklist_cache(jti: str) -> None:
    if jti:
        cache.delete(_cache_key(jti))
