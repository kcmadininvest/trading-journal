from django.test import SimpleTestCase

from trades.strategy_discipline_insights import (
    aggregate_compliance_completion_stats,
    aggregate_emotions_by_respect,
    aggregate_gain_if_strategy_stats,
)


class _FakeStrategy:
    def __init__(
        self,
        *,
        strategy_respected,
        gain_if_strategy_respected=None,
        dominant_emotions=None,
        trade_day=None,
    ):
        self.strategy_respected = strategy_respected
        self.gain_if_strategy_respected = gain_if_strategy_respected
        self.dominant_emotions = dominant_emotions or []
        self.trade_day = trade_day


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
