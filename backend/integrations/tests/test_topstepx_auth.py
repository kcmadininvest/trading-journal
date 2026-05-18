"""Tests gestion de session TopStepX."""
from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings
from django.utils import timezone

from accounts.models import User
from integrations.credentials_crypto import encrypt_json
from integrations.models import UserApiIntegration
from integrations.topstepx_auth import (
    call_with_valid_session_token,
    clear_session_token,
    get_valid_session_token,
    is_session_expired_error,
)
from integrations.topstepx_client import TopStepXApiClient, TopStepXApiError, TopStepXAuthResult


@override_settings(
    INTEGRATIONS_CREDENTIALS_KEY='test-integrations-key-for-unit-tests-only',
)
class TopStepXAuthTests(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='topstep-auth@example.com',
            username='topstep_auth',
            password='testpass123',
        )
        self.integration = UserApiIntegration.objects.create(
            user=self.user,
            provider='topstepx',
            external_username='trader',
            secrets_encrypted=encrypt_json({
                'api_key': 'key-123',
                'session_token': 'stale-token',
            }),
            is_connected=True,
        )

    def test_is_session_expired_error(self) -> None:
        self.assertTrue(is_session_expired_error(TopStepXApiError('Session expirée')))
        self.assertFalse(is_session_expired_error(TopStepXApiError('Compte introuvable')))

    def test_clear_session_token(self) -> None:
        clear_session_token(self.integration)
        self.integration.refresh_from_db()
        from integrations.credentials_crypto import decrypt_json

        secrets = decrypt_json(self.integration.secrets_encrypted)
        self.assertNotIn('session_token', secrets)
        self.assertIn('api_key', secrets)

    @patch.object(TopStepXApiClient, 'login_key')
    def test_get_valid_session_token_refreshes_without_expiry(self, mock_login) -> None:
        mock_login.return_value = TopStepXAuthResult(
            token='fresh-token',
            expires_at=timezone.now() + timedelta(hours=12),
        )
        token = get_valid_session_token(self.integration)
        self.assertEqual(token, 'fresh-token')
        mock_login.assert_called_once()

    @patch.object(TopStepXApiClient, 'login_key')
    def test_call_with_valid_session_token_retries_on_expired_session(self, mock_login) -> None:
        mock_login.return_value = TopStepXAuthResult(
            token='fresh-token',
            expires_at=timezone.now() + timedelta(hours=12),
        )
        calls = {'count': 0}

        def callback(token: str) -> str:
            calls['count'] += 1
            if calls['count'] == 1:
                raise TopStepXApiError('Session expirée')
            return f'ok:{token}'

        result = call_with_valid_session_token(self.integration, callback)
        self.assertEqual(result, 'ok:fresh-token')
        self.assertEqual(calls['count'], 2)
        self.assertEqual(mock_login.call_count, 1)
