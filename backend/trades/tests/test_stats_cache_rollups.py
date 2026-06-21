from datetime import date, datetime, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase

from trades.models import TopStepTrade, TradingAccount
from trades.models_rollup import STRATEGY_ROOT_UNASSIGNED, TradeDailyRollup
from trades.services.rollup_service import (
    get_daily_aggregates_from_rollups,
    handle_trade_rollup_update,
    rebuild_rollups_for_user,
    resolve_strategy_root_id,
)
from trades.stats_response_cache import (
    build_stats_cache_key,
    get_cached_stats_response,
    invalidate_user_stats_cache,
    set_cached_stats_response,
)

User = get_user_model()


class StatsResponseCacheTests(TestCase):
    def test_cache_roundtrip(self):
        params = {'start_date': '2026-01-01', 'end_date': '2026-01-31'}
        key = build_stats_cache_key(42, 'dashboard_summary', params)
        self.assertIn('stats:v1:dashboard_summary:42:', key)
        self.assertIsNone(get_cached_stats_response(42, 'dashboard_summary', params))
        payload = {'count': 1, 'daily_aggregates': []}
        set_cached_stats_response(42, 'dashboard_summary', params, payload)
        self.assertEqual(get_cached_stats_response(42, 'dashboard_summary', params), payload)
        from django.core.cache import cache
        cache.clear()
        self.assertIsNone(get_cached_stats_response(42, 'dashboard_summary', params))


class RollupServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='rollup_user', password='testpass123')
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='Test',
            initial_capital=Decimal('10000'),
        )

    def test_resolve_strategy_root_unassigned(self):
        self.assertEqual(resolve_strategy_root_id(self.user, None), STRATEGY_ROOT_UNASSIGNED)

    def _create_trade(self, topstep_id, trade_day, net_pnl, pnl=None):
        entered = datetime.combine(trade_day, datetime.min.time().replace(hour=10))
        return TopStepTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            topstep_id=topstep_id,
            contract_name='ES',
            trade_type='Long',
            entered_at=entered,
            exited_at=entered + timedelta(hours=1),
            entry_price=Decimal('100.000000000'),
            exit_price=Decimal('101.000000000'),
            size=Decimal('1.0000'),
            trade_day=trade_day,
            net_pnl=Decimal(net_pnl),
            pnl=Decimal(pnl if pnl is not None else net_pnl),
        )

    def test_rollup_incremental_on_trade(self):
        trade = self._create_trade('T1', date(2026, 6, 1), '100')
        handle_trade_rollup_update(trade)
        rollup = TradeDailyRollup.objects.get(
            user=self.user,
            trading_account=self.account,
            trade_day=date(2026, 6, 1),
            strategy_root_id=STRATEGY_ROOT_UNASSIGNED,
        )
        self.assertEqual(rollup.trade_count, 1)
        self.assertEqual(rollup.pnl_net, Decimal('100.00'))

    def test_daily_aggregates_from_rollups(self):
        TradeDailyRollup.objects.create(
            user=self.user,
            trading_account=self.account,
            trade_day=date(2026, 6, 1),
            strategy_root_id=STRATEGY_ROOT_UNASSIGNED,
            pnl_net=Decimal('50'),
            trade_count=2,
            win_count=1,
            loss_count=1,
        )
        rows = get_daily_aggregates_from_rollups(
            self.user,
            [self.account.id],
            date(2026, 6, 1),
            date(2026, 6, 1),
            None,
        )
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['pnl'], 50.0)
        self.assertEqual(rows[0]['trade_count'], 2)

    def test_rebuild_rollups_for_user(self):
        self._create_trade('T2', date(2026, 6, 2), '-20', '-18')
        count = rebuild_rollups_for_user(self.user.id)
        self.assertEqual(count, 1)

    def test_distinct_user_ids_for_rebuild_command_ignores_model_ordering(self):
        """Meta.ordering sur TopStepTrade ne doit pas dupliquer user_id dans --all."""
        self._create_trade('T4a', date(2026, 6, 4), '5', '5')
        self._create_trade('T4b', date(2026, 6, 5), '7', '7')
        raw = list(TopStepTrade.objects.values_list('user_id', flat=True).distinct())
        fixed = list(
            TopStepTrade.objects.order_by().values_list('user_id', flat=True).distinct()
        )
        self.assertGreater(len(raw), len(fixed))
        self.assertEqual(fixed.count(self.user.id), 1)

    @patch('trades.tasks.schedule_debounced_stats_invalidation')
    def test_trade_signal_invalidates_cache(self, mock_schedule):
        from trades.stats_response_cache import set_cached_stats_response

        params = {'start_date': '', 'end_date': ''}
        set_cached_stats_response(self.user.id, 'dashboard_summary', params, {'count': 0})
        self._create_trade('T3', date(2026, 6, 3), '10', '12')
        mock_schedule.assert_called_with(self.user.id)
