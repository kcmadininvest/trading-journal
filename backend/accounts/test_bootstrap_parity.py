"""Parité bootstrap : union preferences + app-settings + compte défaut."""
from __future__ import annotations

from decimal import Decimal

from rest_framework.test import APITestCase

from accounts.models import AppSettings, User, UserPreferences
from trades.models import TradingAccount


class BootstrapParityTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='bootstrap@example.com',
            username='bootstrap_user',
            password='testpass123',
        )
        UserPreferences.objects.get_or_create(user=self.user)
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='Default',
            initial_capital=Decimal('10000'),
            status='active',
            is_default=True,
        )
        AppSettings.get_solo()
        self.client.force_authenticate(user=self.user)

    def _accounts_list(self) -> list:
        response = self.client.get('/api/trades/trading-accounts/')
        data = response.json()
        if isinstance(data, dict) and 'results' in data:
            return data['results']
        return data

    def test_bootstrap_matches_individual_endpoints(self) -> None:
        bootstrap = self.client.get('/api/accounts/bootstrap/').json()
        prefs = self.client.get('/api/accounts/preferences/').json()
        settings = self.client.get('/api/accounts/app-settings/').json()
        accounts = self._accounts_list()

        prefs_payload = prefs.get('preferences') or prefs
        settings_payload = settings.get('app_settings') or settings
        default_from_list = next(
            (a for a in accounts if a.get('is_default')),
            accounts[0] if accounts else None,
        )

        self.assertEqual(bootstrap['preferences'], prefs_payload)
        self.assertEqual(bootstrap['app_settings'], settings_payload)
        self.assertEqual(bootstrap['default_account']['id'], default_from_list['id'])
        self.assertTrue(bootstrap['has_accounts'])
        self.assertNotIn('_errors', bootstrap)

    def test_bootstrap_has_accounts_false_without_account(self) -> None:
        user = User.objects.create_user(
            email='no-account@example.com',
            username='no_account',
            password='testpass123',
        )
        UserPreferences.objects.get_or_create(user=user)
        self.client.force_authenticate(user=user)

        bootstrap = self.client.get('/api/accounts/bootstrap/').json()
        self.assertFalse(bootstrap['has_accounts'])
        self.assertIsNone(bootstrap['default_account'])
