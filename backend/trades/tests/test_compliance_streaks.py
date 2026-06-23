from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase

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
        from trades.models import TopStepTrade
        from datetime import datetime, timedelta

        self._create_day_compliance(date(2026, 6, 12), respected=True)
        self._create_day_compliance(date(2026, 6, 16), respected=True)
        self._create_day_compliance(date(2026, 6, 18), respected=True)

        entered = datetime(2026, 6, 23, 10, 0, 0)
        TopStepTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            topstep_id='STREAK-T1',
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
        from trades.models import TopStepTrade
        from datetime import datetime, timedelta

        self._create_day_compliance(date(2026, 6, 12), respected=True)
        self._create_day_compliance(date(2026, 6, 16), respected=True)
        self._create_day_compliance(date(2026, 6, 18), respected=True)

        entered = datetime(2026, 6, 23, 10, 0, 0)
        TopStepTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            topstep_id='STREAK-T2',
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
        from trades.models import TopStepTrade, TradeStrategy
        from datetime import datetime, timedelta

        self._create_day_compliance(date(2026, 6, 12), respected=True)
        self._create_day_compliance(date(2026, 6, 16), respected=True)
        self._create_day_compliance(date(2026, 6, 18), respected=True)

        def create_trade(day: date, topstep_id: str, *, respected: bool) -> TopStepTrade:
            entered = datetime.combine(day, datetime.min.time().replace(hour=10))
            trade = TopStepTrade.objects.create(
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
        from trades.models import TopStepTrade, TradeStrategy
        from datetime import datetime, timedelta

        def create_trade(day: date, topstep_id: str, *, respected: bool) -> TopStepTrade:
            entered = datetime.combine(day, datetime.min.time().replace(hour=10))
            trade = TopStepTrade.objects.create(
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
