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
    HistoricalSyncRun,
    HistoricalSyncSchedulerState,
    HistoricalSyncSettings,
    HistoricalSyncTarget,
    SyncRunStatus,
)
from market_data.services.sync_schedule import (
    BOOTSTRAP_LOOKBACK_DAYS,
    SCHEDULER_STALE_MINUTES,
    compute_sync_window,
    dispatch_due_historical_syncs,
    finalize_sync_status_for_job,
    is_settings_due,
    run_sync_for_settings,
    scheduler_is_healthy,
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
        mock_dispatch.assert_called_once_with(job.id, allow_inline=False)

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
    def test_run_opens_running_sync_run(self, mock_dispatch):
        result = run_sync_for_settings(self.settings, force=True)
        job = result['jobs'][0]

        run = HistoricalSyncRun.objects.get(user=self.user)
        self.assertEqual(run.status, SyncRunStatus.RUNNING)
        self.assertEqual(run.job_ids, [job.id])
        self.assertEqual(run.trigger, HistoricalDownloadJob.Trigger.MANUAL)
        self.assertIsNone(run.finished_at)

        self.settings.refresh_from_db()
        self.assertEqual(self.settings.last_status, SyncRunStatus.RUNNING)
        self.assertEqual(self.settings.last_sync_job_ids, [job.id])
        self.assertIsNotNone(self.settings.last_run_at)
        self.assertIsNone(self.settings.last_finished_at)
        self.assertEqual(self.settings.last_error, '')
        mock_dispatch.assert_called_once_with(job.id, allow_inline=False)

    @patch('market_data.services.sync_schedule.dispatch_historical_download')
    def test_run_up_to_date_when_nothing_to_fetch(self, mock_dispatch):
        now = timezone.now()
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
        result = run_sync_for_settings(self.settings, force=True, now_utc=now)
        self.assertEqual(result['jobs'], [])
        mock_dispatch.assert_not_called()

        run = HistoricalSyncRun.objects.get(user=self.user)
        self.assertEqual(run.status, SyncRunStatus.UP_TO_DATE)
        self.assertIsNotNone(run.finished_at)
        self.assertEqual(run.error, '')

        self.settings.refresh_from_db()
        self.assertEqual(self.settings.last_status, SyncRunStatus.UP_TO_DATE)
        self.assertEqual(self.settings.last_error, '')
        self.assertIsNotNone(self.settings.last_finished_at)

    @patch('market_data.services.sync_schedule.dispatch_historical_download')
    def test_run_without_targets_is_error(self, mock_dispatch):
        self.settings.targets.all().delete()
        result = run_sync_for_settings(self.settings, force=True)
        self.assertEqual(result['reason'], 'no_targets')
        mock_dispatch.assert_not_called()

        run = HistoricalSyncRun.objects.get(user=self.user)
        self.assertEqual(run.status, SyncRunStatus.ERROR)
        self.settings.refresh_from_db()
        self.assertEqual(self.settings.last_status, SyncRunStatus.ERROR)
        self.assertIn('Aucune cible', self.settings.last_error)

    @patch('market_data.services.sync_schedule.dispatch_historical_download')
    def test_dispatch_due_enqueues(self, mock_dispatch):
        now = datetime(2026, 9, 13, 0, 5, tzinfo=dt_tz.utc)
        result = dispatch_due_historical_syncs(now_utc=now)
        self.assertEqual(result['ran'], 1)
        self.assertTrue(HistoricalDownloadJob.objects.filter(user=self.user).exists())
        mock_dispatch.assert_called()

    @patch('market_data.services.sync_schedule.dispatch_historical_download')
    def test_tick_runs_downloads_inline(self, mock_dispatch):
        # Processus oneshot : un thread daemon serait tué avant la fin du job.
        now = datetime(2026, 9, 13, 0, 5, tzinfo=dt_tz.utc)
        dispatch_due_historical_syncs(now_utc=now)
        self.assertTrue(mock_dispatch.call_args.kwargs['allow_inline'])

    @patch('market_data.services.sync_schedule.dispatch_historical_download')
    def test_run_now_keeps_background_dispatch(self, mock_dispatch):
        run_sync_for_settings(self.settings, force=True)
        self.assertFalse(mock_dispatch.call_args.kwargs['allow_inline'])

    @patch('market_data.services.sync_schedule.dispatch_historical_download')
    def test_tick_records_heartbeat(self, mock_dispatch):
        now = datetime(2026, 9, 13, 10, 0, tzinfo=dt_tz.utc)  # hors fenêtre
        dispatch_due_historical_syncs(now_utc=now)

        state = HistoricalSyncSchedulerState.objects.get(
            pk=HistoricalSyncSchedulerState.SINGLETON_PK,
        )
        self.assertIsNotNone(state.last_tick_at)
        self.assertEqual(state.last_tick_ran, 0)
        self.assertEqual(state.last_tick_not_due, 1)
        self.assertTrue(scheduler_is_healthy(state))

    def test_scheduler_health_thresholds(self):
        self.assertFalse(scheduler_is_healthy(None))
        state = HistoricalSyncSchedulerState.load()
        self.assertFalse(scheduler_is_healthy(state))
        state.last_tick_at = timezone.now() - timedelta(minutes=SCHEDULER_STALE_MINUTES + 5)
        self.assertFalse(scheduler_is_healthy(state))
        state.last_tick_at = timezone.now()
        self.assertTrue(scheduler_is_healthy(state))


class SyncRunFinalizeTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='finalize', password='x')
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
        )

    def _open_run(self) -> HistoricalDownloadJob:
        with patch('market_data.services.sync_schedule.dispatch_historical_download'):
            result = run_sync_for_settings(self.settings, force=True)
        return result['jobs'][0]

    def _complete(self, job, *, bars: int, error: str = ''):
        job.status = HistoricalDownloadJob.Status.COMPLETED
        job.bars_fetched = bars
        job.error = error
        job.finished_at = timezone.now()
        job.save()
        return job

    def test_success_when_bars_fetched(self):
        job = self._complete(self._open_run(), bars=120)
        run = finalize_sync_status_for_job(job)

        self.assertEqual(run.status, SyncRunStatus.SUCCESS)
        self.assertEqual(run.bars_fetched_total, 120)
        self.assertEqual(run.error, '')
        self.assertIsNotNone(run.finished_at)

        self.settings.refresh_from_db()
        self.assertEqual(self.settings.last_status, SyncRunStatus.SUCCESS)
        self.assertEqual(self.settings.last_error, '')
        self.assertIsNotNone(self.settings.last_finished_at)

    def test_success_when_completed_without_bars(self):
        """Réponse vide du fournisseur = empty, pas une panne → success."""
        job = self._complete(self._open_run(), bars=0, error='Aucune bougie reçue.')
        run = finalize_sync_status_for_job(job)

        self.assertEqual(run.status, SyncRunStatus.SUCCESS)
        self.assertEqual(run.error, '')
        self.settings.refresh_from_db()
        self.assertEqual(self.settings.last_status, SyncRunStatus.SUCCESS)
        self.assertEqual(self.settings.last_error, '')

    def test_error_when_job_failed(self):
        job = self._open_run()
        job.status = HistoricalDownloadJob.Status.FAILED
        job.error = 'Token expiré'
        job.finished_at = timezone.now()
        job.save()

        run = finalize_sync_status_for_job(job)
        self.assertEqual(run.status, SyncRunStatus.ERROR)
        self.assertIn('Token expiré', run.error)

    def test_partial_when_mix_ok_and_failed(self):
        ok_job = self._complete(self._open_run(), bars=50)
        run = HistoricalSyncRun.objects.get(user=self.user)
        failed = HistoricalDownloadJob.objects.create(
            user=self.user,
            instrument='GC',
            timeframe='1m',
            start_utc=timezone.now() - timedelta(hours=1),
            end_utc=timezone.now(),
            status=HistoricalDownloadJob.Status.FAILED,
            error='Compte TopStepX introuvable (ID invalide).',
            finished_at=timezone.now(),
        )
        empty = HistoricalDownloadJob.objects.create(
            user=self.user,
            instrument='MNQ',
            timeframe='15m',
            start_utc=timezone.now() - timedelta(hours=1),
            end_utc=timezone.now(),
            status=HistoricalDownloadJob.Status.COMPLETED,
            bars_fetched=0,
            error='Aucune bougie reçue.',
            finished_at=timezone.now(),
        )
        run.job_ids = [ok_job.id, failed.id, empty.id]
        run.save(update_fields=['job_ids'])

        concluded = finalize_sync_status_for_job(failed)
        self.assertEqual(concluded.status, SyncRunStatus.PARTIAL)
        self.assertEqual(concluded.bars_fetched_total, 50)
        self.assertIn('GC/1m', concluded.error)
        self.assertIn('ID invalide', concluded.error)
        self.assertNotIn('MNQ', concluded.error)
        self.settings.refresh_from_db()
        self.assertEqual(self.settings.last_status, SyncRunStatus.PARTIAL)

    def test_all_empty_is_success(self):
        job = self._complete(self._open_run(), bars=0)
        run = HistoricalSyncRun.objects.get(user=self.user)
        other = HistoricalDownloadJob.objects.create(
            user=self.user,
            instrument='MNQ',
            timeframe='1m',
            start_utc=timezone.now() - timedelta(hours=1),
            end_utc=timezone.now(),
            status=HistoricalDownloadJob.Status.COMPLETED,
            bars_fetched=0,
            finished_at=timezone.now(),
        )
        run.job_ids = [job.id, other.id]
        run.save(update_fields=['job_ids'])

        concluded = finalize_sync_status_for_job(other)
        self.assertEqual(concluded.status, SyncRunStatus.SUCCESS)
        self.assertEqual(concluded.error, '')

    def test_no_conclusion_while_another_job_runs(self):
        job = self._complete(self._open_run(), bars=50)
        run = HistoricalSyncRun.objects.get(user=self.user)
        pending = HistoricalDownloadJob.objects.create(
            user=self.user,
            instrument='MES',
            timeframe='5m',
            start_utc=timezone.now() - timedelta(hours=1),
            end_utc=timezone.now(),
            status=HistoricalDownloadJob.Status.PENDING,
        )
        run.job_ids = [job.id, pending.id]
        run.save(update_fields=['job_ids'])

        self.assertIsNone(finalize_sync_status_for_job(job))
        run.refresh_from_db()
        self.assertEqual(run.status, SyncRunStatus.RUNNING)

        self._complete(pending, bars=10)
        concluded = finalize_sync_status_for_job(pending)
        self.assertEqual(concluded.status, SyncRunStatus.SUCCESS)
        self.assertEqual(concluded.bars_fetched_total, 60)

    def test_second_conclusion_is_noop(self):
        job = self._complete(self._open_run(), bars=10)
        self.assertIsNotNone(finalize_sync_status_for_job(job))
        self.assertIsNone(finalize_sync_status_for_job(job))

    def test_job_outside_any_run_is_ignored(self):
        orphan = HistoricalDownloadJob.objects.create(
            user=self.user,
            instrument='MES',
            timeframe='1m',
            start_utc=timezone.now() - timedelta(hours=1),
            end_utc=timezone.now(),
            status=HistoricalDownloadJob.Status.COMPLETED,
            bars_fetched=5,
        )
        self.assertIsNone(finalize_sync_status_for_job(orphan))

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
                'targets': [{'instrument': 'MES', 'timeframe': '1w'}],
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

    def test_settings_expose_status_fields(self):
        body = self.client.get('/api/market-data/sync-settings/').json()
        self.assertEqual(body['last_status'], '')
        self.assertIsNone(body['last_finished_at'])

    def test_sync_runs_list(self):
        other = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='x',
        )
        HistoricalSyncRun.objects.create(user=other, status=SyncRunStatus.SUCCESS)
        older = HistoricalSyncRun.objects.create(
            user=self.user,
            status=SyncRunStatus.ERROR,
            started_at=timezone.now() - timedelta(hours=2),
            finished_at=timezone.now() - timedelta(hours=2),
            error='boom',
        )
        latest = HistoricalSyncRun.objects.create(
            user=self.user,
            status=SyncRunStatus.SUCCESS,
            bars_fetched_total=42,
            finished_at=timezone.now(),
        )

        res = self.client.get('/api/market-data/sync-runs/')
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual([r['id'] for r in body], [latest.id, older.id])
        self.assertEqual(body[0]['bars_fetched_total'], 42)

        limited = self.client.get('/api/market-data/sync-runs/?limit=1').json()
        self.assertEqual(len(limited), 1)

    def test_sync_runs_expose_per_target_detail(self):
        job = HistoricalDownloadJob.objects.create(
            user=self.user,
            instrument='MES',
            timeframe='1m',
            start_utc=timezone.now() - timedelta(hours=1),
            end_utc=timezone.now(),
            status=HistoricalDownloadJob.Status.FAILED,
            error='Téléchargement abandonné',
        )
        HistoricalSyncRun.objects.create(
            user=self.user,
            status=SyncRunStatus.ERROR,
            job_ids=[job.id, 999999],
            finished_at=timezone.now(),
        )

        body = self.client.get('/api/market-data/sync-runs/').json()
        jobs = body[0]['jobs']
        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0]['instrument'], 'MES')
        self.assertEqual(jobs[0]['status'], 'failed')
        self.assertEqual(jobs[0]['error'], 'Téléchargement abandonné')

    @patch('market_data.views.celery_workers_available', return_value=False)
    def test_sync_health(self, _mock_celery):
        res = self.client.get('/api/market-data/sync-health/')
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertIsNone(body['scheduler_last_tick_at'])
        self.assertFalse(body['scheduler_ok'])
        self.assertFalse(body['celery_workers_available'])
        self.assertEqual(body['download_dispatch_mode'], 'inline')
        self.assertEqual(body['scheduler_stale_after_minutes'], SCHEDULER_STALE_MINUTES)

        HistoricalSyncSchedulerState.objects.update_or_create(
            pk=HistoricalSyncSchedulerState.SINGLETON_PK,
            defaults={'last_tick_at': timezone.now()},
        )
        healthy = self.client.get('/api/market-data/sync-health/').json()
        self.assertTrue(healthy['scheduler_ok'])
