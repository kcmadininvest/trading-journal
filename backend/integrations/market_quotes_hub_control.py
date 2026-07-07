"""Signaux Redis pour activer/désactiver les hubs TopStep par utilisateur."""
from __future__ import annotations

import json
import logging
import threading

from django.conf import settings

logger = logging.getLogger(__name__)

CONTROL_CHANNEL = 'market_quotes:control'

_inactive_timers: dict[int, threading.Timer] = {}
_inactive_lock = threading.Lock()


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


def _cancel_inactive_timer(user_id: int) -> None:
    with _inactive_lock:
        timer = _inactive_timers.pop(user_id, None)
    if timer is not None:
        timer.cancel()


def signal_user_active(user_id: int) -> None:
    """Connexion WebSocket : compte comme session active (ref_count)."""
    _cancel_inactive_timer(user_id)
    _publish('activate', user_id, increment_ref=True)


def signal_user_inactive(user_id: int) -> None:
    """Déconnexion WebSocket : debounce avant deactivate (reconnexions rapides)."""
    debounce_seconds = int(getattr(settings, 'MARKET_QUOTES_WS_INACTIVE_DEBOUNCE_SECONDS', 5))
    if debounce_seconds <= 0:
        _publish('deactivate', user_id)
        return

    def _deferred_deactivate() -> None:
        with _inactive_lock:
            _inactive_timers.pop(user_id, None)
        logger.debug('signal_user_inactive publié après debounce user_id=%s', user_id)
        _publish('deactivate', user_id)

    with _inactive_lock:
        existing = _inactive_timers.pop(user_id, None)
        if existing is not None:
            existing.cancel()
        timer = threading.Timer(debounce_seconds, _deferred_deactivate)
        timer.daemon = True
        _inactive_timers[user_id] = timer
        timer.start()


def ensure_market_quotes_hub(user_id: int) -> None:
    """Poll HTTP / ouverture dashboard : démarre le hub sans incrémenter ref_count."""
    _publish('ensure', user_id, increment_ref=False)
