"""Tests garde pause API TopStep."""
from django.test import TestCase

from accounts.models import User, UserPreferences
from integrations.topstep_api_pause import (
    TOPSTEP_API_PAUSED_CODE,
    assert_topstep_api_allowed,
    is_topstep_api_paused,
)
from integrations.topstepx_client import TopStepXApiError


class TopStepApiPauseTests(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='pause@example.com',
            username='pause_user',
            password='testpass123',
        )

    def test_default_paused_without_preferences_row(self) -> None:
        self.assertTrue(is_topstep_api_paused(self.user))

    def test_paused_preference(self) -> None:
        UserPreferences.objects.create(user=self.user, topstep_api_paused=True)
        self.assertTrue(is_topstep_api_paused(self.user))

    def test_unpaused_preference(self) -> None:
        UserPreferences.objects.create(user=self.user, topstep_api_paused=False)
        self.assertFalse(is_topstep_api_paused(self.user))

    def test_assert_raises_when_paused(self) -> None:
        UserPreferences.objects.create(user=self.user, topstep_api_paused=True)
        with self.assertRaises(TopStepXApiError) as ctx:
            assert_topstep_api_allowed(self.user)
        self.assertEqual(ctx.exception.error_code, TOPSTEP_API_PAUSED_CODE)
