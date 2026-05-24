"""Tests diffusion WebSocket snapshots."""
import time
from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings

from integrations.market_quotes_broadcast import schedule_snapshot_broadcast
from integrations.market_quotes_service import build_empty_snapshot


@override_settings(
    MARKET_QUOTES_WS_DEBOUNCE_MS=50,
    CHANNEL_LAYERS={'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'}},
)
class MarketQuotesBroadcastTests(TestCase):
    @patch('integrations.market_quotes_broadcast.broadcast_snapshot_now')
    def test_debounce_coalesces_calls(self, mock_broadcast: MagicMock) -> None:
        snapshot = build_empty_snapshot(connected=True)
        schedule_snapshot_broadcast(42, snapshot)
        schedule_snapshot_broadcast(42, snapshot)
        schedule_snapshot_broadcast(42, snapshot)
        time.sleep(0.12)
        self.assertEqual(mock_broadcast.call_count, 1)
        mock_broadcast.assert_called_with(42, snapshot)
