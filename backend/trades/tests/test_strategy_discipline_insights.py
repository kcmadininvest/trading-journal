from datetime import date, datetime, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase
from django.utils import timezone
from trades.models import ImportedTrade, TradeStrategy, TradingAccount

from trades.strategy_discipline_insights import (
    aggregate_compliance_completion_stats,
    aggregate_emotions_by_respect,
    aggregate_gain_if_strategy_stats,
)

User = get_user_model()


class _FakeStrategy:
    def __init__(
        self,
        *,
        strategy_respected,
        gain_if_strategy_respected=None,
        dominant_emotions=None,
        trade_day=None,
        pnl=0.0,
    ):
        self.strategy_respected = strategy_respected
        self.gain_if_strategy_respected = gain_if_strategy_respected
        self.dominant_emotions = dominant_emotions or []
        self.trade_day = trade_day
        self.pnl = pnl


class _FakeQuerySet:
    def __init__(self, items):
        self._items = list(items)

    def filter(self, **kwargs):
        filtered = self._items
        for key, value in kwargs.items():
            if key == "strategy_respected":
                filtered = [i for i in filtered if i.strategy_respected is value]
            elif key == "gain_if_strategy_respected":
                filtered = [i for i in filtered if i.gain_if_strategy_respected is value]
        return _FakeQuerySet(filtered)

    def exclude(self, **kwargs):
        filtered = self._items
        for key, value in kwargs.items():
            if key == "gain_if_strategy_respected__isnull" and value is True:
                filtered = [i for i in filtered if i.gain_if_strategy_respected is not None]
            elif key == "strategy_respected__isnull" and value is True:
                filtered = [i for i in filtered if i.strategy_respected is not None]
        return _FakeQuerySet(filtered)

    def count(self):
        return len(self._items)

    def values_list(self, *fields, flat=False):
        if flat:
            return [getattr(i, fields[0]) for i in self._items]
        rows = []
        for item in self._items:
            row = []
            for field in fields:
                if field == "trade__trade_day":
                    row.append(getattr(item, "trade_day", None))
                elif field == "strategy_respected":
                    row.append(item.strategy_respected)
                else:
                    row.append(getattr(item, field, None))
            rows.append(tuple(row))
        return rows

    def __iter__(self):
        return iter(self._items)


class StrategyDisciplineInsightsTests(SimpleTestCase):
    def test_gain_if_stats_on_not_respected_only(self):
        qs = _FakeQuerySet(
            [
                _FakeStrategy(strategy_respected=False, gain_if_strategy_respected=True),
                _FakeStrategy(strategy_respected=False, gain_if_strategy_respected=False),
                _FakeStrategy(strategy_respected=False, gain_if_strategy_respected=None),
                _FakeStrategy(strategy_respected=True, gain_if_strategy_respected=True),
            ]
        )
        stats = aggregate_gain_if_strategy_stats(qs)
        self.assertEqual(stats["total_not_respected"], 3)
        self.assertEqual(stats["total_answered"], 2)
        self.assertEqual(stats["unanswered"], 1)
        self.assertEqual(stats["would_have_won"], 1)
        self.assertEqual(stats["would_have_lost"], 1)
        self.assertEqual(stats["would_have_won_pct"], 50.0)

    def test_gain_if_stats_financial_and_context(self):
        qs = _FakeQuerySet(
            [
                # Respected trades (count in total_trades_in_period)
                _FakeStrategy(strategy_respected=True, pnl=100.0),
                _FakeStrategy(strategy_respected=True, pnl=50.0),
                # Not respected losing trades
                _FakeStrategy(strategy_respected=False, gain_if_strategy_respected=True, pnl=-200.0),
                _FakeStrategy(strategy_respected=False, gain_if_strategy_respected=False, pnl=-300.0),
                _FakeStrategy(strategy_respected=False, gain_if_strategy_respected=None, pnl=-100.0),
                # Not respected winning trade (should not be counted in unanswered)
                _FakeStrategy(strategy_respected=False, gain_if_strategy_respected=None, pnl=150.0),
            ]
        )
        stats = aggregate_gain_if_strategy_stats(qs)
        self.assertEqual(stats["total_trades_in_period"], 6)
        self.assertEqual(stats["total_not_respected"], 4)
        self.assertEqual(stats["not_respected_rate_pct"], 66.67)
        self.assertEqual(stats["total_pnl_not_respected"], -450.0)
        self.assertEqual(stats["avg_pnl_not_respected"], -112.5)
        self.assertEqual(stats["losing_trades_count"], 3)
        self.assertEqual(stats["losing_trades_pnl"], -600.0)
        self.assertEqual(stats["winning_trades_count"], 1)
        self.assertEqual(stats["winning_trades_pnl"], 150.0)
        self.assertEqual(stats["would_have_won"], 1)
        self.assertEqual(stats["would_have_won_pnl"], -200.0)
        self.assertEqual(stats["would_have_lost"], 1)
        self.assertEqual(stats["would_have_lost_pnl"], -300.0)
        self.assertEqual(stats["total_answered"], 2)
        # Only the losing trade with gain_if=None counts as unanswered (1, not 2)
        self.assertEqual(stats["unanswered"], 1)

    def test_emotions_by_respect_buckets(self):
        qs = _FakeQuerySet(
            [
                _FakeStrategy(strategy_respected=True, dominant_emotions=["peur", "stress"]),
                _FakeStrategy(strategy_respected=True, dominant_emotions=["peur"]),
                _FakeStrategy(strategy_respected=False, dominant_emotions=["frustration"]),
            ]
        )
        result = aggregate_emotions_by_respect(qs)
        self.assertEqual(result["respected"][0], {"emotion": "peur", "count": 2})
        self.assertEqual(result["not_respected"][0], {"emotion": "frustration", "count": 1})

    def test_compliance_completion_stats(self):
        qs = _FakeQuerySet(
            [
                _FakeStrategy(strategy_respected=True, trade_day="2025-01-01"),
                _FakeStrategy(strategy_respected=False, trade_day="2025-01-01"),
                _FakeStrategy(strategy_respected=None, trade_day="2025-01-02"),
                _FakeStrategy(strategy_respected=True, trade_day="2025-01-02"),
            ]
        )
        stats = aggregate_compliance_completion_stats(qs)
        self.assertEqual(stats["total_trades"], 4)
        self.assertEqual(stats["evaluated_trades"], 3)
        self.assertEqual(stats["unevaluated_trades"], 1)
        self.assertEqual(stats["trade_completion_rate_pct"], 75.0)
        self.assertEqual(stats["total_trading_days"], 2)
        self.assertEqual(stats["days_fully_evaluated"], 1)
        self.assertEqual(stats["days_partially_unevaluated"], 1)
        self.assertEqual(stats["day_completion_rate_pct"], 50.0)


class StrategyDisciplineInsightsDBTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="disc_user", password="testpass123")
        self.account = TradingAccount.objects.create(user=self.user, name="Account1")

        def _make_trade(ext_id, pnl, respected, gain_if=None):
            t = ImportedTrade.objects.create(
                user=self.user,
                trading_account=self.account,
                external_trade_id=ext_id,
                contract_name="NQ",
                trade_type="Long",
                entered_at=timezone.now(),
                exited_at=timezone.now() + timedelta(minutes=30),
                trade_day=date(2026, 1, 10),
                size=Decimal("1"),
                entry_price=Decimal("15000"),
                exit_price=Decimal("15010"),
                net_pnl=Decimal(str(pnl)),
                pnl=Decimal(str(pnl)),
            )
            TradeStrategy.objects.create(
                user=self.user,
                trade=t,
                strategy_respected=respected,
                gain_if_strategy_respected=gain_if,
                tp1_reached=False,
                tp2_plus_reached=False,
            )
            return t

        _make_trade("T1", 500, True)
        _make_trade("T2", -300, False, gain_if=True)
        _make_trade("T3", -200, False, gain_if=False)
        _make_trade("T4", 150, False, gain_if=None)

    def test_sql_aggregate_gain_if_strategy_stats(self):
        qs = TradeStrategy.objects.filter(user=self.user).select_related("trade")
        stats = aggregate_gain_if_strategy_stats(qs, tjf="trade__net_pnl")

        self.assertEqual(stats["total_trades_in_period"], 4)
        self.assertEqual(stats["total_not_respected"], 3)
        self.assertEqual(stats["not_respected_rate_pct"], 75.0)
        self.assertEqual(stats["total_pnl_not_respected"], -350.0)
        self.assertEqual(stats["avg_pnl_not_respected"], -116.67)
        self.assertEqual(stats["losing_trades_count"], 2)
        self.assertEqual(stats["losing_trades_pnl"], -500.0)
        self.assertEqual(stats["winning_trades_count"], 1)
        self.assertEqual(stats["winning_trades_pnl"], 150.0)
        self.assertEqual(stats["would_have_won"], 1)
        self.assertEqual(stats["would_have_won_pnl"], -300.0)
        self.assertEqual(stats["would_have_lost"], 1)
        self.assertEqual(stats["would_have_lost_pnl"], -200.0)
        self.assertEqual(stats["total_answered"], 2)
        self.assertEqual(stats["unanswered"], 0)
        self.assertEqual(stats["would_have_won_pct"], 50.0)
        self.assertEqual(stats["would_have_lost_pct"], 50.0)
