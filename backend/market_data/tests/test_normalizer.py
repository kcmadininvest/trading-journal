"""Tests normalizer / dédup / extra_raw."""
from datetime import datetime, timezone
from decimal import Decimal

from django.test import SimpleTestCase

from market_data.services.normalizer import normalize_bar_row, normalize_bars
from market_data.tests.fixtures_bars import nq_sample_rth_window


class NormalizerTests(SimpleTestCase):
    def test_normalize_basic_ohlcv(self):
        row = {
            't': '2025-03-10T14:00:00Z',
            'o': 20100.0,
            'h': 20101.0,
            'l': 20099.0,
            'c': 20100.5,
            'v': 42,
        }
        bar = normalize_bar_row(row, instrument='NQ')
        self.assertIsNotNone(bar)
        assert bar is not None
        self.assertEqual(bar.timestamp_utc, datetime(2025, 3, 10, 14, 0, tzinfo=timezone.utc))
        self.assertEqual(bar.open, Decimal('20100.0'))
        self.assertEqual(bar.volume, 42)
        self.assertTrue(bar.is_rth)

    def test_extra_raw_preserved(self):
        row = {
            't': '2025-03-10T14:00:00Z',
            'o': 1, 'h': 2, 'l': 0.5, 'c': 1.5, 'v': 10,
            'tradeCount': 7,
            'openInterest': 99,
        }
        bar = normalize_bar_row(row, instrument='ES')
        assert bar is not None
        self.assertEqual(bar.extra_raw.get('tradeCount'), 7)
        self.assertEqual(bar.extra_raw.get('openInterest'), 99)

    def test_dedup_keeps_last(self):
        rows = [
            {'t': '2025-03-10T14:00:00Z', 'o': 1, 'h': 2, 'l': 0.5, 'c': 1, 'v': 1},
            {'t': '2025-03-10T14:00:00Z', 'o': 9, 'h': 10, 'l': 8, 'c': 9, 'v': 5},
            {'t': '2025-03-10T14:01:00Z', 'o': 9, 'h': 10, 'l': 8, 'c': 9.5, 'v': 2},
        ]
        bars, failed = normalize_bars(rows, instrument='NQ')
        self.assertEqual(len(failed), 0)
        self.assertEqual(len(bars), 2)
        self.assertEqual(bars[0].open, Decimal('9'))
        self.assertEqual(bars[0].volume, 5)

    def test_fixture_batch(self):
        bars, failed = normalize_bars(nq_sample_rth_window(), instrument='NQ')
        self.assertEqual(len(failed), 0)
        self.assertEqual(len(bars), 10)
        self.assertTrue(all(b.is_rth for b in bars))
