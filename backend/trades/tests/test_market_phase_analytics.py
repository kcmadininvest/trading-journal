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
from trades.models import ImportedTrade, TradingAccount

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
        self.assertEqual(profile['range_bound_session_pct'], 100.0)

    def test_reentry_rate_from_range_reentry_events(self):
        bulk_upsert_capture(
            user=self.user,
            trading_account=self.account,
            session_date=date(2026, 7, 11),
            instrument_key='nasdaq',
            blocks_data=[{
                'phase_code': 'range_bound',
                'range_start': time(12, 0),
                'range_end': time(14, 0),
            }],
            events_data=[
                {
                    'event_type_code': 'range_breakout_up',
                    'occurred_at': time(12, 20),
                    'candle_part': 'body',
                    'outcome': 'hold',
                    'direction': 'up',
                },
                {
                    'event_type_code': 'range_breakout_down',
                    'occurred_at': time(12, 40),
                    'candle_part': 'wick',
                    'outcome': 'reentry',
                    'direction': 'down',
                },
                {
                    'event_type_code': 'range_reentry',
                    'occurred_at': time(12, 42),
                    'candle_part': 'unknown',
                    'outcome': 'reentry',
                    'direction': 'neutral',
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
        self.assertEqual(profile['reentry_count'], 1)
        self.assertEqual(profile['reentry_rate'], 50.0)

    def test_delete_period_captures(self):
        from trades.market_phases.capture_service import delete_period_captures
        from trades.market_phases.models import SessionMarketPhaseBlock, SessionMarketPhaseEvent

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
            events_data=[{
                'event_type_code': 'wick_sweep_low',
                'occurred_at': time(12, 45),
                'candle_part': 'wick',
                'outcome': 'unknown',
                'direction': 'down',
            }],
        )
        bulk_upsert_capture(
            user=self.user,
            trading_account=self.account,
            session_date=date(2026, 7, 11),
            instrument_key='nasdaq',
            blocks_data=[{
                'phase_code': 'consolidation',
                'range_start': time(15, 0),
                'range_end': time(16, 0),
            }],
            events_data=[],
        )

        result = delete_period_captures(
            user=self.user,
            instrument_key='nasdaq',
            range_start=time(12, 0),
            range_end=time(14, 0),
            date_from=date(2026, 7, 1),
            date_to=date(2026, 7, 31),
            trading_account_id=self.account.id,
        )
        self.assertEqual(result['deleted_blocks'], 1)
        self.assertGreaterEqual(result['deleted_events'], 1)
        self.assertFalse(
            SessionMarketPhaseBlock.objects.filter(
                user=self.user,
                range_start=time(12, 0),
                range_end=time(14, 0),
            ).exists()
        )
        self.assertTrue(
            SessionMarketPhaseBlock.objects.filter(
                user=self.user,
                range_start=time(15, 0),
                range_end=time(16, 0),
            ).exists()
        )
        self.assertFalse(
            SessionMarketPhaseEvent.objects.filter(
                user=self.user,
                occurred_at=time(12, 45),
            ).exists()
        )

    def test_delete_period_captures_bulk(self):
        from trades.market_phases.capture_service import delete_period_captures
        from trades.market_phases.models import SessionMarketPhaseBlock

        for day, start, end, phase in (
            (date(2026, 7, 10), time(12, 0), time(14, 0), 'range_bound'),
            (date(2026, 7, 11), time(15, 0), time(16, 0), 'consolidation'),
            (date(2026, 7, 12), time(17, 0), time(18, 0), 'bullish_trend'),
        ):
            bulk_upsert_capture(
                user=self.user,
                trading_account=self.account,
                session_date=day,
                instrument_key='nasdaq',
                blocks_data=[{
                    'phase_code': phase,
                    'range_start': start,
                    'range_end': end,
                }],
                events_data=[],
            )

        result = delete_period_captures(
            user=self.user,
            instrument_key='nasdaq',
            ranges=[(time(12, 0), time(14, 0)), (time(15, 0), time(16, 0))],
            date_from=date(2026, 7, 1),
            date_to=date(2026, 7, 31),
            trading_account_id=self.account.id,
        )
        self.assertEqual(result['deleted_blocks'], 2)
        self.assertEqual(SessionMarketPhaseBlock.objects.filter(user=self.user).count(), 1)
        self.assertTrue(
            SessionMarketPhaseBlock.objects.filter(
                user=self.user,
                range_start=time(17, 0),
                range_end=time(18, 0),
            ).exists()
        )

    def test_periods_from_config_fixed_mode(self):
        periods = periods_from_config(None, 'fixed', duration_minutes=30, anchor='market_open', market_code='NYSE')
        self.assertGreater(len(periods), 0)
        self.assertEqual(periods[0].start, time(9, 30))
        self.assertEqual(periods[0].end, time(10, 0))
