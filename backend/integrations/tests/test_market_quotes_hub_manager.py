"""Tests MarketQuotesHubManager — backoff cycle hub."""
import threading
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, override_settings

from integrations.market_quotes_hub_manager import MarketQuotesHubManager


@override_settings(
    MARKET_QUOTES_HUB_CYCLE_BACKOFF_SECONDS=7,
    MARKET_QUOTES_HUB_IDLE_TTL_SECONDS=180,
)
class MarketQuotesHubManagerBackoffTests(SimpleTestCase):
    def setUp(self) -> None:
        self.user = MagicMock()
        self.user.id = 99
        self.manager = MarketQuotesHubManager()
        self.manager._cycle_backoff_seconds = 7

    @patch('integrations.market_quotes_hub_manager.time.sleep')
    @patch.object(MarketQuotesHubManager, '_run_hub_cycle')
    @patch('integrations.market_quotes_hub_manager.user_has_quotes_credentials', return_value=True)
    @patch('integrations.market_quotes_hub_manager.get_user_model')
    def test_backoff_after_hub_cycle_ends(
        self,
        mock_get_user_model,
        _mock_credentials,
        mock_run_cycle,
        mock_sleep,
    ) -> None:
        mock_get_user_model.return_value.objects.get.return_value = self.user

        call_count = {'n': 0}

        def _cycle_side_effect(_user) -> None:
            call_count['n'] += 1
            if call_count['n'] >= 2:
                self.manager._stop.set()

        mock_run_cycle.side_effect = _cycle_side_effect
        self.manager._users[self.user.id] = MagicMock()

        self.manager._run_user_hub(self.user.id)

        backoff_calls = [args[0][0] for args in mock_sleep.call_args_list if args[0]]
        self.assertIn(7, backoff_calls)
        self.assertGreaterEqual(mock_run_cycle.call_count, 2)

    @patch('integrations.market_quotes_hub_manager.TopStepXMarketHubRunner')
    def test_stop_user_hub_passes_reason_to_runner(self, mock_runner_cls) -> None:
        mock_runner = MagicMock()
        state = MagicMock()
        state.runner = mock_runner
        state.shutdown_timer = None
        state.lock = threading.Lock()

        self.manager._users[self.user.id] = state
        self.manager._stop_user_hub(self.user.id, reason='idle_ttl')

        mock_runner.stop.assert_called_once_with(reason='idle_ttl')
        self.assertNotIn(self.user.id, self.manager._users)
