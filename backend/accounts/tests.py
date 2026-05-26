from rest_framework.test import APITestCase

from accounts.models import AppSettings, User, UserPreferences


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


class AppSettingsApiTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='user-appsettings@example.com',
            username='user_appsettings',
            password='testpass123',
        )
        self.admin = User.objects.create_user(
            email='admin-appsettings@example.com',
            username='admin_appsettings',
            password='testpass123',
            role='admin',
        )
        AppSettings.get_solo()

    def test_get_app_settings_authenticated(self) -> None:
        self.client.force_authenticate(self.user)
        response = self.client.get('/api/accounts/app-settings/')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['premium_restrictions_enabled'])

    def test_put_app_settings_forbidden_for_regular_user(self) -> None:
        self.client.force_authenticate(self.user)
        response = self.client.put(
            '/api/accounts/app-settings/',
            {'premium_restrictions_enabled': False},
            format='json',
        )
        self.assertEqual(response.status_code, 403)

    def test_put_app_settings_allowed_for_admin(self) -> None:
        self.client.force_authenticate(self.admin)
        response = self.client.put(
            '/api/accounts/app-settings/',
            {'premium_restrictions_enabled': False},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json().get('app_settings') or response.json()
        self.assertFalse(payload['premium_restrictions_enabled'])
        self.assertFalse(AppSettings.get_solo().premium_restrictions_enabled)
