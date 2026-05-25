"""Tests unitaires des calculs Sharpe."""
import math
import unittest
from datetime import datetime, timedelta, timezone as dt_timezone

import pytz

from trades.risk_metrics import (
    TRADING_DAYS_PER_YEAR,
    aggregate_daily_pnl,
    compute_sharpe_annualized_from_trades,
    compute_sharpe_per_trade,
)


class _FakeTrade:
    def __init__(self, entered_at, pnl: float):
        self.entered_at = entered_at
        self._pnl = pnl

    def pnl(self):
        return self._pnl


class SharpeMetricsTests(unittest.TestCase):
    def test_per_trade_requires_at_least_two_trades(self):
        self.assertEqual(compute_sharpe_per_trade([]), 0.0)
        self.assertEqual(compute_sharpe_per_trade([100.0]), 0.0)

    def test_per_trade_mean_over_stdev(self):
        values = [100.0, -50.0, 80.0, -20.0]
        expected = sum(values) / len(values)
        variance = sum((v - expected) ** 2 for v in values) / (len(values) - 1)
        stdev = variance ** 0.5
        self.assertAlmostEqual(compute_sharpe_per_trade(values), expected / stdev)

    def test_annualized_daily_pnl_times_sqrt_252(self):
        tz = pytz.timezone('Europe/Paris')
        base = datetime(2025, 1, 1, 10, 0, tzinfo=dt_timezone.utc)
        trades = [
            _FakeTrade(base, 200.0),
            _FakeTrade(base + timedelta(days=1), -80.0),
            _FakeTrade(base + timedelta(days=2), 120.0),
            _FakeTrade(base + timedelta(days=3), -40.0),
        ]
        daily_values = [v for _, v in aggregate_daily_pnl(trades, tz, lambda t: t.pnl())]
        expected = compute_sharpe_per_trade(daily_values) * math.sqrt(TRADING_DAYS_PER_YEAR)
        actual = compute_sharpe_annualized_from_trades(
            10000.0,
            trades,
            lambda t: t.pnl(),
            tz,
        )
        self.assertAlmostEqual(actual, expected)

    def test_annualized_fallback_single_day_uses_per_trade(self):
        tz = pytz.timezone('Europe/Paris')
        base = datetime(2025, 2, 1, 10, 0, tzinfo=dt_timezone.utc)
        trades = [
            _FakeTrade(base, 150.0),
            _FakeTrade(base + timedelta(hours=1), -60.0),
            _FakeTrade(base + timedelta(hours=2), 90.0),
        ]
        pnls = [t.pnl() for t in trades]
        expected = compute_sharpe_per_trade(pnls) * math.sqrt(TRADING_DAYS_PER_YEAR)
        actual = compute_sharpe_annualized_from_trades(0.0, trades, lambda t: t.pnl(), tz)
        self.assertAlmostEqual(actual, expected)

    def test_aggregate_daily_pnl(self):
        tz = pytz.timezone('Europe/Paris')
        base = datetime(2025, 3, 1, 10, 0, tzinfo=dt_timezone.utc)
        trades = [
            _FakeTrade(base, 50.0),
            _FakeTrade(base + timedelta(hours=2), 30.0),
            _FakeTrade(base + timedelta(days=1), -20.0),
        ]
        daily = aggregate_daily_pnl(trades, tz, lambda t: t.pnl())
        self.assertEqual(len(daily), 2)
        self.assertAlmostEqual(daily[0][1], 80.0)
        self.assertAlmostEqual(daily[1][1], -20.0)
