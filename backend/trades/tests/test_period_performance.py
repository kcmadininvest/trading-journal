"""Tests for rolling day/week/month/year period performance KPIs."""
from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional

import pytz
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User, UserPreferences
from trades.models import TopStepTrade, TradingAccount
from trades.period_performance import (
    compute_period_performance,
    resolve_initial_capital_for_dashboard,
)


class PeriodPerformanceComputationTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='period-kpi@example.com',
            username='period_kpi',
            password='testpass123',
            first_name='P',
            last_name='K',
            role='admin',
        )
        prefs, _ = UserPreferences.objects.get_or_create(user=self.user)
        prefs.timezone = 'UTC'
        prefs.save(update_fields=['timezone'])

        self.account = TradingAccount.objects.create(
            user=self.user,
            name='Period KPI account',
            account_type='other',
            currency='USD',
            initial_capital=Decimal('10000.00'),
            status='active',
        )
        self.tz = pytz.UTC
        self.ref = datetime(2026, 5, 16, 12, 0, 0, tzinfo=self.tz)

    def _create_trade_on_date(
        self,
        trade_day: date,
        pnl: str,
        net_pnl: Optional[str] = None,
        trade_id: Optional[str] = None,
    ) -> None:
        entered = self.tz.localize(
            datetime.combine(trade_day, datetime.min.time().replace(hour=10))
        )
        TopStepTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            topstep_id=trade_id or f'period-{trade_day.isoformat()}-{pnl}',
            contract_name='NQ',
            entered_at=entered,
            exited_at=entered + timedelta(hours=1),
            entry_price=Decimal('100.000000000'),
            exit_price=Decimal('101.000000000'),
            size=Decimal('1.0000'),
            trade_type='Long',
            trade_day=trade_day,
            pnl=Decimal(pnl),
            net_pnl=Decimal(net_pnl if net_pnl is not None else pnl),
        )

    def _create_trade(self, day_offset: int, pnl: str, net_pnl: Optional[str] = None) -> None:
        trade_day = self.ref.date() + timedelta(days=day_offset)
        self._create_trade_on_date(trade_day, pnl, net_pnl, trade_id=f'period-{day_offset}-{pnl}')

    def test_day_week_month_aggregation(self) -> None:
        # ref = 2026-05-16 (Friday)
        self._create_trade(0, '50.00')   # today
        self._create_trade(-1, '30.00')  # yesterday
        self._create_trade(-2, '20.00')  # Thursday this week
        self._create_trade(-8, '100.00') # previous week

        qs = TopStepTrade.objects.filter(user=self.user, trading_account=self.account)
        result = compute_period_performance(
            qs,
            self.tz,
            Decimal('10000'),
            'net_pnl',
            reference_now=self.ref,
        )

        self.assertEqual(result['day']['pnl'], 50.0)
        self.assertEqual(result['day']['previous_pnl'], 30.0)
        self.assertAlmostEqual(result['day']['change_pct'], ((50 - 30) / 30) * 100, places=1)
        self.assertAlmostEqual(result['day']['return_on_capital_pct'], 0.5, places=2)

        # week: Mon 12 - Fri 16 = 50+30+20 = 100
        self.assertEqual(result['week']['pnl'], 100.0)
        self.assertEqual(result['week']['previous_pnl'], 100.0)
        self.assertAlmostEqual(result['week']['change_pct'], 0.0, places=1)

        # month May 1-16: same trades in May
        self.assertEqual(result['month']['pnl'], 200.0)

    def test_year_ytd_vs_same_period_last_year(self) -> None:
        # ref = 2026-05-16
        self._create_trade_on_date(date(2026, 5, 16), '50.00')
        self._create_trade_on_date(date(2026, 2, 1), '30.00')
        self._create_trade_on_date(date(2025, 5, 16), '20.00')
        self._create_trade_on_date(date(2025, 2, 1), '10.00')
        self._create_trade_on_date(date(2024, 12, 31), '999.00')  # hors période YTD

        qs = TopStepTrade.objects.filter(user=self.user, trading_account=self.account)
        result = compute_period_performance(
            qs,
            self.tz,
            Decimal('10000'),
            'net_pnl',
            reference_now=self.ref,
        )

        self.assertEqual(result['year']['pnl'], 80.0)
        self.assertEqual(result['year']['previous_pnl'], 30.0)
        self.assertAlmostEqual(result['year']['change_pct'], ((80 - 30) / 30) * 100, places=1)
        self.assertEqual(result['year']['comparison_basis'], 'same_period_prior_year')

    def test_year_fallback_to_full_prior_calendar_year(self) -> None:
        """Si aucun trade sur la tranche YTD N-1, comparer à l'année civile complète."""
        self._create_trade_on_date(date(2026, 5, 10), '100.00')
        self._create_trade_on_date(date(2025, 11, 1), '50.00')
        self._create_trade_on_date(date(2025, 12, 1), '-20.00')

        qs = TopStepTrade.objects.filter(user=self.user, trading_account=self.account)
        result = compute_period_performance(
            qs,
            self.tz,
            Decimal('10000'),
            'net_pnl',
            reference_now=self.ref,
        )

        self.assertEqual(result['year']['pnl'], 100.0)
        self.assertEqual(result['year']['previous_pnl'], 30.0)
        self.assertEqual(result['year']['comparison_basis'], 'full_prior_calendar_year')
        self.assertEqual(result['year']['prior_calendar_year'], 2025)
        self.assertIsNotNone(result['year']['change_pct'])

    def test_year_counts_trade_day_when_entered_at_differs(self) -> None:
        """Les imports peuvent avoir entered_at récent mais trade_day historique."""
        trade_day_2025 = date(2025, 4, 10)
        entered_2026 = self.tz.localize(datetime(2026, 1, 15, 10, 0, 0))
        TopStepTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            topstep_id='period-import-2025',
            contract_name='NQ',
            entered_at=entered_2026,
            exited_at=entered_2026 + timedelta(hours=1),
            entry_price=Decimal('100.000000000'),
            exit_price=Decimal('101.000000000'),
            size=Decimal('1.0000'),
            trade_type='Long',
            trade_day=trade_day_2025,
            pnl=Decimal('200.00'),
            net_pnl=Decimal('200.00'),
        )
        self._create_trade_on_date(date(2026, 4, 10), '50.00')

        qs = TopStepTrade.objects.filter(user=self.user, trading_account=self.account)
        result = compute_period_performance(
            qs,
            self.tz,
            Decimal('10000'),
            'net_pnl',
            reference_now=self.ref,
        )

        self.assertEqual(result['year']['pnl'], 50.0)
        self.assertEqual(result['year']['previous_pnl'], 200.0)
        self.assertIsNotNone(result['year']['change_pct'])

    def test_change_pct_none_when_previous_zero(self) -> None:
        self._create_trade(0, '25.00')
        qs = TopStepTrade.objects.filter(user=self.user)
        result = compute_period_performance(
            qs, self.tz, Decimal('5000'), 'net_pnl', reference_now=self.ref
        )
        self.assertIsNone(result['day']['change_pct'])

    def test_resolve_initial_capital_sum(self) -> None:
        TradingAccount.objects.create(
            user=self.user,
            name='Second',
            account_type='other',
            currency='USD',
            initial_capital=Decimal('5000.00'),
            status='active',
        )
        total = resolve_initial_capital_for_dashboard(self.user, None)
        self.assertEqual(total, Decimal('15000.00'))


class DashboardSummaryPeriodPerformanceTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='dash-period@example.com',
            username='dash_period',
            password='testpass123',
            first_name='D',
            last_name='P',
            role='admin',
        )
        UserPreferences.objects.get_or_create(user=self.user)
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='Dash period',
            account_type='other',
            currency='USD',
            initial_capital=Decimal('10000.00'),
            status='active',
        )
        now = timezone.now()
        TopStepTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            topstep_id='dash-period-1',
            contract_name='NQ',
            entered_at=now,
            exited_at=now,
            entry_price=Decimal('100.000000000'),
            exit_price=Decimal('101.000000000'),
            size=Decimal('1.0000'),
            trade_type='Long',
            trade_day=now.date(),
            pnl=Decimal('40.000000000'),
            net_pnl=Decimal('40.000000000'),
        )

    def test_dashboard_summary_includes_period_performance(self) -> None:
        self.client.force_authenticate(user=self.user)
        response = self.client.get(
            '/api/trades/dashboard-summary/',
            {'trading_account': self.account.id},
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn('period_performance', response.data)
        pp = response.data['period_performance']
        self.assertIn('day', pp)
        self.assertIn('week', pp)
        self.assertIn('month', pp)
        self.assertIn('year', pp)
        self.assertEqual(pp['day']['pnl'], 40.0)

    def test_period_performance_ignores_date_filter(self) -> None:
        """KPIs use calendar periods, not the dashboard period filter."""
        self.client.force_authenticate(user=self.user)
        response = self.client.get(
            '/api/trades/dashboard-summary/',
            {
                'trading_account': self.account.id,
                'start_date': '2000-01-01',
                'end_date': '2000-01-31',
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['period_performance']['day']['pnl'], 40.0)
        self.assertEqual(len(response.data['daily_aggregates']), 0)
