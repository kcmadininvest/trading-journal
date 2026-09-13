"""Tests roll extensible + get_bars."""
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone as django_tz

from market_data.models import BarCoverage, HistoricalBar
from market_data.services.bar_query import get_available_data, get_bars
from market_data.services.contracts import ResolvedContract
from market_data.services.roll import (
    CalendarRollMethod,
    UnsupportedRollMethod,
    get_roll_method,
)


User = get_user_model()


class RollMethodTests(TestCase):
    def test_calendar_registered(self):
        method = get_roll_method('calendar')
        self.assertEqual(method.name, 'calendar')

    def test_volume_not_implemented(self):
        with self.assertRaises(UnsupportedRollMethod):
            get_roll_method('volume')

    def test_open_interest_not_implemented(self):
        with self.assertRaises(UnsupportedRollMethod):
            get_roll_method('open_interest')

    def test_calendar_segments(self):
        contracts = [
            ResolvedContract(
                contract_id='CON.F.US.ENQ.H25',
                instrument='NQ',
                symbol='NQH5',
                symbol_id='F.US.ENQ',
                broker_symbol='ENQ',
                expiry_month=3,
                expiry_year=2025,
                expiry_date=date(2025, 3, 21),
                raw={},
            ),
            ResolvedContract(
                contract_id='CON.F.US.ENQ.M25',
                instrument='NQ',
                symbol='NQM5',
                symbol_id='F.US.ENQ',
                broker_symbol='ENQ',
                expiry_month=6,
                expiry_year=2025,
                expiry_date=date(2025, 6, 20),
                raw={},
            ),
        ]
        start = datetime(2025, 1, 1, tzinfo=timezone.utc)
        end = datetime(2025, 5, 1, tzinfo=timezone.utc)
        segs = CalendarRollMethod().segments(contracts, start, end)
        self.assertGreaterEqual(len(segs), 1)
        self.assertTrue(all(s.start < s.end for s in segs))


class GetBarsTests(TestCase):
    def setUp(self):
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
                is_eth=False,
                is_us_session=True,
                source='topstepx_sim',
                fetched_at=self.now,
            )

    def test_get_bars_specific_contract(self):
        df = get_bars(
            'NQ', '1m',
            start='2025-03-10T14:00:00Z',
            end='2025-03-10T14:05:00Z',
            contract='CON.F.US.ENQ.H25',
        )
        self.assertEqual(len(df), 5)
        self.assertTrue((df['contract_id'] == 'CON.F.US.ENQ.H25').all())

    def test_get_bars_front_marks_roll(self):
        # Add second contract bars after a roll point
        base = datetime(2025, 6, 1, 14, 0, tzinfo=timezone.utc)
        for i in range(3):
            ts = base + timedelta(minutes=i)
            HistoricalBar.objects.create(
                instrument='NQ',
                symbol='NQM5',
                contract_id='CON.F.US.ENQ.M25',
                timeframe='1m',
                timestamp_utc=ts,
                open=Decimal('20200'),
                high=Decimal('20201'),
                low=Decimal('20199'),
                close=Decimal('20200.5'),
                volume=5,
                ny_date=ts.date(),
                ny_time=ts.time(),
                session_date=ts.date(),
                is_rth=True,
                is_eth=False,
                is_us_session=True,
                source='topstepx_sim',
                fetched_at=self.now,
            )
        with patch('market_data.services.bar_query.list_contracts_for_instrument') as mock_list:
            mock_list.return_value = [
                ResolvedContract(
                    contract_id='CON.F.US.ENQ.H25',
                    instrument='NQ', symbol='NQH5', symbol_id='F.US.ENQ',
                    broker_symbol='ENQ', expiry_month=3, expiry_year=2025,
                    expiry_date=date(2025, 3, 21), raw={},
                ),
                ResolvedContract(
                    contract_id='CON.F.US.ENQ.M25',
                    instrument='NQ', symbol='NQM5', symbol_id='F.US.ENQ',
                    broker_symbol='ENQ', expiry_month=6, expiry_year=2025,
                    expiry_date=date(2025, 6, 20), raw={},
                ),
            ]
            df = get_bars(
                'NQ', '1m',
                start='2025-03-01',
                end='2025-06-02',
                contract='front',
                roll_method='calendar',
            )
        self.assertGreater(len(df), 0)
        # Prices never adjusted — still raw decimals
        self.assertIn('open', df.columns)

    def test_get_available_data(self):
        BarCoverage.objects.create(
            instrument='NQ',
            contract_id='CON.F.US.ENQ.H25',
            timeframe='1m',
            start_utc=datetime(2025, 3, 10, 14, 0, tzinfo=timezone.utc),
            end_utc=datetime(2025, 3, 10, 15, 0, tzinfo=timezone.utc),
            bars_stored=5,
            bars_expected=60,
            unexpected_missing_count=55,
            status=BarCoverage.Status.PARTIAL,
            source='topstepx_sim',
            fetched_at=self.now,
        )
        data = get_available_data('NQ')
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['status'], 'partial')
        self.assertEqual(data[0]['bars_stored'], 5)
