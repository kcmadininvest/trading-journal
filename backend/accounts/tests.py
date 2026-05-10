from rest_framework.test import APITestCase

from accounts.models import User, UserPreferences


class UserPreferencesPnlDisplayTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='prefs-pnl@example.com',
            username='prefs_pnl',
            password='testpass123',
            first_name='P',
            last_name='N',
        )
        UserPreferences.objects.get_or_create(user=self.user)

    def test_put_updates_pnl_display(self) -> None:
        self.client.force_authenticate(user=self.user)
        response = self.client.put(
            '/api/accounts/preferences/',
            {'pnl_display': 'gross'},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.data)
        prefs = UserPreferences.objects.get(user=self.user)
        self.assertEqual(prefs.pnl_display, 'gross')
        payload = response.data.get('preferences') or response.data
        self.assertEqual(payload.get('pnl_display'), 'gross')
