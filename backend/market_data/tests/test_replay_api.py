"""Tests timeframes disponibles + bars JSON replay."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone as django_tz
from rest_framework.test import APIClient

from market_data.models import BarCoverage, HistoricalBar
from market_data.services.available_timeframes import (
    latest_replay_coverage,
    list_available_timeframes,
)

User = get_user_model()


class AvailableTimeframesServiceTests(TestCase):
    def setUp(self):
        self.now = django_tz.now()
        BarCoverage.objects.create(
            instrument='NQ',
            contract_id='CON.F.US.ENQ.H25',
            timeframe='1m',
            start_utc=datetime(2025, 3, 10, tzinfo=timezone.utc),
            end_utc=datetime(2025, 3, 11, tzinfo=timezone.utc),
            bars_stored=100,
            bars_expected=100,
            status=BarCoverage.Status.COMPLETE,
            fetched_at=self.now,
        )
        BarCoverage.objects.create(
            instrument='NQ',
            contract_id='CON.F.US.ENQ.H25',
            timeframe='5m',
            start_utc=datetime(2025, 3, 10, tzinfo=timezone.utc),
            end_utc=datetime(2025, 3, 11, tzinfo=timezone.utc),
            bars_stored=20,
            bars_expected=20,
            status=BarCoverage.Status.COMPLETE,
            fetched_at=self.now,
        )
        # Empty coverage ignored
        BarCoverage.objects.create(
            instrument='NQ',
            contract_id='CON.F.US.ENQ.H25',
            timeframe='15m',
            start_utc=datetime(2025, 3, 10, tzinfo=timezone.utc),
            end_utc=datetime(2025, 3, 11, tzinfo=timezone.utc),
            bars_stored=0,
            bars_expected=10,
            status=BarCoverage.Status.EMPTY,
            fetched_at=self.now,
        )
        # Bar-only TF (no coverage)
        HistoricalBar.objects.create(
            instrument='NQ',
            symbol='NQH5',
            contract_id='CON.F.US.ENQ.H25',
            timeframe='1h',
            timestamp_utc=datetime(2025, 3, 10, 14, 0, tzinfo=timezone.utc),
            open=Decimal('20100'),
            high=Decimal('20101'),
            low=Decimal('20099'),
            close=Decimal('20100.5'),
            volume=10,
            ny_date=datetime(2025, 3, 10, tzinfo=timezone.utc).date(),
            ny_time=datetime(2025, 3, 10, 14, 0, tzinfo=timezone.utc).time(),
            session_date=datetime(2025, 3, 10, tzinfo=timezone.utc).date(),
            is_rth=True,
            fetched_at=self.now,
        )

    def test_lists_sorted_by_duration(self):
        rows = list_available_timeframes('NQ')
        values = [r['value'] for r in rows]
        self.assertEqual(values, ['1m', '5m', '1h'])
        self.assertEqual(rows[0]['duration_seconds'], 60)
        self.assertEqual(rows[1]['duration_seconds'], 300)
        self.assertEqual(rows[2]['duration_seconds'], 3600)
        self.assertIn('label', rows[0])

    def test_empty_instrument(self):
        self.assertEqual(list_available_timeframes(''), [])
        self.assertEqual(list_available_timeframes('ES'), [])


class ReplayApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='replayapi', password='x')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.now = django_tz.now()
        base = datetime(2025, 3, 10, 14, 0, tzinfo=timezone.utc)
        for i in range(5):
            ts = base + timedelta(minutes=i)
            HistoricalBar.objects.create(
                instrument='NQ',
                symbol='NQH5',
                contract_id='CON.F.US.ENQ.H25',
                timeframe='1m',
                timestamp_utc=ts,
                open=Decimal('20100'),
                high=Decimal('20101'),
                low=Decimal('20099'),
                close=Decimal('20100.5'),
                volume=10 + i,
                ny_date=ts.date(),
                ny_time=ts.time(),
                session_date=ts.date(),
                is_rth=True,
                fetched_at=self.now,
            )
        HistoricalBar.objects.create(
            instrument='NQ',
            symbol='NQH5',
            contract_id='CON.F.US.ENQ.H25',
            timeframe='5m',
            timestamp_utc=base,
            open=Decimal('20100'),
            high=Decimal('20102'),
            low=Decimal('20098'),
            close=Decimal('20101'),
            volume=50,
            ny_date=base.date(),
            ny_time=base.time(),
            session_date=base.date(),
            is_rth=True,
            fetched_at=self.now,
        )
        BarCoverage.objects.create(
            instrument='NQ',
            contract_id='CON.F.US.ENQ.H25',
            timeframe='1m',
            start_utc=base,
            end_utc=base + timedelta(hours=1),
            bars_stored=5,
            bars_expected=5,
            status=BarCoverage.Status.COMPLETE,
            fetched_at=self.now,
        )

    def test_instrument_timeframes_endpoint(self):
        res = self.client.get('/api/market-data/instruments/NQ/timeframes/')
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body['symbol'], 'NQ')
        values = [t['value'] for t in body['timeframes']]
        self.assertIn('1m', values)
        self.assertIn('5m', values)
        for tf in body['timeframes']:
            self.assertIn('duration_seconds', tf)
            self.assertIn('label', tf)
        self.assertEqual(body['latest_session_date'], '2025-03-10')
        self.assertIsNotNone(body['last_bar_at'])

    def test_latest_replay_coverage_empty(self):
        self.assertEqual(
            latest_replay_coverage('ES'),
            {'last_bar_at': None, 'latest_session_date': None},
        )

    def test_instruments_with_bars(self):
        res = self.client.get('/api/market-data/instruments/?with_bars=1')
        self.assertEqual(res.status_code, 200)
        roots = {row['instrument'] for row in res.json()}
        self.assertIn('NQ', roots)

    def test_bars_json_multi_tf(self):
        res = self.client.get(
            '/api/market-data/bars/',
            {
                'instrument': 'NQ',
                'timeframes': '1m,5m',
                'start': '2025-03-10T14:00:00Z',
                'end': '2025-03-10T14:05:00Z',
                'contract': 'CON.F.US.ENQ.H25',
            },
        )
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body['instrument'], 'NQ')
        self.assertIn('1m', body['series'])
        self.assertIn('5m', body['series'])
        self.assertEqual(len(body['series']['1m']), 5)
        candle = body['series']['1m'][0]
        self.assertIn('t', candle)
        self.assertIn('o', candle)
        self.assertIn('h', candle)
        self.assertIn('l', candle)
        self.assertIn('c', candle)
        self.assertIn('v', candle)

    def test_bars_json_rejects_missing_params(self):
        res = self.client.get('/api/market-data/bars/', {'instrument': 'NQ'})
        self.assertEqual(res.status_code, 400)

    def test_bars_json_rejects_unknown_tf(self):
        res = self.client.get(
            '/api/market-data/bars/',
            {
                'instrument': 'NQ',
                'timeframes': '1w',
                'start': '2025-03-10T14:00:00Z',
                'end': '2025-03-10T15:00:00Z',
            },
        )
        self.assertEqual(res.status_code, 400)
