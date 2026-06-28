"""Agrégats discipline : gain_if_strategy_respected et émotions par bucket."""
from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, Iterable, List


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


def aggregate_gain_if_strategy_stats(queryset) -> Dict[str, Any]:
    """
    Statistiques « gain si stratégie respectée » pour les trades non respectés.
    """
    not_respected = queryset.filter(strategy_respected=False)
    total_not_respected = not_respected.count()
    answered = not_respected.exclude(gain_if_strategy_respected__isnull=True)
    would_have_won = answered.filter(gain_if_strategy_respected=True).count()
    would_have_lost = answered.filter(gain_if_strategy_respected=False).count()
    total_answered = would_have_won + would_have_lost
    unanswered = total_not_respected - total_answered

    would_have_won_pct = (
        round(would_have_won / total_answered * 100, 2) if total_answered > 0 else None
    )
    would_have_lost_pct = (
        round(would_have_lost / total_answered * 100, 2) if total_answered > 0 else None
    )

    return {
        "total_not_respected": total_not_respected,
        "total_answered": total_answered,
        "unanswered": unanswered,
        "would_have_won": would_have_won,
        "would_have_lost": would_have_lost,
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
