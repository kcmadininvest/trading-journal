"""Tests debounce signal_user_inactive."""
from unittest.mock import patch

from django.test import SimpleTestCase, override_settings

from integrations.market_quotes_hub_control import (
    _inactive_timers,
    signal_user_active,
    signal_user_inactive,
)


class MarketQuotesHubControlDebounceTests(SimpleTestCase):
    def tearDown(self) -> None:
        for timer in list(_inactive_timers.values()):
            timer.cancel()
        _inactive_timers.clear()

    @override_settings(MARKET_QUOTES_WS_INACTIVE_DEBOUNCE_SECONDS=5)
    @patch('integrations.market_quotes_hub_control._publish')
    def test_inactive_schedules_deferred_deactivate(self, mock_publish) -> None:
        signal_user_inactive(42)
        mock_publish.assert_not_called()
        self.assertIn(42, _inactive_timers)

    @override_settings(MARKET_QUOTES_WS_INACTIVE_DEBOUNCE_SECONDS=0)
    @patch('integrations.market_quotes_hub_control._publish')
    def test_inactive_without_debounce_publishes_immediately(self, mock_publish) -> None:
        signal_user_inactive(42)
        mock_publish.assert_called_once_with('deactivate', 42)

    @override_settings(MARKET_QUOTES_WS_INACTIVE_DEBOUNCE_SECONDS=5)
    @patch('integrations.market_quotes_hub_control._publish')
    def test_active_cancels_pending_inactive(self, mock_publish) -> None:
        signal_user_inactive(42)
        self.assertIn(42, _inactive_timers)
        signal_user_active(42)
        mock_publish.assert_called_once_with('activate', 42, increment_ref=True)
        self.assertNotIn(42, _inactive_timers)

    @override_settings(MARKET_QUOTES_WS_INACTIVE_DEBOUNCE_SECONDS=0)
    @patch('integrations.market_quotes_hub_control._publish')
    def test_active_publishes_activate(self, mock_publish) -> None:
        signal_user_active(7)
        mock_publish.assert_called_once_with('activate', 7, increment_ref=True)
