"""Suite golden parity — champs API = calculateurs legacy à précision Decimal."""
from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Count, Q, Sum
from django.db.models.functions import Coalesce, TruncDate
from django.test import TestCase
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

from trades.models import ImportedTrade, TradingAccount
from trades.models_rollup import STRATEGY_ROOT_UNASSIGNED, TradeDailyRollup
from trades.pnl_basis import get_trade_pnl_field
from trades.services.analytics_calculator import compute_analytics_payload
from trades.services.rollup_service import (
    get_daily_aggregates_from_rollups,
    handle_trade_rollup_update,
    rollups_cover_period,
)
from trades.services.statistics_calculator import compute_statistics_payload
from trades.services.stats_bundle_service import compute_stats_bundle_payload
from trades.views import ImportedTradeViewSet

User = get_user_model()


class StatisticsParityGoldenTests(TestCase):
    """Parité bloquante : bundle, rollups additifs, calculateurs legacy."""

    def setUp(self):
        self.user = User.objects.create_user(username='parity_user', password='testpass123')
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='Parity',
            initial_capital=Decimal('10000'),
        )
        self.factory = APIRequestFactory()

    def _create_trade(self, external_trade_id, trade_day, net_pnl, pnl=None, hour=10):
        entered = datetime.combine(trade_day, datetime.min.time().replace(hour=hour))
        trade = ImportedTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            external_trade_id=external_trade_id,
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
        handle_trade_rollup_update(trade)
        return trade

    def _request(self, params=None):
        params = params or {}
        wsgi = self.factory.get('/api/trades/stats-bundle/', params)
        request = Request(wsgi)
        request.user = self.user
        return request

    def _queryset(self, request):
        viewset = ImportedTradeViewSet()
        viewset.request = request
        viewset.action = 'list'
        viewset.format_kwarg = None
        return viewset.get_queryset(), get_trade_pnl_field(self.user)

    def test_rollups_cover_period_after_trades(self):
        self._create_trade('P1', date(2026, 6, 1), '100', '120')
        self._create_trade('P2', date(2026, 6, 2), '-30', '-25')
        covered = rollups_cover_period(
            self.user,
            [self.account.id],
            date(2026, 6, 1),
            date(2026, 6, 2),
            None,
        )
        self.assertTrue(covered)

    def test_daily_aggregates_rollup_matches_sql_group_by(self):
        self._create_trade('P3', date(2026, 6, 3), '50', '55')
        self._create_trade('P4', date(2026, 6, 3), '-10', '-8')

        request = self._request({
            'trading_account': str(self.account.id),
            'start_date': '2026-06-03',
            'end_date': '2026-06-03',
        })
        trades, pf = self._queryset(request)

        sql_rows = trades.annotate(
            day=Coalesce('trade_day', TruncDate('entered_at')),
        ).values('day').annotate(
            day_pnl=Sum(pf),
            day_pnl_net=Sum('net_pnl'),
            day_pnl_gross=Sum('pnl'),
            trade_count=Count('id'),
            winning_count=Count('id', filter=Q(**{f'{pf}__gt': 0})),
            losing_count=Count('id', filter=Q(**{f'{pf}__lt': 0})),
        )

        rollup_rows = get_daily_aggregates_from_rollups(
            self.user,
            [self.account.id],
            date(2026, 6, 3),
            date(2026, 6, 3),
            None,
            use_gross=(pf == 'pnl'),
        )

        self.assertEqual(len(rollup_rows), 1)
        sql = sql_rows[0]
        row = rollup_rows[0]
        self.assertEqual(row['trade_count'], sql['trade_count'])
        self.assertEqual(row['winning_count'], sql['winning_count'])
        self.assertEqual(row['losing_count'], sql['losing_count'])
        self.assertAlmostEqual(row['pnl'], float(sql['day_pnl'] or 0), places=2)
        self.assertAlmostEqual(row['pnl_net'], float(sql['day_pnl_net'] or 0), places=2)
        self.assertAlmostEqual(row['pnl_gross'], float(sql['day_pnl_gross'] or 0), places=2)

    def test_statistics_additive_fields_match_rollup_sums(self):
        self._create_trade('P5', date(2026, 6, 4), '80', '90')
        self._create_trade('P6', date(2026, 6, 5), '-20', '-15')

        request = self._request({
            'trading_account': str(self.account.id),
            'start_date': '2026-06-04',
            'end_date': '2026-06-05',
        })
        trades, pf = self._queryset(request)
        stats = compute_statistics_payload(request, trades, pf)

        rollup_rows = get_daily_aggregates_from_rollups(
            self.user,
            [self.account.id],
            date(2026, 6, 4),
            date(2026, 6, 5),
            None,
            use_gross=(pf == 'pnl'),
        )
        rollup_total_pnl = sum(r['pnl'] for r in rollup_rows)
        rollup_trade_count = sum(r['trade_count'] for r in rollup_rows)

        self.assertEqual(stats['total_trades'], rollup_trade_count)
        self.assertAlmostEqual(float(stats['total_pnl']), rollup_total_pnl, places=2)

    def test_stats_bundle_statistics_matches_direct_calculator(self):
        self._create_trade('P7', date(2026, 6, 6), '40', '45')
        self._create_trade('P8', date(2026, 6, 7), '15', '18')

        request = self._request({
            'trading_account': str(self.account.id),
            'start_date': '2026-06-01',
            'end_date': '2026-06-30',
        })
        trades, pf = self._queryset(request)
        direct_stats = compute_statistics_payload(request, trades, pf)
        direct_analytics = compute_analytics_payload(request, trades, pf)
        bundle = compute_stats_bundle_payload(request)

        for key in (
            'total_trades',
            'winning_trades',
            'losing_trades',
            'max_drawdown',
            'max_runup',
            'sharpe_ratio',
            'current_winning_streak_days',
            'profit_factor',
        ):
            self.assertEqual(
                bundle['statistics'][key],
                direct_stats[key],
                msg=f'statistics.{key}',
            )

        self.assertEqual(
            bundle['analytics']['daily_stats']['days_with_profit'],
            direct_analytics['daily_stats']['days_with_profit'],
        )
        self.assertEqual(
            bundle['analytics']['consecutive_stats']['max_consecutive_wins'],
            direct_analytics['consecutive_stats']['max_consecutive_wins'],
        )

    def test_sequential_drawdown_uses_trade_entered_at_order(self):
        """Drawdown legacy : calcul séquentiel sur entered_at (pas agrégat journalier)."""
        day = date(2026, 6, 10)
        self._create_trade('PL1', day, '-100', '-100', hour=9)
        self._create_trade('PW1', day, '30', '30', hour=11)
        self._create_trade('PL2', day, '-80', '-80', hour=13)

        request = self._request({
            'trading_account': str(self.account.id),
            'start_date': day.isoformat(),
            'end_date': day.isoformat(),
        })
        trades, pf = self._queryset(request)
        stats = compute_statistics_payload(request, trades, pf)

        self.assertGreater(stats['max_drawdown'], 0)
        self.assertEqual(stats['total_trades'], 3)

    def _stats_for_range(self, start, end):
        request = self._request({
            'trading_account': str(self.account.id),
            'start_date': start.isoformat(),
            'end_date': end.isoformat(),
        })
        trades, pf = self._queryset(request)
        return compute_statistics_payload(request, trades, pf)

    def test_drawdown_pct_uses_the_peak_of_the_trough(self):
        """Un nouveau pic plus haut ne dilue pas le pourcentage du creux précédent."""
        # Capital 10 000, −1 000 (10 %), puis remontée à 20 000.
        # L'ancien calcul divisait 1 000 par le pic final et affichait 5 %.
        self._create_trade('DD1', date(2026, 6, 1), '-1000', '-1000')
        self._create_trade('DD2', date(2026, 6, 2), '11000', '11000')

        stats = self._stats_for_range(date(2026, 6, 1), date(2026, 6, 2))

        self.assertAlmostEqual(stats['max_drawdown'], 1000.0, places=2)
        self.assertAlmostEqual(stats['max_drawdown_pct'], 10.0, places=2)
        self.assertAlmostEqual(stats['max_drawdown_global'], 1000.0, places=2)
        self.assertAlmostEqual(stats['max_drawdown_global_pct'], 10.0, places=2)

    def test_drawdown_keeps_the_worst_percentage_episode(self):
        """Le montant publié est celui du creux au plus fort pourcentage."""
        # 10 000 → 5 000 (50 %, 5 000), puis 100 000 → 80 000 (20 %, 20 000).
        self._create_trade('DD50', date(2026, 6, 1), '-5000', '-5000')
        self._create_trade('DDUP', date(2026, 6, 2), '95000', '95000')
        self._create_trade('DD20', date(2026, 6, 3), '-20000', '-20000')

        stats = self._stats_for_range(date(2026, 6, 1), date(2026, 6, 3))

        self.assertAlmostEqual(stats['max_drawdown_pct'], 50.0, places=2)
        self.assertAlmostEqual(stats['max_drawdown'], 5000.0, places=2)
        self.assertAlmostEqual(stats['max_drawdown_global_pct'], 50.0, places=2)
        self.assertAlmostEqual(stats['max_drawdown_global'], 5000.0, places=2)

    def test_calmar_does_not_overwrite_drawdown_pct(self):
        """Au-delà de 30 jours, le pourcentage reste relatif au pic du creux."""
        # 10 000 → 20 000, puis −2 000 (10 % du pic, 20 % du capital initial).
        self._create_trade('DDGAIN', date(2026, 6, 1), '10000', '10000')
        self._create_trade('DDLOSS', date(2026, 7, 1), '-2000', '-2000')

        stats = self._stats_for_range(date(2026, 6, 1), date(2026, 7, 1))

        self.assertAlmostEqual(stats['max_drawdown'], 2000.0, places=2)
        self.assertAlmostEqual(stats['max_drawdown_pct'], 10.0, places=2)
        # Calmar = rendement annualisé / (montant du creux / capital initial).
        # 8 000 / 10 000 × 365/30 × 100 / 20 = 48,67. Pas 97,33 (s'il divisait par les 10 % publiés).
        self.assertAlmostEqual(stats['calmar_ratio'], 48.67, places=2)

    def test_current_drawdown_shrinks_on_partial_recovery(self):
        """Après un creux, une remontée qui ne refait pas le pic baisse l'actuel."""
        # 10 000 → 8 000 (20 %), puis 8 500. Record 20 %, actuel 15 %.
        self._create_trade('CUR1', date(2026, 6, 1), '-2000', '-2000')
        self._create_trade('CUR2', date(2026, 6, 2), '500', '500')

        stats = self._stats_for_range(date(2026, 6, 1), date(2026, 6, 2))

        self.assertAlmostEqual(stats['max_drawdown'], 2000.0, places=2)
        self.assertAlmostEqual(stats['max_drawdown_pct'], 20.0, places=2)
        self.assertAlmostEqual(stats['current_drawdown'], 1500.0, places=2)
        self.assertAlmostEqual(stats['current_drawdown_pct'], 15.0, places=2)
        self.assertLess(stats['current_drawdown_pct'], stats['max_drawdown_pct'])

    def test_current_drawdown_is_zero_back_at_the_peak(self):
        """Revenu au pic, l'actuel vaut 0 et le record reste."""
        self._create_trade('PEAK1', date(2026, 6, 1), '-2000', '-2000')
        self._create_trade('PEAK2', date(2026, 6, 2), '2000', '2000')

        stats = self._stats_for_range(date(2026, 6, 1), date(2026, 6, 2))

        self.assertAlmostEqual(stats['max_drawdown'], 2000.0, places=2)
        self.assertAlmostEqual(stats['max_drawdown_pct'], 20.0, places=2)
        self.assertAlmostEqual(stats['current_drawdown'], 0.0, places=2)
        self.assertAlmostEqual(stats['current_drawdown_pct'], 0.0, places=2)

    def test_empty_trades_returns_zero_payload(self):
        request = self._request({'trading_account': str(self.account.id)})
        trades, pf = self._queryset(request)
        stats = compute_statistics_payload(request, trades, pf)
        self.assertEqual(stats['total_trades'], 0)
        self.assertEqual(stats['max_drawdown'], 0.0)
        self.assertEqual(stats['current_drawdown'], 0.0)
        self.assertEqual(stats['current_drawdown_pct'], 0.0)

        rollup = TradeDailyRollup.objects.filter(user=self.user).count()
        self.assertEqual(rollup, 0)
