"""Tests endpoint market-quotes."""
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import User
from integrations.market_quotes_service import build_empty_snapshot, save_snapshot


@override_settings(
    CACHES={
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        }
    }
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
        self.client = APIClient()
        save_snapshot(build_empty_snapshot(connected=True))

    def test_requires_authentication(self) -> None:
        response = self.client.get('/api/trades/market-quotes/')
        self.assertEqual(response.status_code, 401)

    def test_returns_snapshot(self) -> None:
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/trades/market-quotes/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('quotes', response.data)
        self.assertIn('connected', response.data)
        self.assertEqual(len(response.data['quotes']), 5)
