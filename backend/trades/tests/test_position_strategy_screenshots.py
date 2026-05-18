"""Tests normalisation des URLs screenshot pour PositionStrategy."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from trades.models import PositionStrategy
from trades.protected_screenshot_urls import sign_screenshot_media_token
from trades.serializers import PositionStrategyUpdateSerializer

User = get_user_model()


class PositionStrategyScreenshotNormalizationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='ps_user',
            email='ps@example.com',
            password='testpass123',
        )
        self.strategy = PositionStrategy.objects.create(
            user=self.user,
            title='Test',
            status='active',
            is_current=True,
            strategy_content={'sections': [{'title': 'S1', 'rules': ['r1']}]},
            example_screenshot='/media/screenshots/1/old.webp',
        )
        self.factory = APIRequestFactory()

    def test_update_normalizes_signed_screenshot_url(self):
        rel = f'screenshots/{self.user.pk}/2026/03/test_thumb.webp'
        token = sign_screenshot_media_token(rel, self.user.pk)
        signed = f'/api/trades/protected-screenshot/?s={token}'
        request = self.factory.patch(
            f'/api/trades/position-strategies/{self.strategy.pk}/',
            {'example_screenshot': signed},
            format='json',
        )
        force_authenticate(request, user=self.user)
        serializer = PositionStrategyUpdateSerializer(
            self.strategy,
            data={'example_screenshot': signed},
            partial=True,
            context={'request': request},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(
            serializer.validated_data['example_screenshot'],
            f'/media/{rel}',
        )
