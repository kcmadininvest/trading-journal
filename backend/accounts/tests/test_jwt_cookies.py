"""Tests auth JWT via cookies HttpOnly (cookie-only, plus de Bearer / body.refresh)."""
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.jwt_cookies import ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME
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
class JwtCookieAuthTests(TestCase):
    def setUp(self) -> None:
        cache.clear()
        self.client = APIClient(enforce_csrf_checks=True)
        self.user = User.objects.create_user(
            email='cookie-user@example.com',
            username='cookie_user',
            password='CookiePass123!',
        )

    def _login(self):
        self.client.get('/api/accounts/auth/csrf/')
        csrf = self.client.cookies.get('csrftoken')
        self.assertIsNotNone(csrf)
        return self.client.post(
            '/api/accounts/auth/login/',
            {'email': 'cookie-user@example.com', 'password': 'CookiePass123!'},
            format='json',
            HTTP_X_CSRFTOKEN=csrf.value,
        )

    def test_login_sets_httponly_cookies_without_body_tokens(self) -> None:
        """P1"""
        response = self._login()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn('access', response.data)
        self.assertNotIn('refresh', response.data)
        self.assertIn('user', response.data)
        access = response.cookies.get(ACCESS_COOKIE_NAME)
        refresh = response.cookies.get(REFRESH_COOKIE_NAME)
        self.assertIsNotNone(access)
        self.assertIsNotNone(refresh)
        self.assertTrue(access['httponly'])
        self.assertTrue(refresh['httponly'])

    def test_authenticated_get_with_cookie_no_bearer(self) -> None:
        """P2"""
        self._login()
        response = self.client.get('/api/accounts/profile/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_cookie_auth_mutation_requires_csrf(self) -> None:
        """P3 + P4"""
        self._login()
        response = self.client.post(
            '/api/accounts/session/extend/',
            {},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        csrf = self.client.cookies.get('csrftoken')
        response_ok = self.client.post(
            '/api/accounts/session/extend/',
            {},
            format='json',
            HTTP_X_CSRFTOKEN=csrf.value,
        )
        self.assertEqual(response_ok.status_code, status.HTTP_200_OK)
        self.assertNotIn('access', response_ok.data)
        self.assertIn(ACCESS_COOKIE_NAME, response_ok.cookies)

    def test_bearer_alone_returns_401(self) -> None:
        """N1 — Bearer legacy ignoré"""
        refresh = RefreshToken.for_user(self.user)
        access = str(refresh.access_token)
        client = APIClient(enforce_csrf_checks=True)
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        response = client.get('/api/accounts/profile/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_bearer_ignored_when_cookie_present(self) -> None:
        """N2 — auth via cookie ; Bearer ignoré"""
        self._login()
        foreign = RefreshToken.for_user(self.user)
        # credentials() would apply on all requests ; set header without replacing cookies
        response = self.client.get(
            '/api/accounts/profile/',
            HTTP_AUTHORIZATION=f'Bearer {foreign.access_token}',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_refresh_from_cookie(self) -> None:
        """P5"""
        self._login()
        csrf = self.client.cookies.get('csrftoken')
        self.client.cookies.pop(ACCESS_COOKIE_NAME, None)
        response = self.client.post(
            '/api/accounts/auth/refresh/',
            {},
            format='json',
            HTTP_X_CSRFTOKEN=csrf.value,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn('access', response.data)
        self.assertIn(ACCESS_COOKIE_NAME, response.cookies)

    def test_refresh_body_only_returns_401(self) -> None:
        """N3 — body.refresh ignoré"""
        refresh = RefreshToken.for_user(self.user)
        client = APIClient(enforce_csrf_checks=True)
        client.get('/api/accounts/auth/csrf/')
        csrf = client.cookies.get('csrftoken')
        response = client.post(
            '/api/accounts/auth/refresh/',
            {'refresh': str(refresh)},
            format='json',
            HTTP_X_CSRFTOKEN=csrf.value,
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_clears_cookies(self) -> None:
        """P6"""
        self._login()
        csrf = self.client.cookies.get('csrftoken')
        response = self.client.post(
            '/api/accounts/auth/logout/',
            {},
            format='json',
            HTTP_X_CSRFTOKEN=csrf.value,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        access = response.cookies.get(ACCESS_COOKIE_NAME)
        self.assertIsNotNone(access)
        self.assertEqual(access.value, '')

    def test_logout_bearer_body_without_cookies_does_not_blacklist(self) -> None:
        """N4 — logout sans cookies ne blackliste pas ; Bearer seul reste inutilisable pour auth"""
        refresh = RefreshToken.for_user(self.user)
        access = str(refresh.access_token)
        refresh_str = str(refresh)

        client = APIClient(enforce_csrf_checks=True)
        client.get('/api/accounts/auth/csrf/')
        csrf = client.cookies.get('csrftoken')
        logout = client.post(
            '/api/accounts/auth/logout/',
            {'refresh': refresh_str},
            format='json',
            HTTP_AUTHORIZATION=f'Bearer {access}',
            HTTP_X_CSRFTOKEN=csrf.value,
        )
        self.assertEqual(logout.status_code, status.HTTP_200_OK)

        # Poser le même access en cookie : encore valide (pas blacklisté via Bearer path)
        cookie_client = APIClient(enforce_csrf_checks=True)
        cookie_client.cookies[ACCESS_COOKIE_NAME] = access
        still_ok = cookie_client.get('/api/accounts/profile/')
        self.assertEqual(still_ok.status_code, status.HTTP_200_OK)

        # Bearer seul : toujours 401
        bearer_client = APIClient(enforce_csrf_checks=True)
        bearer_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        bearer_denied = bearer_client.get('/api/accounts/profile/')
        self.assertEqual(bearer_denied.status_code, status.HTTP_401_UNAUTHORIZED)
