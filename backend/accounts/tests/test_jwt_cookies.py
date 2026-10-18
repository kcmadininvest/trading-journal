"""Tests auth JWT via cookies HttpOnly."""
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.jwt_cookies import ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME
from accounts.models import User


@override_settings(DEBUG=True)
class JwtCookieAuthTests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient(enforce_csrf_checks=True)
        self.user = User.objects.create_user(
            email='cookie-user@example.com',
            username='cookie_user',
            password='CookiePass123!',
        )

    def _login(self):
        # CSRF cookie
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
        self._login()
        response = self.client.get('/api/accounts/profile/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_cookie_auth_mutation_requires_csrf(self) -> None:
        self._login()
        # Sans header CSRF → 403
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

    def test_bearer_legacy_still_works_without_csrf(self) -> None:
        refresh = RefreshToken.for_user(self.user)
        access = str(refresh.access_token)
        client = APIClient(enforce_csrf_checks=True)
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        response = client.get('/api/accounts/profile/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_refresh_from_cookie(self) -> None:
        self._login()
        csrf = self.client.cookies.get('csrftoken')
        # Effacer access pour forcer refresh
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

    def test_logout_clears_cookies(self) -> None:
        self._login()
        csrf = self.client.cookies.get('csrftoken')
        response = self.client.post(
            '/api/accounts/auth/logout/',
            {},
            format='json',
            HTTP_X_CSRFTOKEN=csrf.value,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # delete_cookie set max-age=0
        access = response.cookies.get(ACCESS_COOKIE_NAME)
        self.assertIsNotNone(access)
        self.assertEqual(access.value, '')
