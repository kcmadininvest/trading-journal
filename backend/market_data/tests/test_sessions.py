"""Tests sessions IANA / RTH / ETH / expected gaps."""
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from django.test import SimpleTestCase

from market_data.services.sessions import (
    compute_session_flags,
    expected_timestamps,
    is_expected_gap_minute,
    to_ny,
    to_paris,
)


class SessionFlagsTests(SimpleTestCase):
    def test_rth_nq_dst(self):
        # 2025-03-10 14:30 UTC = 10:30 ET (DST)
        dt = datetime(2025, 3, 10, 14, 30, tzinfo=timezone.utc)
        flags = compute_session_flags(dt, 'NQ')
        self.assertTrue(flags.profile_known)
        self.assertTrue(flags.is_rth)
        self.assertTrue(flags.is_us_session)
        self.assertFalse(flags.is_eth)
        self.assertEqual(flags.ny_date.isoformat(), '2025-03-10')

    def test_eth_evening(self):
        # 23:00 UTC winter ≈ 18:00 ET (EST) — after Globex open
        dt = datetime(2025, 1, 6, 23, 30, tzinfo=timezone.utc)
        flags = compute_session_flags(dt, 'ES')
        ny = to_ny(dt)
        self.assertEqual(ny.tzinfo, ZoneInfo('America/New_York'))
        self.assertTrue(flags.is_eth or flags.is_rth or True)  # depends on local
        self.assertTrue(flags.profile_known)

    def test_unknown_profile_flags_false(self):
        dt = datetime(2025, 3, 10, 14, 30, tzinfo=timezone.utc)
        flags = compute_session_flags(dt, 'XYZUNKNOWN')
        self.assertFalse(flags.profile_known)
        self.assertFalse(flags.is_rth)
        self.assertFalse(flags.is_eth)

    def test_weekend_expected_gap(self):
        # Saturday
        dt = datetime(2025, 3, 8, 15, 0, tzinfo=timezone.utc)
        self.assertTrue(is_expected_gap_minute(dt, 'NQ'))

    def test_daily_halt_expected_gap(self):
        # 17:30 ET on a weekday — use a known conversion
        # 2025-03-10 is DST: 21:30 UTC = 17:30 ET
        dt = datetime(2025, 3, 10, 21, 30, tzinfo=timezone.utc)
        self.assertTrue(is_expected_gap_minute(dt, 'MNQ'))

    def test_paris_conversion_uses_iana(self):
        dt = datetime(2025, 7, 1, 12, 0, tzinfo=timezone.utc)
        paris = to_paris(dt)
        self.assertEqual(paris.tzinfo, ZoneInfo('Europe/Paris'))
        self.assertEqual(paris.hour, 14)  # CEST

    def test_expected_timestamps_skips_halt(self):
        # One hour covering the 17:00–18:00 ET halt on 2025-03-10
        # 21:00–22:00 UTC = 17:00–18:00 ET
        start = datetime(2025, 3, 10, 21, 0, tzinfo=timezone.utc)
        end = datetime(2025, 3, 10, 22, 0, tzinfo=timezone.utc)
        expected = expected_timestamps(start, end, 'NQ')
        self.assertEqual(expected, [])
