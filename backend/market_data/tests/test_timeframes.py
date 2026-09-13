"""Tests catalogue timeframes + mapping TopstepX."""
from django.test import SimpleTestCase

from market_data.services.timeframes import (
    ALLOWED_TIMEFRAMES,
    UNIT_HOUR,
    UNIT_MINUTE,
    UnknownTimeframe,
    parse_timeframe,
)


class ParseTimeframeTests(SimpleTestCase):
    def test_allowed_catalogue(self):
        self.assertEqual(
            ALLOWED_TIMEFRAMES,
            ('1m', '2m', '5m', '15m', '30m', '1h', '4h'),
        )

    def test_minute_specs(self):
        self.assertEqual(parse_timeframe('1m').unit, UNIT_MINUTE)
        self.assertEqual(parse_timeframe('1m').unit_number, 1)
        self.assertEqual(parse_timeframe('1m').bar_seconds, 60)

        self.assertEqual(parse_timeframe('2m').unit_number, 2)
        self.assertEqual(parse_timeframe('2m').bar_seconds, 120)

        self.assertEqual(parse_timeframe('5m').unit_number, 5)
        self.assertEqual(parse_timeframe('5m').bar_seconds, 300)

        self.assertEqual(parse_timeframe('15m').unit_number, 15)
        self.assertEqual(parse_timeframe('30m').unit_number, 30)

    def test_hour_specs(self):
        self.assertEqual(parse_timeframe('1h').unit, UNIT_HOUR)
        self.assertEqual(parse_timeframe('1h').unit_number, 1)
        self.assertEqual(parse_timeframe('1h').bar_seconds, 3600)

        self.assertEqual(parse_timeframe('4h').unit, UNIT_HOUR)
        self.assertEqual(parse_timeframe('4h').unit_number, 4)
        self.assertEqual(parse_timeframe('4h').bar_seconds, 14400)

    def test_aliases_and_case(self):
        self.assertEqual(parse_timeframe('M1').code, '1m')
        self.assertEqual(parse_timeframe('1Min').code, '1m')
        self.assertEqual(parse_timeframe(' 5M ').code, '5m')

    def test_unknown_raises(self):
        with self.assertRaises(UnknownTimeframe):
            parse_timeframe('1d')
        with self.assertRaises(UnknownTimeframe):
            parse_timeframe('')
