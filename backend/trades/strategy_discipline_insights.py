"""Agrégats discipline : gain_if_strategy_respected et émotions par bucket."""
from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import Any, Dict, Iterable, List

from django.db.models import Q, Sum


def aggregate_compliance_completion_stats(queryset) -> Dict[str, Any]:
    """
    Taux de saisie du respect de stratégie (trades et jours avec trades).

    Les trades/jours non renseignés (strategy_respected null) sont exclus des
    taux de respect affichés ailleurs — cet agrégat rend cette lacune visible.
    """
    total_trades = queryset.count()
    evaluated_trades = queryset.exclude(strategy_respected__isnull=True).count()
    unevaluated_trades = total_trades - evaluated_trades
    trade_completion_rate_pct = (
        round(evaluated_trades / total_trades * 100, 2) if total_trades > 0 else None
    )

    day_totals: dict[Any, dict[str, int]] = defaultdict(lambda: {"total": 0, "unevaluated": 0})
    for day, respected in queryset.values_list("trade__trade_day", "strategy_respected"):
        if day is None:
            continue
        day_totals[day]["total"] += 1
        if respected is None:
            day_totals[day]["unevaluated"] += 1

    total_trading_days = len(day_totals)
    days_fully_evaluated = sum(
        1 for counts in day_totals.values() if counts["unevaluated"] == 0
    )
    days_partially_unevaluated = total_trading_days - days_fully_evaluated
    day_completion_rate_pct = (
        round(days_fully_evaluated / total_trading_days * 100, 2)
        if total_trading_days > 0
        else None
    )

    return {
        "total_trades": total_trades,
        "evaluated_trades": evaluated_trades,
        "unevaluated_trades": unevaluated_trades,
        "trade_completion_rate_pct": trade_completion_rate_pct,
        "total_trading_days": total_trading_days,
        "days_fully_evaluated": days_fully_evaluated,
        "days_partially_unevaluated": days_partially_unevaluated,
        "day_completion_rate_pct": day_completion_rate_pct,
    }


def _emotion_distribution(strategies: Iterable[Any]) -> List[Dict[str, Any]]:
    counts: dict[str, int] = defaultdict(int)
    for strategy in strategies:
        emotions = strategy.dominant_emotions or []
        for emotion in emotions:
            if emotion:
                counts[str(emotion)] += 1
    return [
        {"emotion": emotion, "count": count}
        for emotion, count in sorted(counts.items(), key=lambda item: item[1], reverse=True)
    ]


def aggregate_gain_if_strategy_stats(queryset, tjf: str = "trade__net_pnl") -> Dict[str, Any]:
    """
    Statistiques et coût financier des écarts de stratégie (trades non respectés).
    """
    total_trades_in_period = queryset.count()
    not_respected = queryset.filter(strategy_respected=False)
    total_not_respected = not_respected.count()
    not_respected_rate_pct = (
        round(total_not_respected / total_trades_in_period * 100, 2)
        if total_trades_in_period > 0
        else 0.0
    )

    if hasattr(queryset, "aggregate") and hasattr(queryset, "model"):
        pnl_agg = not_respected.aggregate(
            total=Sum(tjf),
            losing_pnl=Sum(tjf, filter=Q(**{f"{tjf}__lte": 0})),
            winning_pnl=Sum(tjf, filter=Q(**{f"{tjf}__gt": 0})),
            would_have_won_pnl=Sum(tjf, filter=Q(**{f"{tjf}__lte": 0, "gain_if_strategy_respected": True})),
            would_have_lost_pnl=Sum(tjf, filter=Q(**{f"{tjf}__lte": 0, "gain_if_strategy_respected": False})),
        )
        total_pnl = float(pnl_agg["total"] or Decimal("0"))
        losing_trades_pnl = float(pnl_agg["losing_pnl"] or Decimal("0"))
        winning_trades_pnl = float(pnl_agg["winning_pnl"] or Decimal("0"))
        would_have_won_pnl = float(pnl_agg["would_have_won_pnl"] or Decimal("0"))
        would_have_lost_pnl = float(pnl_agg["would_have_lost_pnl"] or Decimal("0"))

        losing_trades_count = not_respected.filter(**{f"{tjf}__lte": 0}).count()
        winning_trades_count = not_respected.filter(**{f"{tjf}__gt": 0}).count()
        would_have_won = not_respected.filter(**{f"{tjf}__lte": 0, "gain_if_strategy_respected": True}).count()
        would_have_lost = not_respected.filter(**{f"{tjf}__lte": 0, "gain_if_strategy_respected": False}).count()
    else:
        total_pnl = 0.0
        losing_trades_pnl = 0.0
        winning_trades_pnl = 0.0
        would_have_won_pnl = 0.0
        would_have_lost_pnl = 0.0
        losing_trades_count = 0
        winning_trades_count = 0
        would_have_won = 0
        would_have_lost = 0

        for item in not_respected:
            val = getattr(item, "pnl", None)
            if val is None and hasattr(item, "trade"):
                val = getattr(item.trade, "net_pnl", getattr(item.trade, "pnl", 0.0))
            pnl = float(val or 0.0)
            total_pnl += pnl
            if pnl <= 0:
                losing_trades_count += 1
                losing_trades_pnl += pnl
                if item.gain_if_strategy_respected is True:
                    would_have_won += 1
                    would_have_won_pnl += pnl
                elif item.gain_if_strategy_respected is False:
                    would_have_lost += 1
                    would_have_lost_pnl += pnl
            else:
                winning_trades_count += 1
                winning_trades_pnl += pnl

    avg_pnl = round(total_pnl / total_not_respected, 2) if total_not_respected > 0 else 0.0
    total_answered = would_have_won + would_have_lost
    unanswered = max(0, losing_trades_count - total_answered)

    would_have_won_pct = (
        round(would_have_won / total_answered * 100, 2) if total_answered > 0 else None
    )
    would_have_lost_pct = (
        round(would_have_lost / total_answered * 100, 2) if total_answered > 0 else None
    )

    return {
        "total_trades_in_period": total_trades_in_period,
        "total_not_respected": total_not_respected,
        "not_respected_rate_pct": not_respected_rate_pct,
        "total_pnl_not_respected": round(total_pnl, 2),
        "avg_pnl_not_respected": avg_pnl,
        "losing_trades_count": losing_trades_count,
        "losing_trades_pnl": round(losing_trades_pnl, 2),
        "winning_trades_count": winning_trades_count,
        "winning_trades_pnl": round(winning_trades_pnl, 2),
        "total_answered": total_answered,
        "unanswered": unanswered,
        "would_have_won": would_have_won,
        "would_have_won_pnl": round(would_have_won_pnl, 2),
        "would_have_lost": would_have_lost,
        "would_have_lost_pnl": round(would_have_lost_pnl, 2),
        "would_have_won_pct": would_have_won_pct,
        "would_have_lost_pct": would_have_lost_pct,
    }


def aggregate_emotions_by_respect(queryset) -> Dict[str, List[Dict[str, Any]]]:
    """Répartition des émotions dominantes selon respect / non-respect."""
    respected_qs = queryset.filter(strategy_respected=True)
    not_respected_qs = queryset.filter(strategy_respected=False)
    return {
        "respected": _emotion_distribution(respected_qs),
        "not_respected": _emotion_distribution(not_respected_qs),
    }
