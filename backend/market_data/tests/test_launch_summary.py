"""Tests API / service : une ligne par lancement manuel."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone as dt_tz
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from integrations.models import UserApiIntegration
from market_data.models import (
    BarCoverage,
    BarQualityIssue,
    HistoricalDownloadJob,
)
from market_data.services.launch_summary import (
    list_manual_launch_coverage,
)

User = get_user_model()


class LaunchSummaryApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='launchuser', password='x')
        self.other = User.objects.create_user(
            username='otherlaunch',
            email='otherlaunch@example.com',
            password='x',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        UserApiIntegration.objects.create(
            user=self.user,
            provider='topstepx',
            external_username='demo',
            is_connected=True,
        )
        self.now = timezone.now()
        self.start = datetime(2025, 3, 10, tzinfo=dt_tz.utc)
        self.end = datetime(2025, 3, 12, tzinfo=dt_tz.utc)
        self.batch = uuid.uuid4()

    def _make_job(self, **kwargs):
        defaults = {
            'user': self.user,
            'instrument': 'NQ',
            'contract_id': 'CON.F.US.ENQ.H25',
            'timeframe': '1m',
            'requested_timeframes': ['1m'],
            'trigger': HistoricalDownloadJob.Trigger.MANUAL,
            'batch_id': self.batch,
            'start_utc': self.start,
            'end_utc': self.end,
            'status': HistoricalDownloadJob.Status.COMPLETED,
        }
        defaults.update(kwargs)
        return HistoricalDownloadJob.objects.create(**defaults)

    def _make_coverage(self, *, start, end, stored=60, expected=60, missing=0, status='complete', **kwargs):
        defaults = {
            'user': self.user,
            'instrument': 'NQ',
            'contract_id': 'CON.F.US.ENQ.H25',
            'timeframe': '1m',
            'start_utc': start,
            'end_utc': end,
            'bars_stored': stored,
            'bars_expected': expected,
            'unexpected_missing_count': missing,
            'status': status,
            'source': 'topstepx_sim',
            'fetched_at': self.now,
        }
        defaults.update(kwargs)
        return BarCoverage.objects.create(**defaults)

    def test_coverage_empty_shape(self):
        res = self.client.get('/api/market-data/coverage/')
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body['launches'], [])
        self.assertEqual(body['totals']['bars_stored'], 0)

    def test_one_row_per_manual_batch_with_daily_coverages(self):
        self._make_job()
        day1 = self.start
        day2 = self.start + timedelta(days=1)
        self._make_coverage(start=day1, end=day2, stored=50, expected=60, missing=10, status='partial')
        self._make_coverage(
            start=day2,
            end=self.end,
            stored=60,
            expected=60,
            missing=0,
            status='complete',
        )
        # Anomalies unitaires (dont gaps exclus du compte)
        job = HistoricalDownloadJob.objects.get(batch_id=self.batch)
        BarQualityIssue.objects.create(
            job=job,
            issue_type='gap',
            severity='warning',
            instrument='NQ',
            contract_id='CON.F.US.ENQ.H25',
            timeframe='1m',
        )
        BarQualityIssue.objects.create(
            job=job,
            issue_type='ohlc_inconsistent',
            severity='error',
            instrument='NQ',
            contract_id='CON.F.US.ENQ.H25',
            timeframe='1m',
        )
        BarQualityIssue.objects.create(
            job=job,
            issue_type='duplicate',
            severity='warning',
            instrument='NQ',
            contract_id='CON.F.US.ENQ.H25',
            timeframe='1m',
        )

        cov = self.client.get('/api/market-data/coverage/?instrument=NQ').json()
        self.assertEqual(len(cov['launches']), 1)
        row = cov['launches'][0]
        self.assertEqual(row['batch_id'], str(self.batch))
        self.assertEqual(row['bars_stored'], 110)
        self.assertEqual(row['bars_expected'], 120)
        self.assertEqual(row['unexpected_missing_count'], 10)
        self.assertEqual(row['coverage_status'], 'partial')
        self.assertEqual(cov['totals']['bars_stored'], 110)
        self.assertEqual(row['issue_total'], 2)
        self.assertEqual(row['issue_counts'].get('ohlc_inconsistent'), 1)
        self.assertEqual(row['issue_counts'].get('duplicate'), 1)
        self.assertNotIn('gap', row['issue_counts'])
        self.assertEqual(row['max_severity'], 'error')

    def test_multi_job_batch_single_row(self):
        """Deux timeframes sans profil → un batch, une ligne."""
        batch = uuid.uuid4()
        self._make_job(batch_id=batch, timeframe='1m', requested_timeframes=['1m'])
        self._make_job(batch_id=batch, timeframe='5m', requested_timeframes=['5m'])
        self._make_coverage(
            start=self.start,
            end=self.end,
            stored=100,
            expected=100,
            timeframe='1m',
        )
        self._make_coverage(
            start=self.start,
            end=self.end,
            stored=20,
            expected=20,
            timeframe='5m',
            source='local_1m_aggregate',
        )

        cov = list_manual_launch_coverage(self.user, 'NQ')
        self.assertEqual(len(cov['launches']), 1)
        self.assertEqual(set(cov['launches'][0]['timeframes']), {'1m', '5m'})
        self.assertEqual(cov['launches'][0]['bars_stored'], 120)
        self.assertEqual(cov['launches'][0]['issue_total'], 0)

    def test_scheduled_job_excluded(self):
        self._make_job(
            trigger=HistoricalDownloadJob.Trigger.SCHEDULED,
            batch_id=None,
        )
        self._make_coverage(start=self.start, end=self.end, stored=10, expected=10)
        cov = self.client.get('/api/market-data/coverage/?instrument=NQ').json()
        self.assertEqual(cov['launches'], [])
        # Totaux instrument incluent quand même les bougies en base
        self.assertEqual(cov['totals']['bars_stored'], 10)

    def test_issue_counts_scoped_to_user(self):
        mine_batch = uuid.uuid4()
        other_batch = uuid.uuid4()
        job_mine = self._make_job(batch_id=mine_batch)
        job_other = self._make_job(user=self.other, batch_id=other_batch)
        BarQualityIssue.objects.create(
            job=job_mine,
            issue_type='ohlc_inconsistent',
            severity='error',
            instrument='NQ',
            contract_id='CON.F.US.ENQ.H25',
            timeframe='1m',
        )
        BarQualityIssue.objects.create(
            job=job_other,
            issue_type='duplicate',
            severity='error',
            instrument='NQ',
            contract_id='CON.F.US.ENQ.H25',
            timeframe='1m',
        )
        body = self.client.get('/api/market-data/coverage/?instrument=NQ').json()
        self.assertEqual(len(body['launches']), 1)
        self.assertEqual(body['launches'][0]['issue_counts'], {'ohlc_inconsistent': 1})
        self.assertEqual(body['launches'][0]['issue_total'], 1)

    def test_relaunch_shows_current_coverage(self):
        """Relance sur période déjà complète → couverture complète, pas 0."""
        self._make_coverage(
            start=self.start,
            end=self.end,
            stored=120,
            expected=120,
            missing=0,
            status='complete',
        )
        # Nouveau lancement (rien de nouveau téléchargé)
        relaunch = uuid.uuid4()
        self._make_job(batch_id=relaunch, status=HistoricalDownloadJob.Status.COMPLETED)

        cov = list_manual_launch_coverage(self.user, 'NQ')
        self.assertEqual(len(cov['launches']), 1)
        self.assertEqual(cov['launches'][0]['bars_stored'], 120)
        self.assertEqual(cov['launches'][0]['coverage_status'], 'complete')

    def test_create_download_sets_shared_batch_id(self):
        with patch('market_data.views.dispatch_historical_download'):
            # Instrument sans profil CME connu (ex. custom) crée un job par TF —
            # on mocke get_session_profile pour forcer le chemin multi-jobs.
            with patch('market_data.views.get_session_profile', return_value=None):
                res = self.client.post(
                    '/api/market-data/downloads/',
                    {
                        'instrument': 'FOO',
                        'start': '2025-03-10T00:00:00Z',
                        'end': '2025-03-11T00:00:00Z',
                        'timeframes': ['1m', '5m'],
                    },
                    format='json',
                )
        self.assertEqual(res.status_code, 201)
        body = res.json()
        self.assertEqual(len(body['jobs']), 2)
        batch_ids = {j['batch_id'] for j in body['jobs']}
        self.assertEqual(len(batch_ids), 1)
        self.assertIsNotNone(next(iter(batch_ids)))


class ManualBatchBackfillMigrationTests(TestCase):
    def test_backfill_groups_manual_jobs_by_second(self):
        import importlib.util
        from pathlib import Path

        mig_path = (
            Path(__file__).resolve().parents[1]
            / 'migrations'
            / '0007_download_job_batch_id.py'
        )
        spec = importlib.util.spec_from_file_location('md_mig_0007', mig_path)
        module = importlib.util.module_from_spec(spec)
        assert spec.loader is not None
        spec.loader.exec_module(module)
        backfill_manual_batch_ids = module.backfill_manual_batch_ids

        user = User.objects.create_user(username='miguser', password='x')
        created = datetime(2025, 3, 10, 12, 0, 5, tzinfo=dt_tz.utc)
        start = datetime(2025, 3, 1, tzinfo=dt_tz.utc)
        end = datetime(2025, 3, 2, tzinfo=dt_tz.utc)

        j1 = HistoricalDownloadJob.objects.create(
            user=user,
            instrument='ES',
            timeframe='1m',
            trigger=HistoricalDownloadJob.Trigger.MANUAL,
            start_utc=start,
            end_utc=end,
            status=HistoricalDownloadJob.Status.COMPLETED,
        )
        j2 = HistoricalDownloadJob.objects.create(
            user=user,
            instrument='ES',
            timeframe='5m',
            trigger=HistoricalDownloadJob.Trigger.MANUAL,
            start_utc=start,
            end_utc=end,
            status=HistoricalDownloadJob.Status.COMPLETED,
        )
        HistoricalDownloadJob.objects.filter(pk__in=[j1.pk, j2.pk]).update(created_at=created)

        scheduled = HistoricalDownloadJob.objects.create(
            user=user,
            instrument='ES',
            timeframe='1m',
            trigger=HistoricalDownloadJob.Trigger.SCHEDULED,
            start_utc=start,
            end_utc=end,
            status=HistoricalDownloadJob.Status.COMPLETED,
        )

        HistoricalDownloadJob.objects.all().update(batch_id=None)

        class _Apps:
            @staticmethod
            def get_model(app_label, model_name):
                from django.apps import apps
                return apps.get_model(app_label, model_name)

        backfill_manual_batch_ids(_Apps(), None)

        j1.refresh_from_db()
        j2.refresh_from_db()
        scheduled.refresh_from_db()
        self.assertIsNotNone(j1.batch_id)
        self.assertEqual(j1.batch_id, j2.batch_id)
        self.assertIsNone(scheduled.batch_id)
