"""Tests consumer WebSocket market quotes."""
from django.test import TestCase, override_settings
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from accounts.jwt_blacklist_cache import clear_jti_blacklist_cache, mark_jti_blacklisted
from accounts.models import User
from integrations.consumers import (
    WS_ACCESS_TOKEN_SUBPROTOCOL_PREFIX,
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

    def test_extract_prefers_subprotocol_over_query(self) -> None:
        token = 'header.payload.sig'
        scope = {
            'subprotocols': [f'{WS_ACCESS_TOKEN_SUBPROTOCOL_PREFIX}{token}'],
            'query_string': b'token=query-token',
        }
        extracted, proto = _extract_ws_token(scope)
        self.assertEqual(extracted, token)
        self.assertEqual(proto, f'{WS_ACCESS_TOKEN_SUBPROTOCOL_PREFIX}{token}')

    def test_extract_falls_back_to_query_string(self) -> None:
        scope = {'subprotocols': [], 'query_string': b'token=legacy-token'}
        extracted, proto = _extract_ws_token(scope)
        self.assertEqual(extracted, 'legacy-token')
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
