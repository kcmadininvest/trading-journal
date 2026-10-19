"""Tests consumer WebSocket market quotes (cookie tj_access only)."""
from django.test import TestCase, override_settings
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from accounts.jwt_blacklist_cache import clear_jti_blacklist_cache, mark_jti_blacklisted
from accounts.jwt_cookies import ACCESS_COOKIE_NAME
from accounts.models import User
from integrations.consumers import (
    _extract_ws_token,
    _resolve_user_from_token_sync,
)


@override_settings(
    CHANNEL_LAYERS={'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'}},
)
class MarketQuotesConsumerAuthTests(TestCase):
    def test_jwt_resolves_user_id(self) -> None:
        user = User.objects.create_user(
            username='ws_user',
            email='ws@example.com',
            password='testpass123',
        )
        token = str(AccessToken.for_user(user))
        resolved = _resolve_user_from_token_sync(token)
        self.assertEqual(resolved.id, user.id)

    def test_extract_cookie_only(self) -> None:
        """W1 — cookie tj_access"""
        scope = {
            'subprotocols': [],
            'query_string': b'',
            'headers': [(b'cookie', f'{ACCESS_COOKIE_NAME}=cookie-jwt'.encode())],
        }
        extracted, proto = _extract_ws_token(scope)
        self.assertEqual(extracted, 'cookie-jwt')
        self.assertIsNone(proto)

    def test_extract_ignores_query_string(self) -> None:
        """W2 — ?token= seul → None (close 4401 côté connect)"""
        scope = {'subprotocols': [], 'query_string': b'token=legacy-token', 'headers': []}
        extracted, proto = _extract_ws_token(scope)
        self.assertIsNone(extracted)
        self.assertIsNone(proto)

    def test_extract_ignores_subprotocol(self) -> None:
        """W3 — subprotocol access_token.* seul → None"""
        scope = {
            'subprotocols': ['access_token.header.payload.sig'],
            'query_string': b'',
            'headers': [],
        }
        extracted, proto = _extract_ws_token(scope)
        self.assertIsNone(extracted)
        self.assertIsNone(proto)

    def test_extract_ignores_query_even_with_cookie_absent(self) -> None:
        scope = {
            'subprotocols': ['access_token.other'],
            'query_string': b'token=legacy-token',
            'headers': [],
        }
        extracted, proto = _extract_ws_token(scope)
        self.assertIsNone(extracted)
        self.assertIsNone(proto)

    def test_blacklisted_access_token_rejected(self) -> None:
        user = User.objects.create_user(
            username='ws_bl',
            email='ws_bl@example.com',
            password='testpass123',
        )
        access = AccessToken.for_user(user)
        jti = str(access['jti'])
        mark_jti_blacklisted(jti)
        try:
            with self.assertRaises(TokenError):
                _resolve_user_from_token_sync(str(access))
        finally:
            clear_jti_blacklist_cache(jti)
