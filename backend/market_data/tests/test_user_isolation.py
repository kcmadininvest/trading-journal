"""Isolation multi-tenant : barres / couverture / sync scopés par user."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone as django_tz
from rest_framework.test import APIClient

from market_data.models import BarCoverage, HistoricalBar
from market_data.services.aggregate_storage import aggregate_contract_range
from market_data.services.available_sessions import list_available_sessions
from market_data.services.bar_query import get_bars
from market_data.services.ingester import bulk_insert_bars
from market_data.services.normalizer import normalize_bar_row
from market_data.services.sync_schedule import (
    BOOTSTRAP_LOOKBACK_DAYS,
    compute_sync_window,
    last_stored_timestamp,
)

User = get_user_model()


def _make_bar(user, *, instrument='NQ', contract_id='CON.F.US.ENQ.H25',
              timeframe='1m', ts=None, session_date=None):
    ts = ts or datetime(2025, 3, 10, 14, 0, tzinfo=timezone.utc)
    return HistoricalBar.objects.create(
        user=user,
        instrument=instrument,
        symbol='NQH5',
        contract_id=contract_id,
        timeframe=timeframe,
        timestamp_utc=ts,
        open=Decimal('20100'),
        high=Decimal('20101'),
        low=Decimal('20099'),
        close=Decimal('20100.5'),
        volume=10,
        ny_date=ts.date(),
        ny_time=ts.time(),
        session_date=session_date or ts.date(),
        is_rth=True,
        fetched_at=django_tz.now(),
    )


class MultiUserBarIsolationTests(TestCase):
    def setUp(self):
        self.user_a = User.objects.create_user(
            username='isola', email='isola@example.com', password='x',
        )
        self.user_b = User.objects.create_user(
            username='isolb', email='isolb@example.com', password='x',
        )
        self.ts = datetime(2025, 3, 10, 14, 0, tzinfo=timezone.utc)
        _make_bar(self.user_a, ts=self.ts)
        BarCoverage.objects.create(
            user=self.user_a,
            instrument='NQ',
            contract_id='CON.F.US.ENQ.H25',
            timeframe='1m',
            start_utc=self.ts,
            end_utc=self.ts + timedelta(hours=1),
            bars_stored=1,
            bars_expected=1,
            status=BarCoverage.Status.COMPLETE,
            fetched_at=django_tz.now(),
        )

    def test_get_bars_invisible_to_other_user(self):
        df_a = get_bars(
            'NQ', '1m',
            start='2025-03-10T14:00:00Z',
            end='2025-03-10T15:00:00Z',
            contract='CON.F.US.ENQ.H25',
            user=self.user_a,
        )
        df_b = get_bars(
            'NQ', '1m',
            start='2025-03-10T14:00:00Z',
            end='2025-03-10T15:00:00Z',
            contract='CON.F.US.ENQ.H25',
            user=self.user_b,
        )
        self.assertEqual(len(df_a), 1)
        self.assertEqual(len(df_b), 0)

    def test_sessions_and_replay_api_scoped(self):
        sessions_a = list_available_sessions('NQ', user=self.user_a, timeframe='1m')
        sessions_b = list_available_sessions('NQ', user=self.user_b, timeframe='1m')
        self.assertEqual(sessions_a['sessions'], ['2025-03-10'])
        self.assertEqual(sessions_b['sessions'], [])

        client_b = APIClient()
        client_b.force_authenticate(user=self.user_b)
        res = client_b.get(
            '/api/market-data/bars/',
            {
                'instrument': 'NQ',
                'timeframes': '1m',
                'start': '2025-03-10T14:00:00Z',
                'end': '2025-03-10T15:00:00Z',
                'contract': 'CON.F.US.ENQ.H25',
            },
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['series']['1m'], [])

        res_sess = client_b.get('/api/market-data/instruments/NQ/available-sessions/')
        self.assertEqual(res_sess.status_code, 200)
        self.assertEqual(res_sess.json()['sessions'], [])

    def test_sync_window_ignores_other_user_bars(self):
        now = datetime(2025, 3, 11, 12, 0, tzinfo=timezone.utc)
        last_a = last_stored_timestamp(
            user=self.user_a, instrument='NQ', timeframe='1m',
        )
        last_b = last_stored_timestamp(
            user=self.user_b, instrument='NQ', timeframe='1m',
        )
        self.assertEqual(last_a, self.ts)
        self.assertIsNone(last_b)

        window_b = compute_sync_window(
            user=self.user_b, instrument='NQ', timeframe='1m', now_utc=now,
        )
        self.assertIsNotNone(window_b)
        # B n'a aucune barre : bootstrap, pas gap-fill depuis A
        self.assertEqual(window_b[0], now - timedelta(days=BOOTSTRAP_LOOKBACK_DAYS))

    def test_aggregate_user_a_does_not_delete_user_b_derived(self):
        session_open = datetime(2026, 9, 7, 22, 0, tzinfo=timezone.utc)
        contract_id = 'CON.F.US.MES.U26'
        for user in (self.user_a, self.user_b):
            bars = [
                normalize_bar_row(
                    {
                        't': session_open + timedelta(minutes=i),
                        'o': 100 + i, 'h': 102 + i, 'l': 99 + i,
                        'c': 101 + i, 'v': i + 1,
                    },
                    instrument='MES',
                )
                for i in range(5)
            ]
            bulk_insert_bars(
                bars,
                user=user,
                instrument='MES',
                symbol='MESU6',
                contract_id=contract_id,
                source='test',
            )
            aggregate_contract_range(
                user=user,
                instrument='MES',
                contract_id=contract_id,
                start=session_open,
                end=session_open + timedelta(minutes=5),
                timeframes=['5m'],
            )

        self.assertEqual(
            HistoricalBar.objects.filter(
                user=self.user_b, contract_id=contract_id, timeframe='5m',
            ).count(),
            1,
        )
        # Ré-agréger A ne doit pas toucher B
        aggregate_contract_range(
            user=self.user_a,
            instrument='MES',
            contract_id=contract_id,
            start=session_open,
            end=session_open + timedelta(minutes=5),
            timeframes=['5m'],
        )
        self.assertEqual(
            HistoricalBar.objects.filter(
                user=self.user_b, contract_id=contract_id, timeframe='5m',
            ).count(),
            1,
        )
        self.assertEqual(
            HistoricalBar.objects.filter(
                user=self.user_a, contract_id=contract_id, timeframe='5m',
            ).count(),
            1,
        )

    def test_unique_constraint_includes_user(self):
        _make_bar(self.user_b, ts=self.ts)  # même ts OK pour un autre user
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                _make_bar(self.user_a, ts=self.ts)
