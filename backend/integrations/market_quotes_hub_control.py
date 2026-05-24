"""Signaux Redis pour activer/désactiver les hubs TopStep par utilisateur."""
from __future__ import annotations

import json
import logging

from django.conf import settings

logger = logging.getLogger(__name__)

CONTROL_CHANNEL = 'market_quotes:control'


def _redis_client():
    import redis

    url = getattr(
        settings,
        'MARKET_QUOTES_CONTROL_REDIS_URL',
        'redis://127.0.0.1:6379/0',
    )
    return redis.Redis.from_url(url, decode_responses=True)


def _publish(action: str, user_id: int, *, increment_ref: bool = True) -> None:
    try:
        client = _redis_client()
        client.publish(
            CONTROL_CHANNEL,
            json.dumps({'action': action, 'user_id': user_id, 'increment_ref': increment_ref}),
        )
    except Exception:
        logger.exception('market_quotes control publish failed user_id=%s action=%s', user_id, action)


def signal_user_active(user_id: int) -> None:
    """Connexion WebSocket : compte comme session active (ref_count)."""
    _publish('activate', user_id, increment_ref=True)


def signal_user_inactive(user_id: int) -> None:
    _publish('deactivate', user_id)


def ensure_market_quotes_hub(user_id: int) -> None:
    """Poll HTTP / ouverture dashboard : démarre le hub sans incrémenter ref_count."""
    _publish('ensure', user_id, increment_ref=False)
