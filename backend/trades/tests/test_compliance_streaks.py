from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase

from trades.compliance_streaks import compute_strategy_compliance_context
from trades.models import DayStrategyCompliance, TradingAccount

User = get_user_model()


class ComplianceStreakTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='streak_user', password='testpass123')
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='Streak Test',
            initial_capital=Decimal('10000'),
        )

    def _create_day_compliance(self, day: date, *, respected: bool) -> DayStrategyCompliance:
        return DayStrategyCompliance.objects.create(
            user=self.user,
            trading_account=self.account,
            date=day,
            strategy_respected=respected,
        )

    def test_current_streak_recovers_after_deleting_breaking_day_compliance(self):
        """Supprimer une compliance qui cassait la série doit révéler les jours respectés précédents."""
        self._create_day_compliance(date(2026, 6, 20), respected=True)
        self._create_day_compliance(date(2026, 6, 21), respected=True)
        self._create_day_compliance(date(2026, 6, 22), respected=True)
        breaking = self._create_day_compliance(date(2026, 6, 23), respected=False)

        ctx_before = compute_strategy_compliance_context(
            self.user,
            trading_account_id=self.account.id,
            position_strategy_id=None,
            start_date='2026-06-01',
            end_date='2026-06-23',
        )
        self.assertEqual(ctx_before['current_streak'], 0)

        breaking.delete()

        ctx_after = compute_strategy_compliance_context(
            self.user,
            trading_account_id=self.account.id,
            position_strategy_id=None,
            start_date='2026-06-01',
            end_date='2026-06-23',
        )
        self.assertEqual(ctx_after['current_streak'], 3)
        self.assertEqual(ctx_after['current_streak_start'], '2026-06-20')

    def test_current_streak_ignores_recent_day_with_unevaluated_trade(self):
        """Un trade sans stratégie renseignée le jour le plus récent ne doit pas casser la série."""
        from trades.models import ImportedTrade
        from datetime import datetime, timedelta

        self._create_day_compliance(date(2026, 6, 12), respected=True)
        self._create_day_compliance(date(2026, 6, 16), respected=True)
        self._create_day_compliance(date(2026, 6, 18), respected=True)

        entered = datetime(2026, 6, 23, 10, 0, 0)
        ImportedTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            external_trade_id='STREAK-T1',
            contract_name='ES',
            trade_type='Long',
            entered_at=entered,
            exited_at=entered + timedelta(hours=1),
            entry_price=Decimal('100.000000000'),
            exit_price=Decimal('101.000000000'),
            size=Decimal('1.0000'),
            trade_day=date(2026, 6, 23),
            net_pnl=Decimal('50'),
            pnl=Decimal('50'),
        )

        ctx = compute_strategy_compliance_context(
            self.user,
            trading_account_id=self.account.id,
            position_strategy_id=None,
            start_date='2025-06-23',
            end_date='2026-06-23',
        )
        self.assertEqual(ctx['current_streak'], 3)
        self.assertEqual(ctx['current_streak_start'], '2026-06-12')

    def test_day_compliance_extends_streak_when_trade_unevaluated(self):
        """Une compliance journalière respectée compte même si un trade du jour n'est pas encore évalué."""
        from trades.models import ImportedTrade
        from datetime import datetime, timedelta

        self._create_day_compliance(date(2026, 6, 12), respected=True)
        self._create_day_compliance(date(2026, 6, 16), respected=True)
        self._create_day_compliance(date(2026, 6, 18), respected=True)

        entered = datetime(2026, 6, 23, 10, 0, 0)
        ImportedTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            external_trade_id='STREAK-T2',
            contract_name='ES',
            trade_type='Long',
            entered_at=entered,
            exited_at=entered + timedelta(hours=1),
            entry_price=Decimal('100.000000000'),
            exit_price=Decimal('101.000000000'),
            size=Decimal('1.0000'),
            trade_day=date(2026, 6, 23),
            net_pnl=Decimal('50'),
            pnl=Decimal('50'),
        )
        self._create_day_compliance(date(2026, 6, 23), respected=True)

        ctx = compute_strategy_compliance_context(
            self.user,
            trading_account_id=self.account.id,
            position_strategy_id=None,
            start_date='2025-06-23',
            end_date='2026-06-23',
        )
        self.assertEqual(ctx['current_streak'], 4)
        self.assertEqual(ctx['current_streak_start'], '2026-06-12')
        self.assertEqual(ctx['current_streak_trades'], 0)

    def test_current_streak_trades_excludes_respected_trades_before_streak_start(self):
        """Les trades respectés avant le début de la série ne doivent pas être comptés."""
        from trades.models import ImportedTrade, TradeStrategy
        from datetime import datetime, timedelta

        self._create_day_compliance(date(2026, 6, 12), respected=True)
        self._create_day_compliance(date(2026, 6, 16), respected=True)
        self._create_day_compliance(date(2026, 6, 18), respected=True)

        def create_trade(day: date, external_trade_id: str, *, respected: bool) -> ImportedTrade:
            entered = datetime.combine(day, datetime.min.time().replace(hour=10))
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
                trade_day=day,
                net_pnl=Decimal('50'),
                pnl=Decimal('50'),
            )
            TradeStrategy.objects.create(
                user=self.user,
                trade=trade,
                strategy_respected=respected,
                tp1_reached=False,
                tp2_plus_reached=False,
            )
            return trade

        create_trade(date(2026, 6, 11), 'STREAK-BEFORE-1', respected=False)
        create_trade(date(2026, 6, 11), 'STREAK-BEFORE-2', respected=True)
        create_trade(date(2026, 6, 12), 'STREAK-12-1', respected=True)
        create_trade(date(2026, 6, 12), 'STREAK-12-2', respected=True)
        create_trade(date(2026, 6, 16), 'STREAK-16-1', respected=True)
        create_trade(date(2026, 6, 16), 'STREAK-16-2', respected=True)
        create_trade(date(2026, 6, 16), 'STREAK-16-3', respected=True)
        create_trade(date(2026, 6, 18), 'STREAK-18-1', respected=True)
        create_trade(date(2026, 6, 18), 'STREAK-18-2', respected=True)
        create_trade(date(2026, 6, 23), 'STREAK-23-1', respected=True)
        self._create_day_compliance(date(2026, 6, 23), respected=True)

        ctx = compute_strategy_compliance_context(
            self.user,
            trading_account_id=self.account.id,
            position_strategy_id=None,
            start_date='2025-06-23',
            end_date='2026-06-23',
        )
        self.assertEqual(ctx['current_streak'], 4)
        self.assertEqual(ctx['current_streak_start'], '2026-06-12')
        self.assertEqual(ctx['current_streak_trades'], 8)

    def test_best_streak_trades_counts_only_trades_on_record_streak_days(self):
        """Les trades de la meilleure série ne doivent pas inclure des séquences consécutives hors période."""
        from trades.models import ImportedTrade, TradeStrategy
        from datetime import datetime, timedelta

        def create_trade(day: date, external_trade_id: str, *, respected: bool) -> ImportedTrade:
            entered = datetime.combine(day, datetime.min.time().replace(hour=10))
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
                trade_day=day,
                net_pnl=Decimal('50'),
                pnl=Decimal('50'),
            )
            TradeStrategy.objects.create(
                user=self.user,
                trade=trade,
                strategy_respected=respected,
                tp1_reached=False,
                tp2_plus_reached=False,
            )
            return trade

        self._create_day_compliance(date(2026, 6, 10), respected=False)
        self._create_day_compliance(date(2026, 6, 11), respected=False)
        create_trade(date(2026, 6, 10), 'BEST-NOT-1', respected=False)
        create_trade(date(2026, 6, 11), 'BEST-NOT-2', respected=False)

        self._create_day_compliance(date(2026, 6, 12), respected=True)
        self._create_day_compliance(date(2026, 6, 13), respected=True)
        create_trade(date(2026, 6, 12), 'BEST-YES-1', respected=True)
        create_trade(date(2026, 6, 12), 'BEST-YES-2', respected=True)
        create_trade(date(2026, 6, 13), 'BEST-YES-3', respected=True)

        ctx = compute_strategy_compliance_context(
            self.user,
            trading_account_id=self.account.id,
            position_strategy_id=None,
            start_date='2026-06-01',
            end_date='2026-06-23',
        )
        self.assertEqual(ctx['best_streak'], 2)
        self.assertEqual(ctx['best_streak_trades'], 3)
        self.assertEqual(ctx['best_not_respect_streak'], 2)
        self.assertEqual(ctx['best_not_respect_streak_trades'], 2)
        self.assertEqual(ctx['current_not_respect_streak'], 0)

    def test_current_not_respect_streak_during_non_compliance_run(self):
        """La série en cours de non-respect compte les jours consécutifs non respectés depuis aujourd'hui."""
        self._create_day_compliance(date(2026, 6, 20), respected=False)
        self._create_day_compliance(date(2026, 6, 21), respected=False)
        self._create_day_compliance(date(2026, 6, 22), respected=False)

        ctx = compute_strategy_compliance_context(
            self.user,
            trading_account_id=self.account.id,
            position_strategy_id=None,
            start_date='2026-06-01',
            end_date='2026-06-22',
        )
        self.assertEqual(ctx['current_not_respect_streak'], 3)
        self.assertEqual(ctx['current_not_respect_streak_start'], '2026-06-20')
        self.assertEqual(ctx['current_streak'], 0)

    def test_current_not_respect_streak_resets_after_respected_days(self):
        """Après une série de respect en cours, la série de non-respect en cours doit être à 0."""
        self._create_day_compliance(date(2026, 6, 10), respected=False)
        self._create_day_compliance(date(2026, 6, 11), respected=False)
        self._create_day_compliance(date(2026, 6, 12), respected=True)
        self._create_day_compliance(date(2026, 6, 13), respected=True)

        ctx = compute_strategy_compliance_context(
            self.user,
            trading_account_id=self.account.id,
            position_strategy_id=None,
            start_date='2026-06-01',
            end_date='2026-06-13',
        )
        self.assertEqual(ctx['current_streak'], 2)
        self.assertEqual(ctx['current_not_respect_streak'], 0)
        self.assertEqual(ctx['best_not_respect_streak'], 2)

    def test_current_streak_uses_twelve_month_window_not_single_day_period(self):
        """Avec un filtre période « aujourd'hui » seul, la série doit quand même compter l'historique récent."""
        self._create_day_compliance(date(2026, 6, 20), respected=True)
        self._create_day_compliance(date(2026, 6, 21), respected=True)
        self._create_day_compliance(date(2026, 6, 22), respected=True)

        ctx_narrow = compute_strategy_compliance_context(
            self.user,
            trading_account_id=self.account.id,
            position_strategy_id=None,
            start_date='2026-06-23',
            end_date='2026-06-23',
        )
        self.assertEqual(ctx_narrow['current_streak'], 0)

        ctx_twelve_months = compute_strategy_compliance_context(
            self.user,
            trading_account_id=self.account.id,
            position_strategy_id=None,
            start_date='2025-06-23',
            end_date='2026-06-23',
        )
        self.assertEqual(ctx_twelve_months['current_streak'], 3)


class DisciplineBadgeMilestoneTests(SimpleTestCase):
    def test_next_badge_at_20_targets_maltz(self):
        from trades.compliance_streaks import compute_dashboard_next_badge

        badge = compute_dashboard_next_badge(20)
        self.assertIsNotNone(badge)
        assert badge is not None
        self.assertEqual(badge['id'], 'maltz')
        self.assertEqual(badge['days'], 21)

    def test_next_badge_at_21_targets_month(self):
        from trades.compliance_streaks import compute_dashboard_next_badge

        badge = compute_dashboard_next_badge(21)
        self.assertIsNotNone(badge)
        assert badge is not None
        self.assertEqual(badge['id'], 'month')
        self.assertEqual(badge['days'], 30)

    def test_next_record_milestone_before_maltz_is_none(self):
        from trades.compliance_streaks import compute_next_record_milestone

        self.assertIsNone(compute_next_record_milestone(20))

    def test_next_record_milestone_at_25_targets_month(self):
        from trades.compliance_streaks import compute_next_record_milestone

        milestone = compute_next_record_milestone(25)
        self.assertIsNotNone(milestone)
        assert milestone is not None
        self.assertEqual(milestone['id'], 'month')
        self.assertEqual(milestone['days'], 30)
        self.assertAlmostEqual(milestone['progress'], (25 / 30) * 100)

    def test_next_record_milestone_skips_maltz_tier(self):
        from trades.compliance_streaks import compute_next_record_milestone

        milestone = compute_next_record_milestone(21)
        self.assertIsNotNone(milestone)
        assert milestone is not None
        self.assertEqual(milestone['id'], 'month')


class RollingTradeComplianceRatesTests(SimpleTestCase):
    def test_calculate_rolling_rates_from_daily_compliance(self):
        from trades.compliance_streaks import calculate_rolling_trade_compliance_rates

        daily = {
            '2026-06-20': {'with_strategy': 2, 'respected': 2, 'not_respected': 0},
            '2026-06-25': {'with_strategy': 1, 'respected': 0, 'not_respected': 1},
            '2026-06-27': {'with_strategy': 4, 'respected': 3, 'not_respected': 1},
        }
        rates = calculate_rolling_trade_compliance_rates(
            daily,
            anchor_date=date(2026, 6, 28),
        )
        # 7 j. (>= 2026-06-21) : 1 + 4 = 5 trades, 3 respectés, 2 non respectés
        self.assertEqual(rates['compliance_7d'], 60.0)
        self.assertEqual(rates['compliance_7d_respected'], 3)
        self.assertEqual(rates['compliance_7d_not_respected'], 2)
        self.assertEqual(rates['compliance_7d_total'], 5)
        # 30 / 90 j. incluent aussi le 2026-06-20 : 7 trades, 5 respectés, 2 non respectés
        self.assertEqual(rates['compliance_30d'], round(5 / 7 * 100, 2))
        self.assertEqual(rates['compliance_90d'], round(5 / 7 * 100, 2))
        self.assertEqual(rates['compliance_30d_respected'], 5)
        self.assertEqual(rates['compliance_30d_not_respected'], 2)
        self.assertEqual(rates['compliance_30d_total'], 7)
        self.assertEqual(rates['compliance_90d_respected'], 5)
        self.assertEqual(rates['compliance_90d_not_respected'], 2)
        self.assertEqual(rates['compliance_90d_total'], 7)

    def test_calculate_rolling_rates_returns_none_without_data(self):
        from trades.compliance_streaks import calculate_rolling_trade_compliance_rates

        rates = calculate_rolling_trade_compliance_rates(
            {},
            anchor_date=date(2026, 6, 28),
        )
        self.assertIsNone(rates['compliance_7d'])
        self.assertIsNone(rates['compliance_30d'])
        self.assertIsNone(rates['compliance_90d'])
        self.assertEqual(rates['compliance_7d_respected'], 0)
        self.assertEqual(rates['compliance_7d_not_respected'], 0)
        self.assertEqual(rates['compliance_7d_total'], 0)
        self.assertEqual(rates['compliance_30d_respected'], 0)
        self.assertEqual(rates['compliance_30d_not_respected'], 0)
        self.assertEqual(rates['compliance_30d_total'], 0)
        self.assertEqual(rates['compliance_90d_respected'], 0)
        self.assertEqual(rates['compliance_90d_not_respected'], 0)
        self.assertEqual(rates['compliance_90d_total'], 0)
