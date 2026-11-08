from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User, UserPreferences


class TutorialsPreferencesTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='tuto_prefs',
            email='tuto-prefs@example.invalid',
            password='TestPass!234',
        )
        self.prefs = UserPreferences.objects.get_or_create(user=self.user)[0]
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_defaults(self):
        self.assertEqual(self.prefs.tutorials_progress, {})
        self.assertFalse(self.prefs.tutorials_auto_prompt_dismissed)

    def test_patch_progress_and_dismiss(self):
        payload = {
            'tutorials_progress': {
                'getting-started': {
                    'status': 'in_progress',
                    'stepIndex': 1,
                }
            },
            'tutorials_auto_prompt_dismissed': True,
        }
        response = self.client.put('/api/accounts/preferences/', payload, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        self.prefs.refresh_from_db()
        self.assertTrue(self.prefs.tutorials_auto_prompt_dismissed)
        self.assertEqual(self.prefs.tutorials_progress['getting-started']['status'], 'in_progress')
        self.assertEqual(self.prefs.tutorials_progress['getting-started']['stepIndex'], 1)

    def test_trading_activity_ledger_sort_persisted_per_tab(self):
        payload = {
            'trading_activity_ledger_sort': {
                'debit': {'field': 'total', 'direction': 'asc'},
                'credit': {'field': 'amount', 'direction': 'desc'},
                'tax': {'field': 'label', 'direction': 'asc'},
            },
        }
        response = self.client.put('/api/accounts/preferences/', payload, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        self.prefs.refresh_from_db()
        self.assertEqual(
            self.prefs.trading_activity_ledger_sort['debit'],
            {'field': 'total', 'direction': 'asc'},
        )
        self.assertEqual(
            self.prefs.trading_activity_ledger_sort['credit'],
            {'field': 'amount', 'direction': 'desc'},
        )

    def test_trading_activity_ledger_sort_rejects_invalid_field(self):
        payload = {
            'trading_activity_ledger_sort': {
                'debit': {'field': 'secondary', 'direction': 'asc'},
            },
        }
        response = self.client.put('/api/accounts/preferences/', payload, format='json')
        self.assertEqual(response.status_code, 400)

    def test_trading_activity_ledger_sort_isolated_between_users(self):
        other = User.objects.create_user(
            username='tuto_prefs_b',
            email='tuto-prefs-b@example.invalid',
            password='TestPass!234',
        )
        other_prefs, _ = UserPreferences.objects.get_or_create(user=other)
        other_prefs.trading_activity_ledger_sort = {
            'debit': {'field': 'label', 'direction': 'asc'},
        }
        other_prefs.save(update_fields=['trading_activity_ledger_sort'])

        response = self.client.put(
            '/api/accounts/preferences/',
            {
                'trading_activity_ledger_sort': {
                    'debit': {'field': 'total', 'direction': 'desc'},
                },
            },
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.prefs.refresh_from_db()
        other_prefs.refresh_from_db()
        self.assertEqual(
            self.prefs.trading_activity_ledger_sort['debit']['field'],
            'total',
        )
        self.assertEqual(
            other_prefs.trading_activity_ledger_sort['debit']['field'],
            'label',
        )
