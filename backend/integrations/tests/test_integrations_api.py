"""Tests API intégrations multi-fournisseurs."""
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User
from integrations.credentials_crypto import (
    CREDENTIALS_DECRYPT_ERROR_CODE,
    CREDENTIALS_DECRYPT_USER_MESSAGE,
    decrypt_json,
    encrypt_json,
)
from integrations.models import UserApiIntegration
from integrations.providers.base import TestConnectionResult


@override_settings(
    INTEGRATIONS_CREDENTIALS_KEY='test-integrations-key-for-unit-tests-only',
)
class IntegrationsApiTests(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='integrations-test@example.com',
            username='integrations_test',
            password='testpass123',
            first_name='I',
            last_name='T',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.list_url = reverse('integrations:integration_list')
        self.detail_url = lambda slug: reverse('integrations:integration_detail', kwargs={'provider': slug})
        self.test_url = lambda slug: reverse('integrations:integration_test_connection', kwargs={'provider': slug})

    def test_list_includes_topstepx_provider(self) -> None:
        res = self.client.get(self.list_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        slugs = [item['provider'] for item in res.data['integrations']]
        self.assertIn('topstepx', slugs)
        topstepx = next(i for i in res.data['integrations'] if i['provider'] == 'topstepx')
        self.assertFalse(topstepx['configured'])
        self.assertNotIn('api_key', topstepx)

    def test_unknown_provider_returns_404(self) -> None:
        res = self.client.get(self.detail_url('unknown_broker'))
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    @override_settings(INTEGRATIONS_CREDENTIALS_KEY='integration-key-alpha')
    def test_put_reencrypts_when_stored_secrets_unreadable(self) -> None:
        token = encrypt_json({'api_key': 'old-key'})
        UserApiIntegration.objects.create(
            user=self.user,
            provider='topstepx',
            external_username='trader',
            secrets_encrypted=token,
        )
        with override_settings(INTEGRATIONS_CREDENTIALS_KEY='integration-key-beta'):
            res = self.client.put(
                self.detail_url('topstepx'),
                {'external_username': 'trader42', 'api_key': 'new-key-after-rotate'},
                format='json',
            )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        integration = UserApiIntegration.objects.get(user=self.user, provider='topstepx')
        secrets = decrypt_json(integration.secrets_encrypted)
        self.assertEqual(secrets['api_key'], 'new-key-after-rotate')

    def test_put_creates_encrypted_integration(self) -> None:
        res = self.client.put(
            self.detail_url('topstepx'),
            {
                'external_username': 'trader42',
                'api_key': 'secret-api-key-1234',
            },
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        integration = UserApiIntegration.objects.get(user=self.user, provider='topstepx')
        self.assertEqual(integration.external_username, 'trader42')
        secrets = decrypt_json(integration.secrets_encrypted)
        self.assertEqual(secrets['api_key'], 'secret-api-key-1234')
        self.assertIn('api_key', integration.secrets_hint)
        self.assertTrue(res.data['integration']['configured'])
        self.assertNotIn('api_key', res.data['integration'])

    def test_put_requires_api_key_on_create(self) -> None:
        res = self.client.put(
            self.detail_url('topstepx'),
            {'external_username': 'trader42'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_put_preserves_api_key_when_omitted(self) -> None:
        self.client.put(
            self.detail_url('topstepx'),
            {'external_username': 'trader42', 'api_key': 'keep-me'},
            format='json',
        )
        res = self.client.put(
            self.detail_url('topstepx'),
            {'external_username': 'trader99'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        integration = UserApiIntegration.objects.get(user=self.user, provider='topstepx')
        secrets = decrypt_json(integration.secrets_encrypted)
        self.assertEqual(secrets['api_key'], 'keep-me')
        self.assertEqual(integration.external_username, 'trader99')

    def test_unique_user_provider(self) -> None:
        UserApiIntegration.objects.create(
            user=self.user,
            provider='topstepx',
            external_username='a',
            secrets_encrypted='x',
        )
        with self.assertRaises(Exception):
            UserApiIntegration.objects.create(
                user=self.user,
                provider='topstepx',
                external_username='b',
                secrets_encrypted='y',
            )

    def test_delete_integration(self) -> None:
        self.client.put(
            self.detail_url('topstepx'),
            {'external_username': 'u', 'api_key': 'k'},
            format='json',
        )
        res = self.client.delete(self.detail_url('topstepx'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(UserApiIntegration.objects.filter(user=self.user, provider='topstepx').exists())

    @patch('integrations.providers.topstepx.TopStepXProvider.test_connection')
    def test_connection_success_updates_status(self, mock_test) -> None:
        mock_test.return_value = TestConnectionResult(success=True, message='OK')
        self.client.put(
            self.detail_url('topstepx'),
            {'external_username': 'u', 'api_key': 'k'},
            format='json',
        )
        res = self.client.post(self.test_url('topstepx'), {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data['success'])
        integration = UserApiIntegration.objects.get(user=self.user, provider='topstepx')
        self.assertTrue(integration.is_connected)
        self.assertIsNotNone(integration.last_validated_at)

    @patch('integrations.providers.topstepx.TopStepXProvider.test_connection')
    def test_connection_failure(self, mock_test) -> None:
        mock_test.return_value = TestConnectionResult(
            success=False,
            message='Invalid credentials',
            error_code='auth_failed',
        )
        self.client.put(
            self.detail_url('topstepx'),
            {'external_username': 'u', 'api_key': 'k'},
            format='json',
        )
        res = self.client.post(self.test_url('topstepx'), {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(res.data['success'])

    @override_settings(INTEGRATIONS_CREDENTIALS_KEY='integration-key-alpha')
    def test_resolve_credentials_accepts_new_api_key_when_stored_secrets_unreadable(self) -> None:
        token = encrypt_json({'api_key': 'stored-key'})
        integration = UserApiIntegration.objects.create(
            user=self.user,
            provider='topstepx',
            external_username='trader',
            secrets_encrypted=token,
        )
        with override_settings(INTEGRATIONS_CREDENTIALS_KEY='integration-key-beta'):
            from integrations.services import resolve_credentials

            public, secrets = resolve_credentials(
                integration,
                {'external_username': 'trader'},
                {'api_key': 'fresh-key-99'},
            )
            self.assertEqual(public['external_username'], 'trader')
            self.assertEqual(secrets['api_key'], 'fresh-key-99')

    @override_settings(INTEGRATIONS_CREDENTIALS_KEY='integration-key-alpha')
    def test_resolve_credentials_fails_when_encryption_key_changed(self) -> None:
        token = encrypt_json({'api_key': 'stored-key'})
        integration = UserApiIntegration.objects.create(
            user=self.user,
            provider='topstepx',
            external_username='trader',
            secrets_encrypted=token,
        )
        with override_settings(INTEGRATIONS_CREDENTIALS_KEY='integration-key-beta'):
            from integrations.services import resolve_credentials

            with self.assertRaises(ValueError) as ctx:
                resolve_credentials(integration, {}, {})
            self.assertEqual(str(ctx.exception), CREDENTIALS_DECRYPT_USER_MESSAGE)
            self.assertEqual(ctx.exception.error_code, CREDENTIALS_DECRYPT_ERROR_CODE)

    def test_export_data_excludes_integration_secrets(self) -> None:
        self.client.put(
            self.detail_url('topstepx'),
            {'external_username': 'u', 'api_key': 'super-secret'},
            format='json',
        )
        export_res = self.client.get(reverse('accounts:export_data'))
        self.assertEqual(export_res.status_code, status.HTTP_200_OK)
        content = export_res.content.decode('utf-8')
        self.assertNotIn('super-secret', content)
        self.assertNotIn('secrets_encrypted', content)
