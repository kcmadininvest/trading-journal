"""Taux de respect au niveau jour : jours incomplets exclus du dénominateur."""
from datetime import date, datetime, timedelta
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User, UserPreferences
from trades.compliance_streaks import compute_day_level_respect_totals
from trades.models import DayStrategyCompliance, ImportedTrade, TradeStrategy, TradingAccount


class DayLevelRespectTotalsTests(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='day-respect@example.com',
            username='day_respect',
            password='testpass123',
            first_name='D',
            last_name='R',
            role='admin',
        )
        UserPreferences.objects.get_or_create(user=self.user)
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='Respect account',
            account_type='other',
            currency='USD',
            initial_capital=Decimal('10000.00'),
            status='active',
        )
        self._trade_seq = 0

    def _create_trade(self, day: date, *, offset_minutes: int = 0) -> ImportedTrade:
        self._trade_seq += 1
        entered = datetime(day.year, day.month, day.day, 10, 0, 0) + timedelta(minutes=offset_minutes)
        return ImportedTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            external_trade_id=f'dr-{self._trade_seq}',
            contract_name='ES',
            entered_at=entered,
            exited_at=entered + timedelta(minutes=15),
            entry_price=Decimal('100.000000000'),
            exit_price=Decimal('101.000000000'),
            size=Decimal('1'),
            trade_type='Long',
            trade_day=day,
            pnl=Decimal('20'),
            net_pnl=Decimal('20'),
        )

    def _create_strategy(self, trade: ImportedTrade, respected) -> TradeStrategy:
        return TradeStrategy.objects.create(
            user=self.user,
            trade=trade,
            strategy_respected=respected,
            tp1_reached=False,
            tp2_plus_reached=False,
        )

    def _totals(self):
        strategies = TradeStrategy.objects.filter(user=self.user).exclude(strategy_respected__isnull=True)
        trades = ImportedTrade.objects.filter(user=self.user, trading_account=self.account)
        compliances = DayStrategyCompliance.objects.filter(
            user=self.user,
            trading_account=self.account,
        ).exclude(strategy_respected__isnull=True)
        trade_days = {d for d in trades.values_list('trade_day', flat=True) if d is not None}
        if trade_days:
            compliances = compliances.exclude(date__in=list(trade_days))
        return compute_day_level_respect_totals(strategies, trades, compliances)

    def test_fully_respected_day(self):
        day = date(2026, 9, 1)
        t1 = self._create_trade(day)
        t2 = self._create_trade(day, offset_minutes=10)
        self._create_strategy(t1, True)
        self._create_strategy(t2, True)
        stats = self._totals()
        self.assertEqual(stats['days_respected'], 1)
        self.assertEqual(stats['days_not_respected'], 0)
        self.assertEqual(stats['total_days'], 1)
        self.assertEqual(stats['classified_trades'], 2)
        self.assertEqual(stats['respect_percentage'], 100.0)

    def test_fully_not_respected_day(self):
        day = date(2026, 9, 1)
        t1 = self._create_trade(day)
        t2 = self._create_trade(day, offset_minutes=10)
        self._create_strategy(t1, False)
        self._create_strategy(t2, False)
        stats = self._totals()
        self.assertEqual(stats['days_respected'], 0)
        self.assertEqual(stats['days_not_respected'], 1)
        self.assertEqual(stats['total_days'], 1)
        self.assertEqual(stats['respect_percentage'], 0.0)

    def test_mixed_day_counts_as_not_respected(self):
        day = date(2026, 6, 1)
        for i, respected in enumerate((True, True, True, True, False)):
            trade = self._create_trade(day, offset_minutes=i * 5)
            self._create_strategy(trade, respected)
        stats = self._totals()
        self.assertEqual(stats['days_respected'], 0)
        self.assertEqual(stats['days_not_respected'], 1)
        self.assertEqual(stats['total_days'], 1)
        self.assertEqual(stats['classified_trades'], 5)
        self.assertEqual(stats['respect_percentage'], 0.0)

    def test_incomplete_day_without_strategy_record_is_excluded(self):
        """Miroir du 2026-09-03 : 2 trades respectés + 1 sans fiche stratégie."""
        day = date(2026, 9, 3)
        t1 = self._create_trade(day)
        t2 = self._create_trade(day, offset_minutes=10)
        self._create_trade(day, offset_minutes=20)
        self._create_strategy(t1, True)
        self._create_strategy(t2, True)
        stats = self._totals()
        self.assertEqual(stats['days_respected'], 0)
        self.assertEqual(stats['days_not_respected'], 0)
        self.assertEqual(stats['total_days'], 0)
        self.assertEqual(stats['classified_trades'], 0)
        self.assertEqual(stats['respect_percentage'], 0.0)

    def test_incomplete_day_with_null_strategy_is_excluded(self):
        day = date(2026, 9, 4)
        t1 = self._create_trade(day)
        t2 = self._create_trade(day, offset_minutes=10)
        self._create_strategy(t1, True)
        self._create_strategy(t2, None)
        stats = self._totals()
        self.assertEqual(stats['total_days'], 0)
        self.assertEqual(stats['classified_trades'], 0)

    def test_day_without_any_evaluation_is_excluded(self):
        self._create_trade(date(2026, 8, 3))
        self._create_trade(date(2026, 8, 3), offset_minutes=10)
        stats = self._totals()
        self.assertEqual(stats['total_days'], 0)

    def test_incomplete_day_does_not_inflate_denominator_with_complete_days(self):
        respected_day = date(2026, 9, 1)
        t_ok = self._create_trade(respected_day)
        self._create_strategy(t_ok, True)

        incomplete = date(2026, 9, 3)
        t1 = self._create_trade(incomplete)
        t2 = self._create_trade(incomplete, offset_minutes=10)
        self._create_trade(incomplete, offset_minutes=20)
        self._create_strategy(t1, True)
        self._create_strategy(t2, True)

        stats = self._totals()
        self.assertEqual(stats['days_respected'], 1)
        self.assertEqual(stats['days_not_respected'], 0)
        self.assertEqual(stats['total_days'], 1)
        self.assertEqual(stats['classified_trades'], 1)
        self.assertEqual(stats['respect_percentage'], 100.0)
        self.assertEqual(stats['days_respected'] + stats['days_not_respected'], stats['total_days'])

    def test_day_compliance_without_trades_is_counted(self):
        DayStrategyCompliance.objects.create(
            user=self.user,
            trading_account=self.account,
            date=date(2026, 9, 8),
            strategy_respected=True,
        )
        DayStrategyCompliance.objects.create(
            user=self.user,
            trading_account=self.account,
            date=date(2026, 9, 9),
            strategy_respected=False,
        )
        stats = self._totals()
        self.assertEqual(stats['days_respected'], 1)
        self.assertEqual(stats['days_not_respected'], 1)
        self.assertEqual(stats['total_days'], 2)
        self.assertEqual(stats['classified_trades'], 0)
        self.assertEqual(stats['respect_percentage'], 50.0)

    def test_compliance_on_trade_day_is_ignored(self):
        day = date(2026, 9, 10)
        trade = self._create_trade(day)
        self._create_strategy(trade, True)
        DayStrategyCompliance.objects.create(
            user=self.user,
            trading_account=self.account,
            date=day,
            strategy_respected=False,
        )
        stats = self._totals()
        self.assertEqual(stats['days_respected'], 1)
        self.assertEqual(stats['days_not_respected'], 0)
        self.assertEqual(stats['total_days'], 1)
        self.assertEqual(stats['respect_percentage'], 100.0)


class StrategyStatisticsRespectDaysApiTests(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='day-respect-api@example.com',
            username='day_respect_api',
            password='testpass123',
            first_name='D',
            last_name='A',
            role='admin',
        )
        UserPreferences.objects.get_or_create(user=self.user)
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='API respect account',
            account_type='other',
            currency='USD',
            initial_capital=Decimal('10000.00'),
            status='active',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self._trade_seq = 0

    def _create_trade(self, day: date, *, offset_minutes: int = 0) -> ImportedTrade:
        self._trade_seq += 1
        entered = datetime(day.year, day.month, day.day, 10, 0, 0) + timedelta(minutes=offset_minutes)
        return ImportedTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            external_trade_id=f'api-{self._trade_seq}',
            contract_name='ES',
            entered_at=entered,
            exited_at=entered + timedelta(minutes=15),
            entry_price=Decimal('100.000000000'),
            exit_price=Decimal('101.000000000'),
            size=Decimal('1'),
            trade_type='Long',
            trade_day=day,
            pnl=Decimal('20'),
            net_pnl=Decimal('20'),
        )

    def _create_strategy(self, trade: ImportedTrade, respected) -> TradeStrategy:
        return TradeStrategy.objects.create(
            user=self.user,
            trade=trade,
            strategy_respected=respected,
            tp1_reached=False,
            tp2_plus_reached=False,
        )

    def test_statistics_excludes_incomplete_day_from_account_rate(self):
        complete = date(2026, 9, 1)
        t_ok = self._create_trade(complete)
        self._create_strategy(t_ok, True)

        incomplete = date(2026, 9, 3)
        t1 = self._create_trade(incomplete)
        t2 = self._create_trade(incomplete, offset_minutes=10)
        self._create_trade(incomplete, offset_minutes=20)
        self._create_strategy(t1, True)
        self._create_strategy(t2, True)

        response = self.client.get(
            '/api/trades/trade-strategies/statistics/',
            {
                'trading_account': self.account.id,
                'start_date': '2026-09-01',
                'end_date': '2026-09-13',
            },
        )
        self.assertEqual(response.status_code, 200)
        stats = response.data['statistics']
        period = stats['period']
        self.assertEqual(stats['total_days'], 1)
        self.assertEqual(stats['respected_count'], 1)
        self.assertEqual(stats['not_respected_count'], 0)
        self.assertEqual(stats['total_trades_in_days'], 1)
        self.assertEqual(stats['respect_percentage'], 100.0)
        self.assertEqual(period['total_days'], 1)
        self.assertEqual(period['respected_count'], 1)
        self.assertEqual(period['respect_percentage'], 100.0)
        self.assertEqual(stats['respected_count'] + stats['not_respected_count'], stats['total_days'])
        self.assertAlmostEqual(
            stats['respect_percentage'] + stats['not_respect_percentage'],
            100.0,
        )
