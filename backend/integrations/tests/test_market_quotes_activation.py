"""Tests bootstrap cours marché."""
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from integrations.market_quotes_activation import bootstrap_market_quotes_for_user
from integrations.market_quotes_service import build_empty_snapshot, load_snapshot, save_snapshot


@override_settings(
    CACHES={
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        }
    },
)
class BootstrapMarketQuotesTests(TestCase):
    @patch('integrations.market_quotes_activation.user_has_quotes_credentials', return_value=True)
    @patch('integrations.market_quotes_activation.ensure_market_quotes_hub')
    def test_bootstrap_keeps_prices_after_disconnect_message(
        self,
        mock_ensure,
        _mock_creds,
    ) -> None:
        user = get_user_model().objects.create_user(
            username='quotes_user',
            email='quotes@example.com',
            password='testpass123',
        )
        save_snapshot(
            {
                **build_empty_snapshot(connected=False, message='market_quotes_disconnected'),
                'quotes': [
                    {
                        'key': 'nasdaq',
                        'label': 'Nasdaq',
                        'contract_id': 'CON.F.US.ENQ.M26',
                        'last_price': 30000.0,
                        'last_price_display': '30000',
                        'change': 1.0,
                        'change_percent': 0.01,
                        'timestamp': '2026-05-25T06:00:00+00:00',
                    },
                ],
            },
            user.id,
        )

        bootstrap_market_quotes_for_user(user)

        snap = load_snapshot(user.id)
        nasdaq = next(q for q in snap['quotes'] if q['key'] == 'nasdaq')
        self.assertEqual(float(nasdaq['last_price_display']), 30000.0)
        self.assertEqual(snap['message'], 'market_quotes_disconnected')
        mock_ensure.assert_called_once_with(user.id)

    @patch('integrations.market_quotes_service.user_has_quotes_credentials', return_value=True)
    @patch('integrations.market_quotes_activation.user_has_quotes_credentials', return_value=True)
    @patch('integrations.market_quotes_activation.ensure_market_quotes_hub')
    def test_bootstrap_starts_hub_when_no_snapshot(self, mock_ensure, _mock_creds, _mock_creds_service) -> None:
        user = get_user_model().objects.create_user(
            username='quotes_new',
            email='quotes_new@example.com',
            password='testpass123',
        )

        bootstrap_market_quotes_for_user(user)

        snap = load_snapshot(user.id)
        self.assertEqual(snap['message'], 'connecting')
        mock_ensure.assert_called_once_with(user.id)