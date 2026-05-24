from datetime import datetime, timedelta

import pytz
from django.test import SimpleTestCase

from trades.statistics_temporal import (
    compute_avg_daily_exposure_time,
    compute_avg_time_between_trades,
    format_duration_from_seconds,
)

NY_TZ = pytz.timezone('America/New_York')
PARIS_TZ = pytz.timezone('Europe/Paris')


class StatisticsTemporalTests(SimpleTestCase):
    def test_format_duration_from_seconds(self) -> None:
        self.assertEqual(format_duration_from_seconds(0), '00:00:00')
        self.assertEqual(format_duration_from_seconds(3661), '01:01:01')

    def test_trade_day_uses_user_timezone_for_midnight_boundary(self) -> None:
        entered_day1 = datetime(2026, 5, 24, 20, 0, tzinfo=pytz.UTC)
        entered_day2 = datetime(2026, 5, 24, 23, 0, tzinfo=pytz.UTC)
        rows = [
            {
                'trade_day': datetime(2026, 5, 24).date(),
                'entered_at': entered_day1,
                'exited_at': entered_day1 + timedelta(minutes=10),
                'trade_duration': timedelta(minutes=10),
            },
            {
                'trade_day': datetime(2026, 5, 24).date(),
                'entered_at': entered_day2,
                'exited_at': entered_day2 + timedelta(minutes=10),
                'trade_duration': timedelta(minutes=10),
            },
        ]
        self.assertEqual(compute_avg_time_between_trades(rows, PARIS_TZ), '00:00:00')
        self.assertEqual(compute_avg_time_between_trades(rows, NY_TZ), '03:00:00')

    def test_compute_avg_time_between_trades_same_day_only(self) -> None:
        day1 = datetime(2026, 5, 24).date()
        day2 = datetime(2026, 5, 25).date()

        class Trade:
            def __init__(self, entered_at: datetime, trade_day):
                self.entered_at = entered_at
                self.trade_day = trade_day

        trades = [
            Trade(NY_TZ.localize(datetime(2026, 5, 24, 10, 0)), day1),
            Trade(NY_TZ.localize(datetime(2026, 5, 24, 10, 30)), day1),
            Trade(NY_TZ.localize(datetime(2026, 5, 25, 10, 0)), day2),
        ]
        self.assertEqual(compute_avg_time_between_trades(trades, NY_TZ), '00:30:00')

    def test_compute_avg_time_between_trades_empty_with_single_trade(self) -> None:
        day = datetime(2026, 5, 24).date()

        class Trade:
            entered_at = NY_TZ.localize(datetime(2026, 5, 24, 10, 0))
            trade_day = day

        self.assertEqual(compute_avg_time_between_trades([Trade()], NY_TZ), '00:00:00')

    def test_compute_avg_daily_exposure_time_merges_overlaps(self) -> None:
        day = datetime(2026, 5, 24).date()
        rows = [
            {
                'trade_day': day,
                'entered_at': NY_TZ.localize(datetime(2026, 5, 24, 10, 0)),
                'exited_at': NY_TZ.localize(datetime(2026, 5, 24, 10, 30)),
                'trade_duration': timedelta(minutes=30),
            },
            {
                'trade_day': day,
                'entered_at': NY_TZ.localize(datetime(2026, 5, 24, 10, 15)),
                'exited_at': NY_TZ.localize(datetime(2026, 5, 24, 10, 45)),
                'trade_duration': timedelta(minutes=30),
            },
        ]
        self.assertEqual(compute_avg_daily_exposure_time(rows, NY_TZ), '00:45:00')

    def test_compute_avg_daily_exposure_time_averages_days(self) -> None:
        day1 = datetime(2026, 5, 24).date()
        day2 = datetime(2026, 5, 25).date()
        rows = [
            {
                'trade_day': day1,
                'entered_at': NY_TZ.localize(datetime(2026, 5, 24, 10, 0)),
                'exited_at': NY_TZ.localize(datetime(2026, 5, 24, 11, 0)),
                'trade_duration': timedelta(hours=1),
            },
            {
                'trade_day': day2,
                'entered_at': NY_TZ.localize(datetime(2026, 5, 25, 10, 0)),
                'exited_at': NY_TZ.localize(datetime(2026, 5, 25, 11, 30)),
                'trade_duration': timedelta(hours=1, minutes=30),
            },
        ]
        self.assertEqual(compute_avg_daily_exposure_time(rows, NY_TZ), '01:15:00')

    def test_compute_avg_daily_exposure_time_uses_duration_when_trade_day_missing(self) -> None:
        entered = NY_TZ.localize(datetime(2026, 5, 24, 10, 0))
        rows = [
            {
                'trade_day': None,
                'entered_at': entered,
                'exited_at': NY_TZ.localize(datetime(2026, 5, 24, 10, 20)),
                'trade_duration': timedelta(minutes=20),
            }
        ]
        self.assertEqual(compute_avg_daily_exposure_time(rows, NY_TZ), '00:20:00')

    def test_compute_avg_daily_exposure_time_falls_back_to_trade_duration(self) -> None:
        day = datetime(2026, 5, 24).date()
        rows = [
            {
                'trade_day': day,
                'entered_at': NY_TZ.localize(datetime(2026, 5, 24, 10, 0)),
                'exited_at': None,
                'trade_duration': timedelta(minutes=12),
            }
        ]
        self.assertEqual(compute_avg_daily_exposure_time(rows, NY_TZ), '00:12:00')
