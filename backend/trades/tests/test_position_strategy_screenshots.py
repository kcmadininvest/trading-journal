"""Tests normalisation et suppression des URLs screenshot pour PositionStrategy."""
import os
import shutil
import time
from datetime import date, timedelta
from io import StringIO
from pathlib import Path
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APIRequestFactory, force_authenticate

from backtest_journal.models import (
    ManualBacktestCampaign,
    ManualBacktestObservation,
    ManualBacktestStrategy,
    ManualBacktestVersion,
)
from billing.models import CustomerSubscription
from trades.models import PositionStrategy
from trades.protected_screenshot_urls import sign_screenshot_media_token
from trades.serializers import (
    PositionStrategyCreateSerializer,
    PositionStrategyUpdateSerializer,
)

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

    def test_create_normalizes_signed_screenshot_url(self):
        """Duplication : le formulaire renvoie des URLs signées (>200 car.)."""
        # Chemin long comme en prod (uuid + date) pour dépasser max_length=200 du URLField modèle
        long_name = '20260329_192904_1aebd76ca69e42d1885c40500346bf15.webp'
        rel = f'screenshots/{self.user.pk}/2026/03/{long_name}'
        thumb_rel = f'screenshots/{self.user.pk}/2026/03/{long_name.replace(".webp", "_thumb.webp")}'
        signed = f'/api/trades/protected-screenshot/?s={sign_screenshot_media_token(rel, self.user.pk)}'
        signed_thumb = (
            f'/api/trades/protected-screenshot/?s='
            f'{sign_screenshot_media_token(thumb_rel, self.user.pk)}'
        )
        self.assertGreater(len(signed), 200)

        request = self.factory.post('/api/trades/position-strategies/')
        force_authenticate(request, user=self.user)
        serializer = PositionStrategyCreateSerializer(
            data={
                'title': 'Test (Copie)',
                'status': 'draft',
                'strategy_content': {'sections': [{'title': 'S1', 'rules': ['r1']}]},
                'example_screenshot': signed,
                'example_screenshot_thumbnail': signed_thumb,
            },
            context={'request': request},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['example_screenshot'], f'/media/{rel}')
        self.assertEqual(
            serializer.validated_data['example_screenshot_thumbnail'],
            f'/media/{thumb_rel}',
        )


class PositionStrategyDeleteScreenshotGuardTests(TestCase):
    """delete_screenshot ne doit pas effacer un fichier encore référencé."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='ps_del_user',
            email='ps_del@example.com',
            password='testpass123',
        )
        CustomerSubscription.objects.create(
            user=self.user,
            stripe_customer_id='cus_ps_del_test',
            stripe_subscription_id='sub_ps_del_test',
            stripe_price_id='price_test',
            status=CustomerSubscription.STATUS_ACTIVE,
            is_current=True,
            current_period_end=timezone.now() + timedelta(days=30),
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.url = reverse('trades:position-strategy-delete-screenshot')

        self.rel = f'screenshots/{self.user.pk}/2026/03/shared.webp'
        self.canonical = f'/media/{self.rel}'
        self.thumb_rel = f'screenshots/{self.user.pk}/2026/03/shared_thumb.webp'
        self.thumb_canonical = f'/media/{self.thumb_rel}'

        media_root = Path(settings.MEDIA_ROOT)
        self.original_path = media_root / self.rel
        self.thumb_path = media_root / self.thumb_rel
        self.original_path.parent.mkdir(parents=True, exist_ok=True)
        self.original_path.write_bytes(b'fake-webp')
        self.thumb_path.write_bytes(b'fake-thumb')

    def tearDown(self):
        for path in (self.original_path, self.thumb_path):
            if path.exists():
                path.unlink()

    def test_shared_screenshot_is_kept(self):
        PositionStrategy.objects.create(
            user=self.user,
            title='Originale',
            status='active',
            is_current=True,
            strategy_content={'sections': []},
            example_screenshot=self.canonical,
            example_screenshot_thumbnail=self.thumb_canonical,
        )
        PositionStrategy.objects.create(
            user=self.user,
            title='Copie',
            status='draft',
            is_current=True,
            strategy_content={'sections': []},
            example_screenshot=self.canonical,
            example_screenshot_thumbnail=self.thumb_canonical,
        )

        with patch('trades.image_processor.image_processor.delete_screenshot') as mock_delete:
            response = self.client.post(
                self.url,
                {'screenshot_url': self.canonical},
                format='json',
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get('kept'))
        mock_delete.assert_not_called()
        self.assertTrue(self.original_path.exists())
        self.assertTrue(self.thumb_path.exists())

    def test_unreferenced_screenshot_is_deleted(self):
        response = self.client.post(
            self.url,
            {'screenshot_url': self.canonical},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn('kept', response.data)
        self.assertFalse(self.original_path.exists())
        self.assertFalse(self.thumb_path.exists())

    def test_deleting_copy_keeps_original_file(self):
        original = PositionStrategy.objects.create(
            user=self.user,
            title='Originale',
            status='active',
            is_current=True,
            strategy_content={'sections': []},
            example_screenshot=self.canonical,
            example_screenshot_thumbnail=self.thumb_canonical,
        )
        copy = PositionStrategy.objects.create(
            user=self.user,
            title='Copie',
            status='draft',
            is_current=True,
            strategy_content={'sections': []},
            example_screenshot=self.canonical,
            example_screenshot_thumbnail=self.thumb_canonical,
        )

        response = self.client.post(
            self.url,
            {'screenshot_url': self.canonical},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get('kept'))

        copy.delete()
        original.refresh_from_db()
        self.assertEqual(original.example_screenshot, self.canonical)
        self.assertTrue(self.original_path.exists())
        self.assertTrue(self.thumb_path.exists())


class CleanupOrphanScreenshotsCommandTests(TestCase):
    """cleanup_orphan_screenshots ne doit supprimer que les vrais orphelins anciens."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='cleanup_user',
            email='cleanup@example.com',
            password='testpass123',
        )
        self.user_dir = Path(settings.MEDIA_ROOT) / 'screenshots' / str(self.user.pk)
        self.base_rel = f'screenshots/{self.user.pk}/2026/01'
        (Path(settings.MEDIA_ROOT) / self.base_rel).mkdir(parents=True, exist_ok=True)

    def tearDown(self):
        shutil.rmtree(self.user_dir, ignore_errors=True)

    def _make_file(self, name: str, age_days: float = 30) -> Path:
        path = Path(settings.MEDIA_ROOT) / self.base_rel / name
        path.write_bytes(b'fake-webp')
        ts = time.time() - age_days * 86400
        os.utime(path, (ts, ts))
        return path

    def _run(self, *extra: str) -> str:
        out = StringIO()
        # --user-id obligatoire : MEDIA_ROOT est le vrai dossier media en test.
        call_command('cleanup_orphan_screenshots', '--user-id', str(self.user.pk), *extra, stdout=out)
        return out.getvalue()

    def _make_observation(self, **fields) -> ManualBacktestObservation:
        strategy = ManualBacktestStrategy.objects.create(user=self.user, name='BT')
        version = ManualBacktestVersion.objects.create(strategy=strategy, version=1)
        campaign = ManualBacktestCampaign.objects.create(
            user=self.user,
            strategy_version=version,
            name='Campagne',
            instrument='NQ',
            period_start=date(2026, 1, 1),
            period_end=date(2026, 1, 31),
        )
        return ManualBacktestObservation.objects.create(
            campaign=campaign,
            user=self.user,
            market_datetime=timezone.now(),
            direction='LONG',
            **fields,
        )

    def test_referenced_files_are_kept(self):
        strat_original = self._make_file('strat.webp')
        strat_thumb = self._make_file('strat_thumb.webp')
        bt_before = self._make_file('bt_before.webp')
        bt_before_thumb = self._make_file('bt_before_thumb.webp')
        bt_after = self._make_file('bt_after.webp')

        PositionStrategy.objects.create(
            user=self.user,
            title='Strat',
            status='active',
            is_current=True,
            strategy_content={'sections': []},
            example_screenshot=f'/media/{self.base_rel}/strat.webp',
            example_screenshot_thumbnail=f'/media/{self.base_rel}/strat_thumb.webp',
        )
        signed_after = (
            '/api/trades/protected-screenshot/?s='
            + sign_screenshot_media_token(f'{self.base_rel}/bt_after.webp', self.user.pk)
        )
        self._make_observation(
            screenshot_before_url=f'/media/{self.base_rel}/bt_before.webp',
            screenshot_after_url=signed_after,
        )

        self._run()

        for path in (strat_original, strat_thumb, bt_before, bt_before_thumb, bt_after):
            self.assertTrue(path.exists(), f'{path.name} ne doit pas être supprimé')

    def test_old_orphan_is_deleted(self):
        orphan = self._make_file('orphan.webp', age_days=30)
        orphan_thumb = self._make_file('orphan_thumb.webp', age_days=30)

        self._run()

        self.assertFalse(orphan.exists())
        self.assertFalse(orphan_thumb.exists())

    def test_recent_orphan_is_kept(self):
        recent = self._make_file('recent.webp', age_days=1)

        self._run()

        self.assertTrue(recent.exists())

    def test_min_age_days_zero_deletes_recent_orphan(self):
        recent = self._make_file('recent_zero.webp', age_days=0.01)

        self._run('--min-age-days', '0')

        self.assertFalse(recent.exists())

    def test_dry_run_deletes_nothing(self):
        orphan = self._make_file('dry.webp', age_days=30)

        output = self._run('--dry-run')

        self.assertTrue(orphan.exists())
        self.assertIn('DRY-RUN', output)
