"""Tests des dates de version pour PositionStrategy."""
from django.contrib.auth import get_user_model
from django.test import TestCase

from trades.models import PositionStrategy

User = get_user_model()


class PositionStrategyVersionPublishedAtTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='version_dates_user',
            email='version_dates@example.com',
            password='testpass123',
        )
        self.strategy = PositionStrategy.objects.create(
            user=self.user,
            title='Breakout',
            status='active',
            is_current=True,
            strategy_content={'sections': [{'title': 'S1', 'rules': ['r1']}]},
        )

    def test_first_version_has_version_published_at(self):
        self.assertIsNotNone(self.strategy.version_published_at)

    def test_new_version_gets_distinct_version_published_at(self):
        first_published = self.strategy.version_published_at
        new_version = self.strategy.create_new_version(
            new_content={'sections': [{'title': 'S2', 'rules': ['r2']}]},
            version_notes='v2',
        )
        self.strategy.refresh_from_db()

        self.assertIsNotNone(new_version.version_published_at)
        self.assertNotEqual(new_version.version_published_at, first_published)
        self.assertEqual(new_version.version, 2)
