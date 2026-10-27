"""Tests forgot-password + invalidation sessions au change-password."""
from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.jwt_cookies import ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME
from accounts.models import PasswordResetToken, User
from accounts.utils import get_password_reset_generic_message


@override_settings(
    DEBUG=True,
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    REST_FRAMEWORK={
        'DEFAULT_AUTHENTICATION_CLASSES': (
            'accounts.authentication.BlacklistJWTAuthentication',
        ),
        'DEFAULT_PERMISSION_CLASSES': (
            'rest_framework.permissions.IsAuthenticated',
        ),
        'DEFAULT_THROTTLE_CLASSES': [],
        'DEFAULT_THROTTLE_RATES': {
            'login': '1000/minute',
            'anon': '1000/hour',
            'user': '10000/hour',
            'password_reset': '1000/hour',
            'password_reset_confirm': '1000/hour',
        },
    },
)
class PasswordResetTests(TestCase):
    def setUp(self) -> None:
        cache.clear()
        self.client = APIClient(enforce_csrf_checks=True)
        self.active_user = User.objects.create_user(
            email='active@example.com',
            username='active_user',
            password='OldPass123!',
            is_active=True,
        )
        self.inactive_user = User.objects.create_user(
            email='inactive@example.com',
            username='inactive_user',
            password='OldPass123!',
            is_active=False,
        )
        self.generic = get_password_reset_generic_message()

    def _csrf(self):
        self.client.get('/api/accounts/auth/csrf/')
        csrf = self.client.cookies.get('csrftoken')
        self.assertIsNotNone(csrf)
        return csrf.value

    def test_unknown_email_returns_generic_200_no_token(self) -> None:
        csrf = self._csrf()
        with patch('accounts.views.send_password_reset_email') as send_mock:
            response = self.client.post(
                '/api/accounts/auth/password-reset/',
                {'email': 'unknown@example.com'},
                format='json',
                HTTP_X_CSRFTOKEN=csrf,
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['message'], self.generic)
        self.assertEqual(PasswordResetToken.objects.count(), 0)
        send_mock.assert_not_called()

    def test_inactive_email_returns_generic_200_no_token(self) -> None:
        csrf = self._csrf()
        with patch('accounts.views.send_password_reset_email') as send_mock:
            response = self.client.post(
                '/api/accounts/auth/password-reset/',
                {'email': 'inactive@example.com'},
                format='json',
                HTTP_X_CSRFTOKEN=csrf,
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['message'], self.generic)
        self.assertEqual(PasswordResetToken.objects.count(), 0)
        send_mock.assert_not_called()

    def test_active_email_creates_token_and_sends_email(self) -> None:
        csrf = self._csrf()
        with patch('accounts.views.send_password_reset_email', return_value=True) as send_mock:
            response = self.client.post(
                '/api/accounts/auth/password-reset/',
                {'email': 'Active@Example.com'},
                format='json',
                HTTP_X_CSRFTOKEN=csrf,
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['message'], self.generic)
        token = PasswordResetToken.objects.get(user=self.active_user)
        self.assertTrue(token.is_valid())
        send_mock.assert_called_once()

    def test_request_with_access_cookie_requires_csrf(self) -> None:
        """CSRF forcé seulement si cookie tj_access présent (BlacklistJWTAuthentication)."""
        refresh = RefreshToken.for_user(self.active_user)
        client = APIClient(enforce_csrf_checks=True)
        client.cookies[ACCESS_COOKIE_NAME] = str(refresh.access_token)
        response = client.post(
            '/api/accounts/auth/password-reset/',
            {'email': 'active@example.com'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_confirm_success_blacklists_all_refresh_and_clears_cookies(self) -> None:
        # Session existante (autre appareil + cookies courants)
        other_refresh = RefreshToken.for_user(self.active_user)
        current_refresh = RefreshToken.for_user(self.active_user)
        access = str(current_refresh.access_token)

        reset_token = PasswordResetToken.objects.create(user=self.active_user)
        csrf = self._csrf()
        self.client.cookies[ACCESS_COOKIE_NAME] = access
        self.client.cookies[REFRESH_COOKIE_NAME] = str(current_refresh)

        response = self.client.post(
            '/api/accounts/auth/password-reset/confirm/',
            {
                'token': str(reset_token.token),
                'new_password': 'NewPass456!',
                'new_password_confirm': 'NewPass456!',
            },
            format='json',
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.active_user.refresh_from_db()
        self.assertTrue(self.active_user.check_password('NewPass456!'))

        reset_token.refresh_from_db()
        self.assertTrue(reset_token.is_used)

        for refresh in (other_refresh, current_refresh):
            jti = str(refresh['jti'])
            outstanding = OutstandingToken.objects.get(jti=jti)
            self.assertTrue(BlacklistedToken.objects.filter(token=outstanding).exists())

        # Cookies cleared on response
        access_cookie = response.cookies.get(ACCESS_COOKIE_NAME)
        refresh_cookie = response.cookies.get(REFRESH_COOKIE_NAME)
        self.assertIsNotNone(access_cookie)
        self.assertEqual(access_cookie.value, '')
        self.assertIsNotNone(refresh_cookie)
        self.assertEqual(refresh_cookie.value, '')

    def test_confirm_expired_token(self) -> None:
        reset_token = PasswordResetToken.objects.create(user=self.active_user)
        PasswordResetToken.objects.filter(pk=reset_token.pk).update(
            expires_at=timezone.now() - timedelta(minutes=1)
        )
        csrf = self._csrf()
        response = self.client.post(
            '/api/accounts/auth/password-reset/confirm/',
            {
                'token': str(reset_token.token),
                'new_password': 'NewPass456!',
                'new_password_confirm': 'NewPass456!',
            },
            format='json',
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.active_user.refresh_from_db()
        self.assertTrue(self.active_user.check_password('OldPass123!'))

    def test_confirm_used_token(self) -> None:
        reset_token = PasswordResetToken.objects.create(user=self.active_user, is_used=True)
        csrf = self._csrf()
        response = self.client.post(
            '/api/accounts/auth/password-reset/confirm/',
            {
                'token': str(reset_token.token),
                'new_password': 'NewPass456!',
                'new_password_confirm': 'NewPass456!',
            },
            format='json',
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_confirm_password_mismatch(self) -> None:
        reset_token = PasswordResetToken.objects.create(user=self.active_user)
        csrf = self._csrf()
        response = self.client.post(
            '/api/accounts/auth/password-reset/confirm/',
            {
                'token': str(reset_token.token),
                'new_password': 'NewPass456!',
                'new_password_confirm': 'OtherPass789!',
            },
            format='json',
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_confirm_weak_password(self) -> None:
        reset_token = PasswordResetToken.objects.create(user=self.active_user)
        csrf = self._csrf()
        response = self.client.post(
            '/api/accounts/auth/password-reset/confirm/',
            {
                'token': str(reset_token.token),
                'new_password': '123',
                'new_password_confirm': '123',
            },
            format='json',
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


@override_settings(
    DEBUG=True,
    REST_FRAMEWORK={
        'DEFAULT_AUTHENTICATION_CLASSES': (
            'accounts.authentication.BlacklistJWTAuthentication',
        ),
        'DEFAULT_PERMISSION_CLASSES': (
            'rest_framework.permissions.IsAuthenticated',
        ),
        'DEFAULT_THROTTLE_CLASSES': [],
        'DEFAULT_THROTTLE_RATES': {
            'login': '1000/minute',
            'anon': '1000/hour',
            'user': '10000/hour',
        },
    },
)
class PasswordChangeSessionInvalidationTests(TestCase):
    def setUp(self) -> None:
        cache.clear()
        self.client = APIClient(enforce_csrf_checks=True)
        self.user = User.objects.create_user(
            email='changer@example.com',
            username='changer',
            password='OldPass123!',
            is_active=True,
        )

    def _login(self):
        self.client.get('/api/accounts/auth/csrf/')
        csrf = self.client.cookies.get('csrftoken')
        return self.client.post(
            '/api/accounts/auth/login/',
            {'email': 'changer@example.com', 'password': 'OldPass123!'},
            format='json',
            HTTP_X_CSRFTOKEN=csrf.value,
        )

    def test_change_password_keeps_current_session_blacklists_others(self) -> None:
        login_resp = self._login()
        self.assertEqual(login_resp.status_code, status.HTTP_200_OK)
        current_refresh = self.client.cookies.get(REFRESH_COOKIE_NAME).value
        current_jti = str(RefreshToken(current_refresh)['jti'])

        other = RefreshToken.for_user(self.user)
        other_jti = str(other['jti'])

        csrf = self.client.cookies.get('csrftoken').value
        response = self.client.post(
            '/api/accounts/profile/change-password/',
            {
                'old_password': 'OldPass123!',
                'new_password': 'BrandNewPass1!',
                'new_password_confirm': 'BrandNewPass1!',
            },
            format='json',
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Cookies not cleared
        self.assertTrue(self.client.cookies.get(ACCESS_COOKIE_NAME).value)
        self.assertTrue(self.client.cookies.get(REFRESH_COOKIE_NAME).value)

        other_ot = OutstandingToken.objects.get(jti=other_jti)
        self.assertTrue(BlacklistedToken.objects.filter(token=other_ot).exists())

        current_ot = OutstandingToken.objects.get(jti=current_jti)
        self.assertFalse(BlacklistedToken.objects.filter(token=current_ot).exists())

        # Current session still works
        profile = self.client.get('/api/accounts/profile/')
        self.assertEqual(profile.status_code, status.HTTP_200_OK)

        refresh_resp = self.client.post(
            '/api/accounts/auth/refresh/',
            {},
            format='json',
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(refresh_resp.status_code, status.HTTP_200_OK)
