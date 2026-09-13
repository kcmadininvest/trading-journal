from datetime import datetime, timedelta, timezone as dt_tz
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import UserPreferences
from integrations.models import UserApiIntegration
from market_data.models import (
    HistoricalBar,
    HistoricalDownloadJob,
    HistoricalSyncSettings,
    HistoricalSyncTarget,
)
from market_data.services.sync_schedule import (
    BOOTSTRAP_LOOKBACK_DAYS,
    compute_sync_window,
    dispatch_due_historical_syncs,
    is_settings_due,
    run_sync_for_settings,
)

User = get_user_model()


class SyncScheduleWindowTests(TestCase):
    def test_bootstrap_when_no_bars(self):
        now = datetime(2026, 9, 13, 12, 0, tzinfo=dt_tz.utc)
        window = compute_sync_window(instrument='MES', timeframe='1m', now_utc=now)
        self.assertIsNotNone(window)
        start, end = window
        self.assertEqual(end, now)
        self.assertEqual(start, now - timedelta(days=BOOTSTRAP_LOOKBACK_DAYS))

    def test_gap_fill_from_last_bar(self):
        last = datetime(2026, 9, 12, 18, 0, tzinfo=dt_tz.utc)
        HistoricalBar.objects.create(
            instrument='MES',
            contract_id='CON.F.US.MES.U26',
            timeframe='1m',
            timestamp_utc=last,
            open=1,
            high=1,
            low=1,
            close=1,
            volume=1,
            ny_date=last.date(),
            ny_time=last.time(),
            fetched_at=last,
        )
        now = datetime(2026, 9, 13, 12, 0, tzinfo=dt_tz.utc)
        window = compute_sync_window(instrument='MES', timeframe='1m', now_utc=now)
        self.assertEqual(window[0], last + timedelta(seconds=1))
        self.assertEqual(window[1], now)

    def test_none_when_already_up_to_date(self):
        now = datetime(2026, 9, 13, 12, 0, tzinfo=dt_tz.utc)
        HistoricalBar.objects.create(
            instrument='MES',
            contract_id='CON.F.US.MES.U26',
            timeframe='1m',
            timestamp_utc=now,
            open=1,
            high=1,
            low=1,
            close=1,
            volume=1,
            ny_date=now.date(),
            ny_time=now.time().replace(tzinfo=None),
            fetched_at=now,
        )
        self.assertIsNone(compute_sync_window(instrument='MES', timeframe='1m', now_utc=now))


class SyncScheduleDueTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='syncuser', password='x')
        UserPreferences.objects.update_or_create(
            user=self.user,
            defaults={'timezone': 'Europe/Paris'},
        )
        self.settings = HistoricalSyncSettings.objects.create(
            user=self.user,
            enabled=True,
            hour=2,
            minute=0,
        )

    def test_due_inside_window(self):
        # 2026-09-13 02:05 Europe/Paris = 00:05 UTC (CEST UTC+2)
        now = datetime(2026, 9, 13, 0, 5, tzinfo=dt_tz.utc)
        self.assertTrue(is_settings_due(self.settings, now_utc=now))

    def test_not_due_outside_window(self):
        now = datetime(2026, 9, 13, 10, 0, tzinfo=dt_tz.utc)  # 12:00 Paris
        self.assertFalse(is_settings_due(self.settings, now_utc=now))

    def test_not_due_already_run_today(self):
        paris = ZoneInfo('Europe/Paris')
        local_today = datetime(2026, 9, 13, 2, 5, tzinfo=paris).date()
        self.settings.last_run_local_date = local_today
        self.settings.save(update_fields=['last_run_local_date'])
        now = datetime(2026, 9, 13, 0, 5, tzinfo=dt_tz.utc)
        self.assertFalse(is_settings_due(self.settings, now_utc=now))


class SyncEnqueueTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='enqueue', password='x')
        UserPreferences.objects.get_or_create(user=self.user, defaults={'timezone': 'Europe/Paris'})
        self.settings = HistoricalSyncSettings.objects.create(
            user=self.user,
            enabled=True,
            hour=2,
            minute=0,
        )
        HistoricalSyncTarget.objects.create(
            settings=self.settings,
            instrument='MES',
            timeframe='1m',
            contract_id='',
        )

    @patch('market_data.services.sync_schedule.dispatch_historical_download')
    def test_run_creates_scheduled_job(self, mock_dispatch):
        now = timezone.now()
        result = run_sync_for_settings(self.settings, force=True, now_utc=now)
        self.assertFalse(result['skipped'])
        self.assertEqual(len(result['jobs']), 1)
        job = result['jobs'][0]
        self.assertEqual(job.trigger, HistoricalDownloadJob.Trigger.MANUAL)
        mock_dispatch.assert_called_once_with(job.id)

    @patch('market_data.services.sync_schedule.dispatch_historical_download')
    def test_skip_when_active_job(self, mock_dispatch):
        HistoricalDownloadJob.objects.create(
            user=self.user,
            instrument='MES',
            timeframe='1m',
            start_utc=timezone.now() - timedelta(hours=1),
            end_utc=timezone.now(),
            status=HistoricalDownloadJob.Status.RUNNING,
        )
        result = run_sync_for_settings(self.settings, force=True)
        self.assertTrue(result['skipped'])
        self.assertEqual(result['reason'], 'active_job')
        mock_dispatch.assert_not_called()

    @patch('market_data.services.sync_schedule.dispatch_historical_download')
    def test_dispatch_due_enqueues(self, mock_dispatch):
        now = datetime(2026, 9, 13, 0, 5, tzinfo=dt_tz.utc)
        result = dispatch_due_historical_syncs(now_utc=now)
        self.assertEqual(result['ran'], 1)
        self.assertTrue(HistoricalDownloadJob.objects.filter(user=self.user).exists())
        mock_dispatch.assert_called()

    @patch('market_data.services.sync_schedule.dispatch_due_historical_syncs')
    def test_management_command(self, mock_dispatch):
        mock_dispatch.return_value = {'ran': 0, 'skipped_not_due': 1, 'details': []}
        call_command('run_historical_sync_tick')
        mock_dispatch.assert_called_once()


class SyncSettingsApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='syncapi', password='x')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        UserApiIntegration.objects.create(
            user=self.user,
            provider='topstepx',
            external_username='demo',
            is_connected=True,
        )
        UserPreferences.objects.get_or_create(user=self.user)

    def test_get_creates_defaults(self):
        res = self.client.get('/api/market-data/sync-settings/')
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertFalse(body['enabled'])
        self.assertEqual(body['hour'], 2)
        self.assertEqual(body['targets'], [])

    def test_put_targets_and_validation(self):
        res = self.client.put(
            '/api/market-data/sync-settings/',
            {
                'enabled': True,
                'hour': 3,
                'minute': 15,
                'targets': [
                    {'instrument': 'mes', 'timeframe': '5m', 'contract_id': ''},
                ],
            },
            format='json',
        )
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body['enabled'])
        self.assertEqual(body['hour'], 3)
        self.assertEqual(body['targets'][0]['instrument'], 'MES')
        self.assertEqual(body['targets'][0]['timeframe'], '5m')

        bad = self.client.put(
            '/api/market-data/sync-settings/',
            {
                'enabled': True,
                'hour': 3,
                'minute': 0,
                'targets': [{'instrument': 'MES', 'timeframe': '1d'}],
            },
            format='json',
        )
        self.assertEqual(bad.status_code, 400)

    @patch('market_data.views.run_sync_for_settings')
    def test_run_now(self, mock_run):
        settings_obj = HistoricalSyncSettings.objects.create(user=self.user, enabled=True)
        HistoricalSyncTarget.objects.create(
            settings=settings_obj,
            instrument='MES',
            timeframe='1m',
        )
        job = HistoricalDownloadJob(
            user=self.user,
            instrument='MES',
            timeframe='1m',
            start_utc=timezone.now() - timedelta(days=1),
            end_utc=timezone.now(),
            status=HistoricalDownloadJob.Status.PENDING,
        )
        job.save()
        mock_run.return_value = {'skipped': False, 'jobs': [job], 'job_ids': [job.id], 'errors': []}

        res = self.client.post('/api/market-data/sync-settings/run-now/', {}, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(len(res.json()['jobs']), 1)
        mock_run.assert_called_once()
