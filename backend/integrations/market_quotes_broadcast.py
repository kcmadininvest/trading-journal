"""Diffusion WebSocket des snapshots cours (debounce par utilisateur)."""
from __future__ import annotations

import logging
import threading
from typing import Any

from django.conf import settings

from integrations.market_quotes_service import channel_group_name

logger = logging.getLogger(__name__)

_timers: dict[int, threading.Timer] = {}
_lock = threading.Lock()


def _debounce_ms() -> int:
    return int(getattr(settings, 'MARKET_QUOTES_WS_DEBOUNCE_MS', 300))


def broadcast_snapshot_now(user_id: int, snapshot: dict[str, Any]) -> None:
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        layer = get_channel_layer()
        if layer is None:
            return
        async_to_sync(layer.group_send)(
            channel_group_name(user_id),
            {
                'type': 'quotes.snapshot',
                'payload': snapshot,
            },
        )
    except Exception:
        logger.exception('group_send market_quotes user_id=%s failed', user_id)


def schedule_snapshot_broadcast(user_id: int, snapshot: dict[str, Any]) -> None:
    delay = _debounce_ms() / 1000.0
    payload = dict(snapshot)

    def _fire() -> None:
        with _lock:
            _timers.pop(user_id, None)
        broadcast_snapshot_now(user_id, payload)

    with _lock:
        existing = _timers.pop(user_id, None)
        if existing is not None:
            existing.cancel()
        timer = threading.Timer(delay, _fire)
        _timers[user_id] = timer
        timer.daemon = True
        timer.start()
