"""Correctifs signalrcore pour le Market Hub TopStepX."""
from __future__ import annotations

import logging
from typing import Callable

logger = logging.getLogger(__name__)

_PATCHED = False
_on_rate_limited: Callable[[], None] | None = None


def set_rate_limited_callback(callback: Callable[[], None] | None) -> None:
    global _on_rate_limited
    _on_rate_limited = callback


def apply_signalrcore_patches() -> None:
    """Idempotent : corrige connection_alive et backoff 429 sur WebsocketTransport."""
    global _PATCHED
    if _PATCHED:
        return
    _PATCHED = True

    from signalrcore.transport.base_transport import BaseTransport, TransportState
    from signalrcore.transport.websockets.websocket_transport import WebsocketTransport

    _orig_ws_init = WebsocketTransport.__init__

    def _patched_ws_init(self, *args, **kwargs):
        _orig_ws_init(self, *args, **kwargs)
        self.connection_alive = False

    WebsocketTransport.__init__ = _patched_ws_init

    _orig_deferred = BaseTransport.deferred_reconnect

    def _patched_deferred_reconnect(self, sleep_time):
        if not hasattr(self, 'connection_alive'):
            self.connection_alive = False
        return _orig_deferred(self, sleep_time)

    BaseTransport.deferred_reconnect = _patched_deferred_reconnect

    _orig_handle = BaseTransport.handle_reconnect

    def _patched_handle_reconnect(self) -> bool:
        if self.is_reconnecting() or self.manually_closing:
            return False

        if self.reconnection_handler is None:
            return False

        if not self._client.is_connection_closed():
            return False

        try:
            self.reconnection_handler.reconnecting = True
            self._set_state(TransportState.reconnecting)
            self._client.dispose()
            self.start(reconnection=True)
        except Exception as exc:
            self.logger.error(exc)
            error_text = str(exc)
            try:
                sleep_time = self.reconnection_handler.next()
            except ValueError:
                self.reconnection_handler.reset()
                sleep_time = 300
            if '429' in error_text:
                sleep_time = max(sleep_time, 120)
                if _on_rate_limited is not None:
                    try:
                        _on_rate_limited()
                    except Exception:
                        logger.exception('Callback rate_limited signalrcore en échec')
            if not hasattr(self, 'connection_alive'):
                self.connection_alive = False
            self.deferred_reconnect(sleep_time)
        return True

    BaseTransport.handle_reconnect = _patched_handle_reconnect
