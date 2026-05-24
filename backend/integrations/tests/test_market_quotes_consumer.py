"""Tests consumer WebSocket market quotes."""
from django.test import TestCase, override_settings
from rest_framework_simplejwt.tokens import AccessToken

from accounts.models import User


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
        access = AccessToken(token)
        self.assertEqual(int(access['user_id']), user.id)
