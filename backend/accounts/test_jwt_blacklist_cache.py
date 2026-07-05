"""Cache Redis JWT blacklist : rejet + invalidation après logout."""
from __future__ import annotations

from django.core.cache import cache
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.jwt_blacklist_cache import (
    clear_jti_blacklist_cache,
    is_jti_blacklisted,
    mark_jti_blacklisted,
)
from accounts.models import User


class JwtBlacklistCacheTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='jwt-cache@example.com',
            username='jwt_cache',
            password='testpass123',
        )
        cache.clear()

    def test_mark_jti_blacklisted_sets_cache(self) -> None:
        refresh = RefreshToken.for_user(self.user)
        jti = refresh.access_token['jti']

        self.assertFalse(is_jti_blacklisted(jti))
        mark_jti_blacklisted(jti)
        self.assertTrue(is_jti_blacklisted(jti))

    def test_logout_blacklists_refresh_and_access(self) -> None:
        refresh = RefreshToken.for_user(self.user)
        access = str(refresh.access_token)
        refresh_str = str(refresh)

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        logout = self.client.post(
            '/api/accounts/auth/logout/',
            {'refresh': refresh_str},
            format='json',
        )
        self.assertIn(logout.status_code, (200, 204, 205))

        rejected = self.client.get('/api/accounts/preferences/')
        self.assertIn(rejected.status_code, (401, 403))

    def test_clear_cache_refreshes_from_db(self) -> None:
        refresh = RefreshToken.for_user(self.user)
        jti = refresh.access_token['jti']

        mark_jti_blacklisted(jti)
        self.assertTrue(is_jti_blacklisted(jti))

        clear_jti_blacklist_cache(jti)
        cache.delete(f'jwt_blacklist:jti:{jti}')
        self.assertFalse(is_jti_blacklisted(jti))
