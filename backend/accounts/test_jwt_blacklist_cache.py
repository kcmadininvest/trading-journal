"""Cache Redis JWT blacklist : rejet + invalidation après logout."""
from __future__ import annotations

from django.core.cache import cache
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.jwt_blacklist_cache import (
    clear_jti_blacklist_cache,
    is_jti_blacklisted,
    mark_jti_blacklisted,
)
from accounts.jwt_cookies import ACCESS_COOKIE_NAME
from accounts.models import User


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
class JwtBlacklistCacheTests(APITestCase):
    def setUp(self) -> None:
        cache.clear()
        self.user = User.objects.create_user(
            email='jwt-cache@example.com',
            username='jwt_cache',
            password='testpass123',
        )
        self.client = APIClient(enforce_csrf_checks=True)

    def _login(self):
        self.client.get('/api/accounts/auth/csrf/')
        csrf = self.client.cookies.get('csrftoken')
        return self.client.post(
            '/api/accounts/auth/login/',
            {'email': 'jwt-cache@example.com', 'password': 'testpass123'},
            format='json',
            HTTP_X_CSRFTOKEN=csrf.value,
        )

    def test_mark_jti_blacklisted_sets_cache(self) -> None:
        refresh = RefreshToken.for_user(self.user)
        jti = refresh.access_token['jti']

        self.assertFalse(is_jti_blacklisted(jti))
        mark_jti_blacklisted(jti)
        self.assertTrue(is_jti_blacklisted(jti))

    def test_logout_blacklists_refresh_and_access(self) -> None:
        login = self._login()
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        access_before = self.client.cookies.get(ACCESS_COOKIE_NAME).value

        csrf = self.client.cookies.get('csrftoken')
        logout = self.client.post(
            '/api/accounts/auth/logout/',
            {},
            format='json',
            HTTP_X_CSRFTOKEN=csrf.value,
        )
        self.assertIn(logout.status_code, (200, 204, 205))

        # Même access en cookie → rejeté (blacklist)
        rejected_client = APIClient(enforce_csrf_checks=True)
        rejected_client.cookies[ACCESS_COOKIE_NAME] = access_before
        rejected = rejected_client.get('/api/accounts/preferences/')
        self.assertIn(rejected.status_code, (401, 403))

    def test_clear_cache_refreshes_from_db(self) -> None:
        refresh = RefreshToken.for_user(self.user)
        jti = refresh.access_token['jti']

        mark_jti_blacklisted(jti)
        self.assertTrue(is_jti_blacklisted(jti))

        clear_jti_blacklist_cache(jti)
        cache.delete(f'jwt_blacklist:jti:{jti}')
        self.assertFalse(is_jti_blacklisted(jti))
