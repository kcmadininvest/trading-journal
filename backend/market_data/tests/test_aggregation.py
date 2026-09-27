from datetime import date, datetime, timedelta, timezone

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase

from market_data.models import BarCoverage, HistoricalBar
from market_data.services.aggregate_storage import aggregate_contract_range
from market_data.services.aggregation import aggregate_m1_session
from market_data.services.ingester import bulk_insert_bars
from market_data.services.normalizer import normalize_bar_row
from market_data.services.sessions import session_bounds_utc

User = get_user_model()


class SessionBoundsTests(SimpleTestCase):
    def test_equity_cme_session_bounds_respect_dst(self):
        self.assertEqual(
            session_bounds_utc(date(2026, 9, 8), 'MES'),
            (
                datetime(2026, 9, 7, 22, 0, tzinfo=timezone.utc),
                datetime(2026, 9, 8, 21, 0, tzinfo=timezone.utc),
            ),
        )
        self.assertEqual(
            session_bounds_utc(date(2026, 1, 6), 'MES'),
            (
                datetime(2026, 1, 5, 23, 0, tzinfo=timezone.utc),
                datetime(2026, 1, 6, 22, 0, tzinfo=timezone.utc),
            ),
        )

    def test_unknown_instrument_has_no_session_bounds(self):
        with self.assertRaises(ValueError):
            session_bounds_utc(date(2026, 9, 8), '6A')


class AggregateM1SessionTests(SimpleTestCase):
    session_date = date(2026, 9, 8)
    session_open = datetime(2026, 9, 7, 22, 0, tzinfo=timezone.utc)

    def make_bars(self, count, *, start=None):
        start = start or self.session_open
        return [
            normalize_bar_row(
                {
                    't': start + timedelta(minutes=index),
                    'o': 100 + index,
                    'h': 102 + index,
                    'l': 99 + index,
                    'c': 101 + index,
                    'v': index + 1,
                },
                instrument='MES',
            )
            for index in range(count)
        ]

    def test_five_minute_aggregation_is_anchored_to_session_open(self):
        result = aggregate_m1_session(
            self.make_bars(5),
            instrument='MES',
            session_date=self.session_date,
            timeframe='5m',
        )

        self.assertEqual(len(result.bars), 1)
        bar = result.bars[0]
        self.assertEqual(bar.timestamp_utc, self.session_open)
        self.assertEqual((bar.open, bar.high, bar.low, bar.close, bar.volume), (100, 106, 99, 105, 15))
        self.assertEqual(bar.session_date, self.session_date)

    def test_partial_bucket_is_kept_and_not_filled_with_synthetic_prices(self):
        bars = self.make_bars(1) + self.make_bars(
            1,
            start=self.session_open + timedelta(minutes=3),
        )
        result = aggregate_m1_session(
            bars,
            instrument='MES',
            session_date=self.session_date,
            timeframe='5m',
        )

        self.assertEqual(len(result.bars), 1)
        self.assertEqual(result.bars[0].open, 100)
        self.assertEqual(result.bars[0].close, 101)
        self.assertEqual(result.bars[0].volume, 2)
        self.assertEqual(result.bars[0].timestamp_utc, self.session_open)
        self.assertEqual(result.report.status, 'partial')
        self.assertLessEqual(result.report.unexpected_missing_count, result.report.bars_expected)

    def test_four_hour_buckets_follow_session_open_not_utc_midnight(self):
        bars = self.make_bars(1) + self.make_bars(
            1,
            start=self.session_open + timedelta(hours=4),
        )
        result = aggregate_m1_session(
            bars,
            instrument='MES',
            session_date=self.session_date,
            timeframe='4h',
        )

        self.assertEqual(
            [bar.timestamp_utc for bar in result.bars],
            [self.session_open, self.session_open + timedelta(hours=4)],
        )

    def test_daily_timeframe_produces_one_session_bar(self):
        bars = self.make_bars(2) + self.make_bars(
            1,
            start=self.session_open + timedelta(hours=10),
        )
        result = aggregate_m1_session(
            bars,
            instrument='MES',
            session_date=self.session_date,
            timeframe='1d',
        )

        self.assertEqual(len(result.bars), 1)
        self.assertEqual(result.bars[0].timestamp_utc, self.session_open)
        self.assertEqual(result.bars[0].open, 100)
        self.assertEqual(result.bars[0].close, 101)
        self.assertEqual(result.bars[0].volume, 4)

    def test_full_session_rebuilds_every_supported_timeframe(self):
        bars = self.make_bars(1380)
        expected_counts = {
            '2m': 690,
            '5m': 276,
            '15m': 92,
            '30m': 46,
            '1h': 23,
            '4h': 6,
            '1d': 1,
        }
        for timeframe, count in expected_counts.items():
            with self.subTest(timeframe=timeframe):
                result = aggregate_m1_session(
                    bars,
                    instrument='MES',
                    session_date=self.session_date,
                    timeframe=timeframe,
                )
                self.assertEqual(len(result.bars), count)
                self.assertEqual(result.bars[0].timestamp_utc, self.session_open)
                self.assertEqual(result.report.status, 'complete')
                self.assertEqual(result.report.unexpected_missing_count, 0)
        last_4h = aggregate_m1_session(
            bars,
            instrument='MES',
            session_date=self.session_date,
            timeframe='4h',
        ).bars[-1]
        self.assertEqual(last_4h.timestamp_utc, self.session_open + timedelta(hours=20))

    def test_unknown_timeframe_is_rejected(self):
        with self.assertRaises(ValueError):
            aggregate_m1_session(
                self.make_bars(1),
                instrument='MES',
                session_date=self.session_date,
                timeframe='1w',
            )


class AggregateContractRangeTests(TestCase):
    contract_id = 'CON.F.US.MES.U26'
    session_open = datetime(2026, 9, 7, 22, 0, tzinfo=timezone.utc)

    def setUp(self):
        self.user = User.objects.create_user(username='agguser', password='x')
        bars = [
            normalize_bar_row(
                {
                    't': self.session_open + timedelta(minutes=index),
                    'o': 100 + index,
                    'h': 102 + index,
                    'l': 99 + index,
                    'c': 101 + index,
                    'v': index + 1,
                },
                instrument='MES',
            )
            for index in range(5)
        ]
        bulk_insert_bars(
            bars,
            user=self.user,
            instrument='MES',
            symbol='MESU6',
            contract_id=self.contract_id,
            source='test',
        )

    def test_cancellation_before_session_leaves_derived_bars_unchanged(self):
        counts = aggregate_contract_range(
            user=self.user,
            instrument='MES',
            contract_id=self.contract_id,
            start=self.session_open,
            end=self.session_open + timedelta(minutes=5),
            timeframes=['5m'],
            should_cancel=lambda: True,
        )

        self.assertEqual(counts, {'5m': 0})
        self.assertFalse(HistoricalBar.objects.filter(
            contract_id=self.contract_id,
            timeframe='5m',
        ).exists())

    def test_replaces_session_bars_and_persists_aligned_coverage(self):
        params = {
            'user': self.user,
            'instrument': 'MES',
            'contract_id': self.contract_id,
            'start': self.session_open,
            'end': self.session_open + timedelta(minutes=5),
            'timeframes': ['5m'],
        }
        first = aggregate_contract_range(**params)
        self.assertEqual(first, {'5m': 1})
        first_bar = HistoricalBar.objects.get(
            contract_id=self.contract_id,
            timeframe='5m',
        )
        self.assertEqual(first_bar.timestamp_utc, self.session_open)

        HistoricalBar.objects.filter(
            contract_id=self.contract_id,
            timeframe='1m',
            timestamp_utc=self.session_open + timedelta(minutes=4),
        ).update(close=123)
        second = aggregate_contract_range(**params)

        self.assertEqual(second, {'5m': 1})
        self.assertEqual(
            HistoricalBar.objects.get(contract_id=self.contract_id, timeframe='5m').close,
            123,
        )
        self.assertEqual(
            HistoricalBar.objects.filter(contract_id=self.contract_id, timeframe='1m').count(),
            5,
        )
        coverage = BarCoverage.objects.get(
            contract_id=self.contract_id,
            timeframe='5m',
            source='local_1m_aggregate',
        )
        self.assertEqual(coverage.start_utc, self.session_open)
        self.assertEqual(coverage.status, BarCoverage.Status.PARTIAL)

    def test_derived_session_without_m1_is_left_untouched(self):
        from datetime import date as date_cls
        from decimal import Decimal
        from django.utils import timezone as dj_tz

        derived_session = date_cls(2026, 9, 9)
        derived_ts = datetime(2026, 9, 8, 22, 0, tzinfo=timezone.utc)
        HistoricalBar.objects.create(
            user=self.user,
            instrument='MES',
            symbol='MESU6',
            contract_id=self.contract_id,
            timeframe='5m',
            timestamp_utc=derived_ts,
            open=Decimal('200'),
            high=Decimal('201'),
            low=Decimal('199'),
            close=Decimal('200.5'),
            volume=10,
            ny_date=derived_session,
            ny_time=derived_ts.time(),
            session_date=derived_session,
            source='topstepx_sim',
            fetched_at=dj_tz.now(),
        )

        counts = aggregate_contract_range(
            user=self.user,
            instrument='MES',
            contract_id=self.contract_id,
            start=self.session_open,
            end=derived_ts + timedelta(days=2),
            timeframes=['5m'],
        )
        self.assertEqual(counts.get('5m'), 1)
        self.assertTrue(
            HistoricalBar.objects.filter(
                contract_id=self.contract_id,
                timeframe='5m',
                session_date=derived_session,
                source='topstepx_sim',
            ).exists()
        )
