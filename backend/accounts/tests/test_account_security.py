"""Campagne de tests — passkeys WebAuthn, TOTP coexistants, récupération 2FA."""
from __future__ import annotations

from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch

import pyotp
from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken
from webauthn.helpers import bytes_to_base64url

from accounts.account_security import (
    begin_totp_setup,
    confirm_totp_setup,
    create_recovery_request,
    destroy_totp,
    totp_enabled,
)
from accounts.account_security_crypto import decrypt_totp_secret
from accounts.account_webauthn import finish_authentication, finish_registration
from accounts.jwt_cookies import ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME
from accounts.models import (
    BackupCode,
    LoginHistory,
    TotpDevice,
    TwoFactorRecoveryRequest,
    User,
    WebAuthnCredential,
)
from accounts.utils import create_password_reset_token


@override_settings(
    PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'],
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    WEBAUTHN_RP_ID='127.0.0.1',
    WEBAUTHN_ORIGIN='http://127.0.0.1:3000',
    REST_FRAMEWORK={
        'DEFAULT_AUTHENTICATION_CLASSES': (
            'accounts.authentication.BlacklistJWTAuthentication',
        ),
        'DEFAULT_PERMISSION_CLASSES': (
            'rest_framework.permissions.IsAuthenticated',
        ),
        'DEFAULT_THROTTLE_CLASSES': [],
        'DEFAULT_THROTTLE_RATES': {
            'login': '10000/minute',
            'anon': '10000/hour',
            'user': '10000/hour',
            'password_reset': '10000/hour',
            'password_reset_confirm': '10000/hour',
        },
    },
)
class AccountSecurityCampaignTests(APITestCase):
    def setUp(self):
        cache.clear()
        mail.outbox.clear()
        self.password = 'TestPass123!'
        self.user = User.objects.create_user(
            username='secuser',
            email='sec@example.com',
            password=self.password,
            first_name='Sec',
            last_name='User',
            is_active=True,
            is_verified=True,
        )
        self.other = User.objects.create_user(
            username='othersec',
            email='other@example.com',
            password=self.password,
            first_name='Other',
            last_name='User',
            is_active=True,
            is_verified=True,
        )

    def _login_password(self, email=None, password=None):
        return self.client.post(
            reverse('accounts:login'),
            {'email': email or self.user.email, 'password': password or self.password},
            format='json',
        )

    def _auth_as(self, user):
        refresh = RefreshToken.for_user(user)
        self.client.cookies[ACCESS_COOKIE_NAME] = str(refresh.access_token)
        self.client.cookies[REFRESH_COOKIE_NAME] = str(refresh)
        return refresh

    def _enable_totp(self, user=None):
        user = user or self.user
        setup = begin_totp_setup(user)
        secret = setup['secret']
        codes = confirm_totp_setup(user, pyotp.TOTP(secret).now())
        return secret, codes

    def _register_passkey(self, user=None, cred_id: bytes | None = None):
        user = user or self.user
        self._auth_as(user)
        begin = self.client.post(
            reverse('accounts:passkey_register_begin'),
            {'password': self.password},
            format='json',
        )
        self.assertEqual(begin.status_code, status.HTTP_200_OK)
        self.assertIn('challenge_id', begin.data)
        self.assertIn('excludeCredentials', begin.data)
        cid = cred_id or b'cred-' + str(user.id).encode() + b'-' + bytes([1, 2, 3, 4])
        pub = b'\x04' + b'\x11' * 64
        fake_verification = SimpleNamespace(
            credential_id=cid,
            credential_public_key=pub,
            sign_count=1,
        )
        with patch(
            'accounts.account_webauthn.verify_registration_response',
            return_value=fake_verification,
        ):
            finish = self.client.post(
                reverse('accounts:passkey_register_finish'),
                {
                    'password': self.password,
                    'challenge_id': begin.data['challenge_id'],
                    'credential': {
                        'id': bytes_to_base64url(cid),
                        'rawId': bytes_to_base64url(cid),
                        'type': 'public-key',
                        'response': {'clientDataJSON': '', 'attestationObject': '', 'transports': ['internal']},
                    },
                    'label': 'Test Key',
                },
                format='json',
            )
        self.assertEqual(finish.status_code, status.HTTP_201_CREATED)
        return WebAuthnCredential.objects.get(user=user, credential_id=bytes_to_base64url(cid))

    # --- Login de base ---

    def test_01_password_login_without_options(self):
        response = self._login_password()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(ACCESS_COOKIE_NAME, response.cookies)
        self.assertNotIn('requires_2fa', response.data)
        history = LoginHistory.objects.filter(user=self.user, success=True).latest('date')
        self.assertEqual(history.method, LoginHistory.METHOD_PASSWORD)

    def test_02_failed_password_login_recorded(self):
        response = self._login_password(password='WrongPass999!')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        history = LoginHistory.objects.filter(user=self.user, success=False).latest('date')
        self.assertEqual(history.method, LoginHistory.METHOD_PASSWORD)

    # --- Passkeys ---

    def test_03_passkey_register_requires_password(self):
        self._auth_as(self.user)
        bad = self.client.post(
            reverse('accounts:passkey_register_begin'),
            {'password': 'Wrong'},
            format='json',
        )
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)
        cred = self._register_passkey()
        self.assertTrue(cred.pk)
        status_payload = self.client.get(reverse('accounts:security_status')).data
        self.assertTrue(status_payload['passkey_enabled'])
        self.assertEqual(len(status_payload['passkeys']), 1)

    def test_04_passkey_login_success_and_history(self):
        cred = self._register_passkey()
        self.client.cookies.clear()
        begin = self.client.post(reverse('accounts:login_passkey_begin'), {}, format='json')
        self.assertEqual(begin.status_code, status.HTTP_200_OK)
        fake_auth = SimpleNamespace(new_sign_count=2)
        with patch(
            'accounts.account_webauthn.verify_authentication_response',
            return_value=fake_auth,
        ):
            ok = self.client.post(
                reverse('accounts:login_passkey_finish'),
                {
                    'challenge_id': begin.data['challenge_id'],
                    'credential': {
                        'id': cred.credential_id,
                        'rawId': cred.credential_id,
                        'type': 'public-key',
                        'response': {
                            'clientDataJSON': '',
                            'authenticatorData': '',
                            'signature': '',
                        },
                    },
                },
                format='json',
            )
        self.assertEqual(ok.status_code, status.HTTP_200_OK)
        self.assertIn(ACCESS_COOKIE_NAME, ok.cookies)
        history = LoginHistory.objects.filter(user=self.user, success=True).latest('date')
        self.assertEqual(history.method, LoginHistory.METHOD_PASSKEY)

    def test_05_passkey_isolation_between_accounts(self):
        cred_a = self._register_passkey(self.user, cred_id=b'user-a-cred')
        self._register_passkey(self.other, cred_id=b'user-b-cred')
        self.client.cookies.clear()
        begin = self.client.post(
            reverse('accounts:login_passkey_begin'),
            {'email': self.other.email},
            format='json',
        )
        fake_auth = SimpleNamespace(new_sign_count=1)
        with patch(
            'accounts.account_webauthn.verify_authentication_response',
            return_value=fake_auth,
        ):
            # Credential de A présentée sur challenge scoped à B → 401
            bad = self.client.post(
                reverse('accounts:login_passkey_finish'),
                {
                    'challenge_id': begin.data['challenge_id'],
                    'credential': {
                        'id': cred_a.credential_id,
                        'rawId': cred_a.credential_id,
                        'type': 'public-key',
                        'response': {
                            'clientDataJSON': '',
                            'authenticatorData': '',
                            'signature': '',
                        },
                    },
                },
                format='json',
            )
        self.assertEqual(bad.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_06_invalid_passkey_finish_generic(self):
        begin = self.client.post(reverse('accounts:login_passkey_begin'), {}, format='json')
        bad = self.client.post(
            reverse('accounts:login_passkey_finish'),
            {
                'challenge_id': begin.data['challenge_id'],
                'credential': {'id': 'unknown', 'type': 'public-key', 'response': {}},
            },
            format='json',
        )
        self.assertEqual(bad.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('detail', bad.data)

    def test_07_passkey_begin_email_anti_enumeration(self):
        r1 = self.client.post(
            reverse('accounts:login_passkey_begin'),
            {'email': 'nobody@example.com'},
            format='json',
        )
        r2 = self.client.post(
            reverse('accounts:login_passkey_begin'),
            {'email': self.user.email},
            format='json',
        )
        self.assertEqual(r1.status_code, status.HTTP_200_OK)
        self.assertEqual(r2.status_code, status.HTTP_200_OK)
        self.assertIn('challenge_id', r1.data)
        self.assertIn('challenge_id', r2.data)
        self.assertIn('challenge', r1.data)
        self.assertIn('challenge', r2.data)

    def test_08_exclude_credentials_on_second_register(self):
        first = self._register_passkey(cred_id=b'first-cred-id')
        begin = self.client.post(
            reverse('accounts:passkey_register_begin'),
            {'password': self.password},
            format='json',
        )
        ids = [c.get('id') for c in begin.data.get('excludeCredentials') or []]
        self.assertIn(first.credential_id, ids)

    def test_09_delete_passkey(self):
        cred = self._register_passkey()
        resp = self.client.post(
            reverse('accounts:passkey_delete'),
            {'password': self.password, 'passkey_id': cred.pk},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(WebAuthnCredential.objects.filter(pk=cred.pk).exists())

    # --- Coexistence passkey / 2FA ---

    def test_10_passkey_and_totp_coexist(self):
        self._register_passkey()
        self._enable_totp()
        self.assertTrue(WebAuthnCredential.objects.filter(user=self.user).exists())
        self.assertTrue(totp_enabled(self.user))
        # Login MDP → 2FA
        step = self._login_password()
        self.assertTrue(step.data.get('requires_2fa'))
        # Login passkey → pas de 2FA (mock)
        cred = WebAuthnCredential.objects.get(user=self.user)
        self.client.cookies.clear()
        begin = self.client.post(reverse('accounts:login_passkey_begin'), {}, format='json')
        with patch(
            'accounts.account_webauthn.verify_authentication_response',
            return_value=SimpleNamespace(new_sign_count=3),
        ):
            ok = self.client.post(
                reverse('accounts:login_passkey_finish'),
                {
                    'challenge_id': begin.data['challenge_id'],
                    'credential': {
                        'id': cred.credential_id,
                        'rawId': cred.credential_id,
                        'type': 'public-key',
                        'response': {
                            'clientDataJSON': '',
                            'authenticatorData': '',
                            'signature': '',
                        },
                    },
                },
                format='json',
            )
        self.assertEqual(ok.status_code, status.HTTP_200_OK)
        self.assertIn(ACCESS_COOKIE_NAME, ok.cookies)
        self.assertNotIn('requires_2fa', ok.data)

    def test_11_enabling_totp_keeps_passkeys(self):
        self._register_passkey()
        self._enable_totp()
        self.assertEqual(WebAuthnCredential.objects.filter(user=self.user).count(), 1)

    def test_12_enabling_passkey_keeps_totp(self):
        self._enable_totp()
        self._register_passkey(cred_id=b'after-totp')
        self.assertTrue(totp_enabled(self.user))
        self.assertTrue(BackupCode.objects.filter(user=self.user).exists())

    # --- TOTP ---

    def test_13_totp_pending_does_not_require_challenge(self):
        begin_totp_setup(self.user)
        self.assertTrue(TotpDevice.objects.filter(user=self.user, enabled=False).exists())
        response = self._login_password()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn('requires_2fa', response.data)
        self.assertIn(ACCESS_COOKIE_NAME, response.cookies)

    def test_14_totp_enabled_returns_challenge_without_cookies(self):
        self._enable_totp()
        response = self._login_password()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['requires_2fa'])
        self.assertTrue(response.data['challenge'])
        self.assertNotIn(ACCESS_COOKIE_NAME, response.cookies)

    def test_15_totp_success_sets_cookies(self):
        secret, _ = self._enable_totp()
        step = self._login_password()
        code = pyotp.TOTP(secret).now()
        ok = self.client.post(
            reverse('accounts:login_2fa'),
            {'challenge': step.data['challenge'], 'code': code},
            format='json',
        )
        self.assertEqual(ok.status_code, status.HTTP_200_OK)
        self.assertIn(ACCESS_COOKIE_NAME, ok.cookies)
        self.assertEqual(ok.data['user']['id'], self.user.id)

    def test_16_totp_code_replay_rejected(self):
        secret, _ = self._enable_totp()
        step1 = self._login_password()
        code = pyotp.TOTP(secret).now()
        first = self.client.post(
            reverse('accounts:login_2fa'),
            {'challenge': step1.data['challenge'], 'code': code},
            format='json',
        )
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        step2 = self._login_password()
        replay = self.client.post(
            reverse('accounts:login_2fa'),
            {'challenge': step2.data['challenge'], 'code': code},
            format='json',
        )
        self.assertEqual(replay.status_code, status.HTTP_400_BAD_REQUEST)

    def test_17_backup_code_once(self):
        _, codes = self._enable_totp()
        step = self._login_password()
        ok = self.client.post(
            reverse('accounts:login_2fa'),
            {'challenge': step.data['challenge'], 'code': codes[0]},
            format='json',
        )
        self.assertEqual(ok.status_code, status.HTTP_200_OK)
        self.assertTrue(BackupCode.objects.filter(user=self.user, used_at__isnull=False).exists())
        step2 = self._login_password()
        reuse = self.client.post(
            reverse('accounts:login_2fa'),
            {'challenge': step2.data['challenge'], 'code': codes[0]},
            format='json',
        )
        self.assertEqual(reuse.status_code, status.HTTP_400_BAD_REQUEST)

    def test_18_five_failures_lock_account_2fa(self):
        self._enable_totp()
        step = self._login_password()
        challenge = step.data['challenge']
        last = None
        for _ in range(5):
            last = self.client.post(
                reverse('accounts:login_2fa'),
                {'challenge': challenge, 'code': '000000'},
                format='json',
            )
        self.assertEqual(last.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        again = self._login_password()
        self.assertEqual(again.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_19_wrong_totp_on_other_user_challenge(self):
        secret_a, _ = self._enable_totp(self.user)
        self._enable_totp(self.other)
        step_other = self.client.post(
            reverse('accounts:login'),
            {'email': self.other.email, 'password': self.password},
            format='json',
        )
        code_a = pyotp.TOTP(secret_a).now()
        bad = self.client.post(
            reverse('accounts:login_2fa'),
            {'challenge': step_other.data['challenge'], 'code': code_a},
            format='json',
        )
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)

    def test_20_totp_secret_encrypted_at_rest(self):
        setup = begin_totp_setup(self.user)
        device = TotpDevice.objects.get(user=self.user)
        self.assertNotEqual(device.secret_encrypted, setup['secret'])
        self.assertEqual(decrypt_totp_secret(device.secret_encrypted), setup['secret'])

    def test_21_begin_totp_again_replaces_pending_secret(self):
        first = begin_totp_setup(self.user)
        second = begin_totp_setup(self.user)
        self.assertNotEqual(first['secret'], second['secret'])
        self.assertEqual(TotpDevice.objects.filter(user=self.user).count(), 1)
        self._auth_as(self.user)
        resp = self.client.post(
            reverse('accounts:totp_confirm'),
            {'password': self.password, 'code': pyotp.TOTP(first['secret']).now()},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_22_confirm_totp_returns_ten_backup_codes(self):
        self._auth_as(self.user)
        begin = self.client.post(
            reverse('accounts:totp_begin'),
            {'password': self.password},
            format='json',
        )
        self.assertEqual(begin.status_code, status.HTTP_200_OK)
        self.assertIn('qr_data_url', begin.data)
        code = pyotp.TOTP(begin.data['secret']).now()
        confirm = self.client.post(
            reverse('accounts:totp_confirm'),
            {'password': self.password, 'code': code},
            format='json',
        )
        self.assertEqual(confirm.status_code, status.HTTP_200_OK)
        self.assertEqual(len(confirm.data['backup_codes']), 10)

    def test_23_disable_and_regenerate_backup_codes(self):
        secret, codes = self._enable_totp()
        self._auth_as(self.user)
        regen = self.client.post(
            reverse('accounts:backup_codes_regenerate'),
            {
                'password': self.password,
                'code': pyotp.TOTP(secret).now(),
            },
            format='json',
        )
        self.assertEqual(regen.status_code, status.HTTP_200_OK)
        self.assertEqual(len(regen.data['backup_codes']), 10)
        self.assertNotEqual(set(regen.data['backup_codes']), set(codes))
        cache.clear()
        TotpDevice.objects.filter(user=self.user).update(enabled=True)
        disable = self.client.post(
            reverse('accounts:totp_disable'),
            {
                'password': self.password,
                'code': pyotp.TOTP(secret).now(),
            },
            format='json',
        )
        self.assertEqual(disable.status_code, status.HTTP_200_OK)
        self.assertFalse(TotpDevice.objects.filter(user=self.user).exists())

    # --- Mot de passe / passkeys ---

    def test_24_password_change_keeps_passkeys(self):
        cred = self._register_passkey()
        resp = self.client.post(
            reverse('accounts:change_password'),
            {
                'old_password': self.password,
                'new_password': 'NewPass123!xyz',
                'new_password_confirm': 'NewPass123!xyz',
            },
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(WebAuthnCredential.objects.filter(pk=cred.pk).exists())
        self.password = 'NewPass123!xyz'
        self.client.cookies.clear()
        ok = self._login_password()
        self.assertEqual(ok.status_code, status.HTTP_200_OK)

    def test_25_password_reset_keeps_passkeys_and_totp(self):
        cred = self._register_passkey()
        secret, _ = self._enable_totp()
        token = create_password_reset_token(self.user)
        resp = self.client.post(
            reverse('accounts:password_reset_confirm'),
            {
                'token': str(token.token),
                'new_password': 'ResetPass123!ab',
                'new_password_confirm': 'ResetPass123!ab',
            },
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(WebAuthnCredential.objects.filter(pk=cred.pk).exists())
        self.assertTrue(totp_enabled(self.user))
        self.password = 'ResetPass123!ab'
        step = self._login_password()
        self.assertTrue(step.data.get('requires_2fa'))
        del secret

    # --- Récupération 2FA ---

    def test_26_recovery_request_generic_and_email(self):
        self._enable_totp()
        resp = self.client.post(
            reverse('accounts:2fa_recovery_request'),
            {'email': self.user.email},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('message', resp.data)
        self.assertEqual(len(mail.outbox), 1)
        self.assertTrue(
            TwoFactorRecoveryRequest.objects.filter(user=self.user, cancelled_at__isnull=True).exists()
        )
        mail.outbox.clear()
        resp2 = self.client.post(
            reverse('accounts:2fa_recovery_request'),
            {'email': 'nobody@example.com'},
            format='json',
        )
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        self.assertEqual(resp2.data['message'], resp.data['message'])
        self.assertEqual(len(mail.outbox), 0)

    def test_27_recovery_too_early_and_cancel_link(self):
        self._enable_totp()
        recovery = create_recovery_request(self.user)
        too_early = self.client.post(
            reverse('accounts:2fa_recovery_confirm'),
            {'token': str(recovery.token)},
            format='json',
        )
        self.assertEqual(too_early.status_code, status.HTTP_400_BAD_REQUEST)
        cancel = self.client.post(
            reverse('accounts:2fa_recovery_cancel'),
            {'cancel_token': str(recovery.cancel_token)},
            format='json',
        )
        self.assertEqual(cancel.status_code, status.HTTP_200_OK)
        recovery.refresh_from_db()
        self.assertIsNotNone(recovery.cancelled_at)

    def test_28_recovery_completes_after_window(self):
        self._enable_totp()
        recovery = create_recovery_request(self.user)
        recovery.usable_from = timezone.now() - timedelta(minutes=1)
        recovery.expires_at = timezone.now() + timedelta(hours=1)
        recovery.save()
        done = self.client.post(
            reverse('accounts:2fa_recovery_confirm'),
            {'token': str(recovery.token)},
            format='json',
        )
        self.assertEqual(done.status_code, status.HTTP_200_OK)
        self.assertFalse(TotpDevice.objects.filter(user=self.user).exists())
        login = self._login_password()
        self.assertNotIn('requires_2fa', login.data)

    def test_29_successful_2fa_login_cancels_pending_recovery(self):
        secret, _ = self._enable_totp()
        recovery = create_recovery_request(self.user)
        step = self._login_password()
        ok = self.client.post(
            reverse('accounts:login_2fa'),
            {
                'challenge': step.data['challenge'],
                'code': pyotp.TOTP(secret).now(),
            },
            format='json',
        )
        self.assertEqual(ok.status_code, status.HTTP_200_OK)
        recovery.refresh_from_db()
        self.assertIsNotNone(recovery.cancelled_at)

    def test_30_second_recovery_request_does_not_extend_window(self):
        self._enable_totp()
        first = create_recovery_request(self.user)
        usable = first.usable_from
        expires = first.expires_at
        second = create_recovery_request(self.user)
        self.assertEqual(first.pk, second.pk)
        self.assertEqual(second.usable_from, usable)
        self.assertEqual(second.expires_at, expires)

    # --- Cloisonnement / statut ---

    def test_31_security_status_no_secrets_and_isolation(self):
        self._register_passkey(self.other, cred_id=b'other-only')
        begin_totp_setup(self.other)
        self._auth_as(self.user)
        resp = self.client.get(reverse('accounts:security_status'))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data['passkey_enabled'])
        self.assertFalse(resp.data['totp_enabled'])
        blob = str(resp.data).lower()
        self.assertNotIn('public_key', blob)

    def test_32_user_cannot_delete_other_passkey(self):
        other_cred = self._register_passkey(self.other, cred_id=b'other-cred')
        self._auth_as(self.user)
        resp = self.client.post(
            reverse('accounts:passkey_delete'),
            {'password': self.password, 'passkey_id': other_cred.pk},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(WebAuthnCredential.objects.filter(pk=other_cred.pk).exists())
