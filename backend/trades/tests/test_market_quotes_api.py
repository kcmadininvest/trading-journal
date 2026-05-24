"""Tests endpoint market-quotes."""
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import User
from integrations.market_quotes_service import build_empty_snapshot, save_snapshot, update_quote_in_snapshot
from integrations.market_quotes_service import normalize_gateway_quote


@override_settings(
    CACHES={
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        }
    },
    CHANNEL_LAYERS={'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'}},
)
class MarketQuotesApiTests(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            username='quotes_user',
            email='quotes@example.com',
            password='testpass123',
            first_name='Q',
            last_name='U',
        )
        self.other = User.objects.create_user(
            username='quotes_other',
            email='quotes_other@example.com',
            password='testpass123',
        )
        self.client = APIClient()
        save_snapshot(build_empty_snapshot(connected=True), self.user.id)
        save_snapshot(build_empty_snapshot(connected=True), self.other.id)

    def test_requires_authentication(self) -> None:
        response = self.client.get('/api/trades/market-quotes/')
        self.assertEqual(response.status_code, 401)

    def test_returns_snapshot_for_current_user_only(self) -> None:
        update_quote_in_snapshot(
            normalize_gateway_quote(
                {'lastPrice': 111, 'change': 1, 'changePercent': 1.0},
                instrument_key='nasdaq',
                contract_id='CON.F.US.ENQ.U25',
                label='Nasdaq',
                tick_size=0.25,
            ),
            self.user.id,
        )
        update_quote_in_snapshot(
            normalize_gateway_quote(
                {'lastPrice': 999, 'change': 9, 'changePercent': 9.0},
                instrument_key='nasdaq',
                contract_id='CON.F.US.ENQ.U25',
                label='Nasdaq',
                tick_size=0.25,
            ),
            self.other.id,
        )
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/trades/market-quotes/')
        self.assertEqual(response.status_code, 200)
        nasdaq = next(q for q in response.data['quotes'] if q['key'] == 'nasdaq')
        self.assertEqual(nasdaq['last_price'], 111)
