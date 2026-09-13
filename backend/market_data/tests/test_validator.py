"""Tests validation OHLC / gaps / couverture complete vs partial."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from django.test import SimpleTestCase

from market_data.services.normalizer import NormalizedBar, normalize_bars
from market_data.services.sessions import compute_session_flags
from market_data.services.validator import validate_bars
from market_data.tests.fixtures_bars import make_m1_bars


def _bar(ts: datetime, o=1, h=2, l=0.5, c=1.5, v=10, instrument='NQ') -> NormalizedBar:
    flags = compute_session_flags(ts, instrument)
    return NormalizedBar(
        timestamp_utc=ts,
        open=Decimal(str(o)),
        high=Decimal(str(h)),
        low=Decimal(str(l)),
        close=Decimal(str(c)),
        volume=v,
        ny_date=flags.ny_date,
        ny_time=flags.ny_time,
        session_date=flags.session_date,
        is_rth=flags.is_rth,
        is_eth=flags.is_eth,
        is_us_session=flags.is_us_session,
        profile_known=flags.profile_known,
    )


class ValidatorTests(SimpleTestCase):
    def test_ohlc_inconsistent(self):
        ts = datetime(2025, 3, 10, 14, 0, tzinfo=timezone.utc)
        bad = _bar(ts, o=10, h=9, l=8, c=9)  # high < open
        report = validate_bars(
            [bad],
            instrument='NQ',
            start_utc=ts,
            end_utc=ts + timedelta(minutes=1),
        )
        types = {i.issue_type for i in report.issues}
        self.assertIn('ohlc_inconsistent', types)

    def test_invalid_volume(self):
        ts = datetime(2025, 3, 10, 14, 0, tzinfo=timezone.utc)
        bad = _bar(ts, v=-1)
        report = validate_bars(
            [bad],
            instrument='NQ',
            start_utc=ts,
            end_utc=ts + timedelta(minutes=1),
        )
        self.assertTrue(any(i.issue_type == 'invalid_volume' for i in report.issues))

    def test_complete_when_all_expected_present(self):
        # 5 minutes RTH window fully filled
        start = datetime(2025, 3, 10, 14, 0, tzinfo=timezone.utc)
        end = start + timedelta(minutes=5)
        rows = make_m1_bars(start, 5)
        bars, _ = normalize_bars(rows, instrument='NQ')
        report = validate_bars(bars, instrument='NQ', start_utc=start, end_utc=end)
        self.assertEqual(report.unexpected_missing_count, 0)
        self.assertEqual(report.status, 'complete')
        self.assertEqual(report.bars_expected, 5)

    def test_partial_when_gap(self):
        start = datetime(2025, 3, 10, 14, 0, tzinfo=timezone.utc)
        end = start + timedelta(minutes=5)
        rows = make_m1_bars(start, 5)
        # remove middle bar
        rows = [rows[0], rows[1], rows[3], rows[4]]
        bars, _ = normalize_bars(rows, instrument='NQ')
        report = validate_bars(bars, instrument='NQ', start_utc=start, end_utc=end)
        self.assertEqual(report.unexpected_missing_count, 1)
        self.assertEqual(report.status, 'partial')
        self.assertTrue(any(i.issue_type == 'gap' for i in report.issues))

    def test_api_success_short_list_is_not_complete(self):
        """Un retrieveBars réussi avec moins de barres que l'attendu → partial."""
        start = datetime(2025, 3, 10, 14, 0, tzinfo=timezone.utc)
        end = start + timedelta(minutes=60)
        rows = make_m1_bars(start, 10)  # 10 au lieu de ~60
        bars, _ = normalize_bars(rows, instrument='NQ')
        report = validate_bars(bars, instrument='NQ', start_utc=start, end_utc=end)
        self.assertGreater(report.unexpected_missing_count, 0)
        self.assertEqual(report.status, 'partial')

    def test_non_monotonic(self):
        t1 = datetime(2025, 3, 10, 14, 1, tzinfo=timezone.utc)
        t0 = datetime(2025, 3, 10, 14, 0, tzinfo=timezone.utc)
        bars = [_bar(t1), _bar(t0)]
        report = validate_bars(
            bars,
            instrument='NQ',
            start_utc=t0,
            end_utc=t1 + timedelta(minutes=1),
        )
        self.assertTrue(any(i.issue_type == 'non_monotonic' for i in report.issues))
