"""Tests analytics market phases."""
from datetime import date, time

from django.contrib.auth import get_user_model
from django.test import TestCase

from trades.market_phases.analytics import (
    build_asset_market_profile,
    build_period_profile,
    compute_verdict,
)
from trades.market_phases.capture_service import bulk_upsert_capture
from trades.market_phases.period_projection import parse_period_key, periods_from_config
from trades.models import TopStepTrade, TradingAccount

User = get_user_model()


class MarketPhaseAnalyticsTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username='analytics_mp', password='test')
        cls.account = TradingAccount.objects.create(
            user=cls.user,
            name='Analytics',
            account_type='topstep',
        )

    def test_asset_profile_range_pct(self):
        bulk_upsert_capture(
            user=self.user,
            trading_account=self.account,
            session_date=date(2026, 7, 10),
            instrument_key='nasdaq',
            blocks_data=[{
                'phase_code': 'range_bound',
                'range_start': time(12, 0),
                'range_end': time(14, 0),
            }],
            events_data=[],
        )
        from trades.market_phases.models import SessionMarketPhaseBlock, SessionMarketPhaseEvent
        period = parse_period_key('12:00-14:00')
        assert period is not None
        profile = build_asset_market_profile(
            blocks_qs=SessionMarketPhaseBlock.objects.filter(user=self.user),
            events_qs=SessionMarketPhaseEvent.objects.filter(user=self.user),
            period=period,
            instrument_key='nasdaq',
        )
        self.assertEqual(profile['sample_sessions'], 1)
        self.assertEqual(profile['dominant_regime'], 'range_bound')

    def test_verdict_avoid(self):
        self.assertEqual(compute_verdict(20, -50, 12, 45), 'avoid')

    def test_verdict_insufficient(self):
        self.assertEqual(compute_verdict(20, -50, 5, 45), 'insufficient_data')

    def test_fakeout_rate_from_explicit_wick_reentry(self):
        bulk_upsert_capture(
            user=self.user,
            trading_account=self.account,
            session_date=date(2026, 7, 10),
            instrument_key='nasdaq',
            blocks_data=[{
                'phase_code': 'range_bound',
                'range_start': time(12, 0),
                'range_end': time(14, 0),
            }],
            events_data=[
                {
                    'event_type_code': 'range_breakout_up',
                    'occurred_at': time(12, 30),
                    'candle_part': 'wick',
                    'outcome': 'reentry',
                    'direction': 'up',
                },
                {
                    'event_type_code': 'wick_sweep_low',
                    'occurred_at': time(12, 45),
                    'candle_part': 'wick',
                    'outcome': 'unknown',
                    'direction': 'down',
                },
            ],
        )
        from trades.market_phases.models import SessionMarketPhaseBlock, SessionMarketPhaseEvent
        period = parse_period_key('12:00-14:00')
        assert period is not None
        profile = build_asset_market_profile(
            blocks_qs=SessionMarketPhaseBlock.objects.filter(user=self.user),
            events_qs=SessionMarketPhaseEvent.objects.filter(user=self.user),
            period=period,
            instrument_key='nasdaq',
        )
        self.assertEqual(profile['fakeout_rate'], 100.0)
        self.assertEqual(profile['breakout_body_vs_wick'], {'body': 0, 'wick': 2})

    def test_periods_from_config_fixed_mode(self):
        periods = periods_from_config(None, 'fixed', duration_minutes=30, anchor='market_open', market_code='NYSE')
        self.assertGreater(len(periods), 0)
        self.assertEqual(periods[0].start, time(9, 30))
        self.assertEqual(periods[0].end, time(10, 0))
