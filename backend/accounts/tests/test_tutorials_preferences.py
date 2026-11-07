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
