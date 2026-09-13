from datetime import datetime, timezone as dt_tz
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from integrations.models import UserApiIntegration
from integrations.topstepx_client import TopStepXApiError
from market_data.models import HistoricalDownloadJob
from market_data.services.ingester import bulk_insert_bars
from market_data.services.instruments import list_instruments_from_catalog
from market_data.services.normalizer import normalize_bars
from market_data.tests.fixtures_bars import make_m1_bars

User = get_user_model()


class MarketDataApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='apiuser', password='x')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        UserApiIntegration.objects.create(
            user=self.user,
            provider='topstepx',
            external_username='demo',
            is_connected=True,
        )

    def test_coverage_empty(self):
        res = self.client.get('/api/market-data/coverage/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), [])

    def test_instruments_fallback_catalog(self):
        with patch(
            'market_data.views.call_with_valid_session_token',
            side_effect=TopStepXApiError('fail'),
        ):
            res = self.client.get('/api/market-data/instruments/')
        self.assertEqual(res.status_code, 200)
        roots = {row['instrument'] for row in res.json()}
        catalog_roots = {i.instrument for i in list_instruments_from_catalog()}
        self.assertTrue(roots & catalog_roots)

    def test_create_download_job(self):
        with patch('market_data.views.dispatch_historical_download') as mock_dispatch:
            res = self.client.post(
                '/api/market-data/downloads/',
                {
                    'instrument': 'NQ',
                    'start': '2025-03-10T00:00:00Z',
                    'end': '2025-03-11T00:00:00Z',
                    'timeframe': '1m',
                },
                format='json',
            )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()['instrument'], 'NQ')
        job = HistoricalDownloadJob.objects.get(user=self.user)
        mock_dispatch.assert_called_once_with(job.id)

    def test_create_download_rejects_invalid_timeframe(self):
        res = self.client.post(
            '/api/market-data/downloads/',
            {
                'instrument': 'NQ',
                'start': '2025-03-10T00:00:00Z',
                'end': '2025-03-11T00:00:00Z',
                'timeframe': '1d',
            },
            format='json',
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn('timeframe', res.json())

    def test_create_download_accepts_5m(self):
        with patch('market_data.views.dispatch_historical_download') as mock_dispatch:
            res = self.client.post(
                '/api/market-data/downloads/',
                {
                    'instrument': 'NQ',
                    'start': '2025-03-10T00:00:00Z',
                    'end': '2025-03-11T00:00:00Z',
                    'timeframe': '5m',
                },
                format='json',
            )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()['timeframe'], '5m')
        mock_dispatch.assert_called_once()

    def test_create_download_abandons_stale_pending(self):
        from django.utils import timezone
        from datetime import timedelta

        stale = HistoricalDownloadJob.objects.create(
            user=self.user,
            instrument='ES',
            start_utc=timezone.now(),
            end_utc=timezone.now() + timedelta(days=1),
            status=HistoricalDownloadJob.Status.PENDING,
        )
        HistoricalDownloadJob.objects.filter(pk=stale.pk).update(
            created_at=timezone.now() - timedelta(minutes=10),
        )
        with patch('market_data.views.dispatch_historical_download'):
            res = self.client.post(
                '/api/market-data/downloads/',
                {
                    'instrument': 'NQ',
                    'start': '2025-03-10T00:00:00Z',
                    'end': '2025-03-11T00:00:00Z',
                    'timeframe': '1m',
                },
                format='json',
            )
        self.assertEqual(res.status_code, 201)
        stale.refresh_from_db()
        self.assertEqual(stale.status, HistoricalDownloadJob.Status.FAILED)

    def test_create_download_cancels_running_job(self):
        from django.utils import timezone
        from datetime import timedelta

        running = HistoricalDownloadJob.objects.create(
            user=self.user,
            instrument='ES',
            start_utc=timezone.now(),
            end_utc=timezone.now() + timedelta(days=1),
            status=HistoricalDownloadJob.Status.RUNNING,
        )
        with patch('market_data.views.dispatch_historical_download'):
            res = self.client.post(
                '/api/market-data/downloads/',
                {
                    'instrument': 'NQ',
                    'start': '2025-03-10T00:00:00Z',
                    'end': '2025-03-11T00:00:00Z',
                    'timeframe': '1m',
                },
                format='json',
            )
        self.assertEqual(res.status_code, 201)
        running.refresh_from_db()
        self.assertEqual(running.status, HistoricalDownloadJob.Status.CANCELLED)

    def test_download_requires_integration(self):
        UserApiIntegration.objects.filter(user=self.user).delete()
        res = self.client.post(
            '/api/market-data/downloads/',
            {
                'instrument': 'ES',
                'start': '2025-03-10T00:00:00Z',
                'end': '2025-03-11T00:00:00Z',
            },
            format='json',
        )
        self.assertEqual(res.status_code, 400)

    def test_bars_csv_export(self):
        start = datetime(2025, 3, 10, 14, 0, tzinfo=dt_tz.utc)
        rows = make_m1_bars(start, 3)
        bars, _ = normalize_bars(rows, instrument='MES')
        bulk_insert_bars(
            bars,
            instrument='MES',
            symbol='MESH5',
            contract_id='CON.F.US.MES.H25',
            timeframe='1m',
            source='test',
        )
        res = self.client.get(
            '/api/market-data/bars/export/',
            {
                'instrument': 'MES',
                'timeframe': '1m',
                'start': '2025-03-10',
                'end': '2025-03-11',
                'contract_id': 'CON.F.US.MES.H25',
            },
        )
        self.assertEqual(res.status_code, 200)
        self.assertIn('text/csv', res['Content-Type'])
        body = res.content.decode('utf-8')
        lines = [ln for ln in body.strip().splitlines() if ln]
        self.assertEqual(lines[0], 'timestamp,open,high,low,close,volume,contract_id')
        self.assertEqual(len(lines), 4)  # header + 3 bars
        self.assertIn('CON.F.US.MES.H25', lines[1])

    def test_bars_csv_export_requires_instrument(self):
        res = self.client.get('/api/market-data/bars/export/', {'start': '2025-01-01', 'end': '2025-01-02'})
        self.assertEqual(res.status_code, 400)
