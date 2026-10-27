"""Cache Redis court pour la vérification blacklist JWT (évite requête DB par appel)."""
from __future__ import annotations

import logging
from typing import Optional

from django.core.cache import cache
from django.utils import timezone

CACHE_TTL_SECONDS = 60
_CACHE_PREFIX = 'jwt_blacklist:jti:'

logger = logging.getLogger(__name__)


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


def blacklist_user_refresh_tokens(user, *, exclude_jti: Optional[str] = None) -> int:
    """
    Blackliste les refresh tokens outstanding non expirés d'un utilisateur.
    Si exclude_jti est fourni, ce refresh (session courante) est préservé.
    Retourne le nombre de tokens nouvellement blacklistés.
    """
    from rest_framework_simplejwt.token_blacklist.models import (
        BlacklistedToken,
        OutstandingToken,
    )

    now = timezone.now()
    outstanding = OutstandingToken.objects.filter(
        user=user,
        expires_at__gt=now,
    )
    count = 0
    exclude = str(exclude_jti) if exclude_jti else None
    for token in outstanding:
        if exclude and str(token.jti) == exclude:
            continue
        if BlacklistedToken.objects.filter(token=token).exists():
            continue
        BlacklistedToken.objects.get_or_create(token=token)
        mark_jti_blacklisted(str(token.jti))
        count += 1
    return count


def safe_blacklist_user_refresh_tokens(user, *, exclude_jti: Optional[str] = None) -> int:
    """Best-effort : logue les erreurs, ne propage pas."""
    try:
        return blacklist_user_refresh_tokens(user, exclude_jti=exclude_jti)
    except Exception as e:
        logger.error(
            'Échec blacklist refresh pour user_id=%s: %s',
            getattr(user, 'pk', None),
            e,
            exc_info=True,
        )
        return 0
