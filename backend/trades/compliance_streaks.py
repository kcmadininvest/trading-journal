"""
Calcul unifié des streaks de respect de stratégie (dashboard + endpoint Stratégies).
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple

from django.db import models
from django.utils import timezone

from .models import (
    DayStrategyCompliance,
    PositionStrategy,
    TopStepTrade,
    TradeStrategy,
)


def get_position_strategy_family_ids(user, position_strategy_id):
    """
    Récupère tous les IDs d'une famille de stratégies (racine + versions).
    """
    try:
        selected_strategy = PositionStrategy.objects.get(
            id=position_strategy_id,
            user=user,
        )
        root_strategy_id = selected_strategy.parent_strategy_id or selected_strategy.id
        family_ids = list(
            PositionStrategy.objects.filter(user=user).filter(
                models.Q(id=root_strategy_id) | models.Q(parent_strategy_id=root_strategy_id)
            ).values_list("id", flat=True)
        )
        return family_ids
    except PositionStrategy.DoesNotExist:
        return [position_strategy_id]


def get_rolling_twelve_month_date_range(user_tz) -> Tuple[str, str]:
    """Fenêtre glissante 12 mois pour les séries de discipline (indépendante du filtre période UI)."""
    today = timezone.now().astimezone(user_tz).date()
    start = today - timedelta(days=365)
    return start.isoformat(), today.isoformat()


MALTZ_MILESTONE_DAYS = 21

DISCIPLINE_BADGE_DEFINITIONS: List[Dict[str, Any]] = [
    {"id": "beginner", "name": "Débutant discipliné", "days": 3},
    {"id": "week", "name": "Semaine parfaite", "days": 7},
    {"id": "two_weeks", "name": "Deux semaines exemplaires", "days": 14},
    {"id": "maltz", "name": "Routine installée", "days": MALTZ_MILESTONE_DAYS},
    {"id": "month", "name": "Mois de discipline", "days": 30},
    {"id": "two_months", "name": "Maître de la discipline", "days": 60},
    {"id": "three_months", "name": "Légende de la stratégie", "days": 90},
    {"id": "centurion", "name": "Centurion", "days": 100},
    {"id": "year", "name": "Année parfaite", "days": 365},
]


def calculate_rolling_trade_compliance_rates(
    daily_compliance: Dict[str, Any],
    *,
    anchor_date: date,
    windows: Tuple[int, ...] = (7, 30, 90),
) -> Dict[str, Optional[float] | int]:
    """
    Taux de respect au niveau trade sur fenêtres glissantes (jours calendaires).

    Retourne None pour le taux d'une fenêtre sans trade évalué (strategy_respected renseigné).
    Les compteurs respectés / non respectés / total valent 0 dans ce cas.
    """
    results: Dict[str, Optional[float] | int] = {}
    for days in windows:
        start = (anchor_date - timedelta(days=days)).isoformat()
        with_strategy = 0
        respected = 0
        not_respected = 0
        for date_str, data in daily_compliance.items():
            if date_str >= start:
                with_strategy += data.get("with_strategy", 0)
                respected += data.get("respected", 0)
                not_respected += data.get("not_respected", 0)
        if with_strategy > 0:
            results[f"compliance_{days}d"] = round(respected / with_strategy * 100, 2)
        else:
            results[f"compliance_{days}d"] = None
        results[f"compliance_{days}d_respected"] = respected
        results[f"compliance_{days}d_not_respected"] = not_respected
        results[f"compliance_{days}d_total"] = with_strategy
    return results


def compute_dashboard_next_badge(current_streak: int) -> Optional[Dict[str, Any]]:
    """Prochain badge pour la carte dashboard (progression basée sur le streak actuel)."""
    for badge in DISCIPLINE_BADGE_DEFINITIONS:
        if current_streak < badge["days"]:
            progress = (current_streak / badge["days"]) * 100
            return {
                "id": badge["id"],
                "name": badge["name"],
                "days": badge["days"],
                "progress": progress,
            }
    return None


def compute_next_record_milestone(best_streak: int) -> Optional[Dict[str, Any]]:
    """
    Prochain palier record non encore atteint par best_streak (après le jalon Maltz à 21 j).
    Retourne None si tous les paliers sont atteints ou si best_streak < MALTZ_MILESTONE_DAYS.
    """
    if best_streak < MALTZ_MILESTONE_DAYS:
        return None
    for badge in DISCIPLINE_BADGE_DEFINITIONS:
        if badge["days"] <= MALTZ_MILESTONE_DAYS:
            continue
        if best_streak < badge["days"]:
            progress = (best_streak / badge["days"]) * 100
            return {
                "id": badge["id"],
                "name": badge["name"],
                "days": badge["days"],
                "progress": progress,
            }
    return None


def _day_streak_verdict(
    date_str: str,
    data: Dict[str, Any],
    day_compliances_dict: Dict[str, Any],
    *,
    forward_best_pass: bool,
) -> Optional[bool]:
    """
    Verdict discipline pour les séries : True (respecté), False (cassure), None (ignorer).

    Les jours avec trades mais stratégie non renseignée sur tous les trades sont neutres :
    ils ne prolongent pas la série mais ne la cassent pas non plus.
    """
    if data["total"] > 0:
        if data["not_respected"] > 0:
            return False
        if data["with_strategy"] == data["total"]:
            return True
        if data["has_day_compliance"]:
            compliance = day_compliances_dict.get(date_str)
            if compliance and compliance.strategy_respected is not None:
                return bool(compliance.strategy_respected is True)
        return None
    if data["has_day_compliance"]:
        if forward_best_pass:
            compliance = day_compliances_dict.get(date_str)
            return bool(compliance and compliance.strategy_respected is True)
        is_respected = data["respected"] > 0 and data["not_respected"] == 0
        compliance = day_compliances_dict.get(date_str)
        if compliance:
            is_respected = is_respected and compliance.strategy_respected is True
        return bool(is_respected)
    return None


def _get_current_streak_day_dates(
    all_dates: List[str],
    daily_compliance: Any,
    day_compliances_dict: Dict[str, Any],
) -> List[str]:
    """Jours calendaires composant la série de discipline en cours (ordre chronologique)."""
    streak_days: List[str] = []
    for date_str in reversed(all_dates):
        data = daily_compliance[date_str]
        verdict = _day_streak_verdict(
            date_str, data, day_compliances_dict, forward_best_pass=False
        )
        if verdict is True:
            streak_days.append(date_str)
        elif verdict is False:
            break
    streak_days.reverse()
    return streak_days


def _get_current_not_respect_streak_day_dates(
    all_dates: List[str],
    daily_compliance: Any,
    day_compliances_dict: Dict[str, Any],
) -> List[str]:
    """Jours calendaires composant la série de non-respect en cours (ordre chronologique)."""
    streak_days: List[str] = []
    for date_str in reversed(all_dates):
        data = daily_compliance[date_str]
        verdict = _day_streak_verdict(
            date_str, data, day_compliances_dict, forward_best_pass=False
        )
        if verdict is False:
            streak_days.append(date_str)
        elif verdict is True:
            break
    streak_days.reverse()
    return streak_days


def _count_trades_on_streak_days(
    strategies_queryset,
    streak_day_dates: List[str],
    *,
    respected: bool,
) -> int:
    """Compte les trades respectés ou non respectés sur les jours d'une série."""
    if not streak_day_dates:
        return 0
    from datetime import date as date_type

    streak_dates = [date_type.fromisoformat(d) for d in streak_day_dates]
    return strategies_queryset.filter(
        strategy_respected=respected,
        trade__trade_day__in=streak_dates,
    ).count()


def _count_respected_trades_on_streak_days(
    strategies_queryset,
    streak_day_dates: List[str],
) -> int:
    """Compte les trades respectés sur les jours de la série en cours."""
    return _count_trades_on_streak_days(
        strategies_queryset, streak_day_dates, respected=True
    )


def _get_best_streak_day_dates(
    all_dates: List[str],
    daily_compliance: Any,
    day_compliances_dict: Dict[str, Any],
) -> List[str]:
    """Jours composant la meilleure série de discipline (la plus récente en cas d'égalité)."""
    best_streak = 0
    best_streak_days: List[str] = []
    temp_streak = 0
    temp_days: List[str] = []
    for date_str in all_dates:
        data = daily_compliance[date_str]
        verdict = _day_streak_verdict(
            date_str, data, day_compliances_dict, forward_best_pass=True
        )
        if verdict is True:
            temp_days.append(date_str)
            temp_streak += 1
            if temp_streak >= best_streak:
                best_streak = temp_streak
                best_streak_days = list(temp_days)
        elif verdict is False:
            temp_streak = 0
            temp_days = []
    return best_streak_days


def _get_best_not_respect_streak_day_dates(
    all_dates: List[str],
    daily_compliance: Any,
    day_compliances_dict: Dict[str, Any],
) -> List[str]:
    """Jours composant la plus longue série de non-respect (la plus récente en cas d'égalité)."""
    best_streak = 0
    best_streak_days: List[str] = []
    temp_streak = 0
    temp_days: List[str] = []
    for date_str in all_dates:
        data = daily_compliance[date_str]
        verdict = _day_streak_verdict(
            date_str, data, day_compliances_dict, forward_best_pass=True
        )
        if verdict is False:
            temp_days.append(date_str)
            temp_streak += 1
            if temp_streak >= best_streak:
                best_streak = temp_streak
                best_streak_days = list(temp_days)
        elif verdict is True:
            temp_streak = 0
            temp_days = []
    return best_streak_days


def _compute_streaks_from_aggregates(
    all_dates: List[str],
    daily_compliance: Any,
    day_compliances_dict: Dict[str, Any],
) -> Tuple[
    int,
    int,
    Optional[str],
    List[str],
    List[str],
    List[str],
    int,
    Optional[str],
    List[str],
]:
    """Retourne streaks respect/non-respect (courants et records)."""
    best_streak_days = _get_best_streak_day_dates(
        all_dates, daily_compliance, day_compliances_dict
    )
    best_streak = len(best_streak_days)

    current_streak_days = _get_current_streak_day_dates(
        all_dates, daily_compliance, day_compliances_dict
    )
    current_streak = len(current_streak_days)
    current_streak_start = current_streak_days[0] if current_streak_days else None

    best_not_respect_streak_days = _get_best_not_respect_streak_day_dates(
        all_dates, daily_compliance, day_compliances_dict
    )

    current_not_respect_streak_days = _get_current_not_respect_streak_day_dates(
        all_dates, daily_compliance, day_compliances_dict
    )
    current_not_respect_streak = len(current_not_respect_streak_days)
    current_not_respect_streak_start = (
        current_not_respect_streak_days[0] if current_not_respect_streak_days else None
    )

    return (
        best_streak,
        current_streak,
        current_streak_start,
        current_streak_days,
        best_streak_days,
        best_not_respect_streak_days,
        current_not_respect_streak,
        current_not_respect_streak_start,
        current_not_respect_streak_days,
    )


def compute_strategy_compliance_context(
    user,
    *,
    trading_account_id: Optional[int],
    position_strategy_id: Optional[int],
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    year: Optional[str] = None,
    month: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Agrège la compliance par jour et calcule les streaks (même logique que l’endpoint Stratégies).

    Retourne notamment : strategies_queryset, current_streak, best_streak,
    current_streak_start, daily_compliance, totaux pour les taux globaux.
    """
    trades_queryset = TopStepTrade.objects.filter(trading_account__user=user)
    if trading_account_id:
        trades_queryset = trades_queryset.filter(trading_account_id=trading_account_id)
    else:
        trades_queryset = trades_queryset.exclude(trading_account__status="archived")

    if position_strategy_id:
        family_ids = get_position_strategy_family_ids(user, position_strategy_id)
        trades_queryset = trades_queryset.filter(position_strategy_id__in=family_ids)

    if start_date:
        trades_queryset = trades_queryset.filter(trade_day__gte=start_date)
    if end_date:
        trades_queryset = trades_queryset.filter(trade_day__lte=end_date)
    if year:
        trades_queryset = trades_queryset.filter(trade_day__year=int(year))
    if month:
        trades_queryset = trades_queryset.filter(trade_day__month=int(month))

    strategies_queryset = TradeStrategy.objects.filter(user=user).select_related("trade")
    if trading_account_id:
        strategies_queryset = strategies_queryset.filter(
            trade__trading_account_id=trading_account_id
        )
    else:
        strategies_queryset = strategies_queryset.exclude(
            trade__trading_account__status="archived"
        )

    if position_strategy_id:
        family_ids = get_position_strategy_family_ids(user, position_strategy_id)
        strategies_queryset = strategies_queryset.filter(
            trade__position_strategy_id__in=family_ids
        )

    if start_date:
        strategies_queryset = strategies_queryset.filter(trade__trade_day__gte=start_date)
    if end_date:
        strategies_queryset = strategies_queryset.filter(trade__trade_day__lte=end_date)
    if year:
        strategies_queryset = strategies_queryset.filter(trade__trade_day__year=int(year))
    if month:
        strategies_queryset = strategies_queryset.filter(
            trade__trade_day__month=int(month)
        )

    day_compliances_queryset = DayStrategyCompliance.objects.filter(user=user)
    if trading_account_id:
        day_compliances_queryset = day_compliances_queryset.filter(
            trading_account_id=trading_account_id
        )
    else:
        day_compliances_queryset = day_compliances_queryset.exclude(
            trading_account__status="archived"
        )

    if start_date:
        day_compliances_queryset = day_compliances_queryset.filter(date__gte=start_date)
    if end_date:
        day_compliances_queryset = day_compliances_queryset.filter(date__lte=end_date)
    if year:
        day_compliances_queryset = day_compliances_queryset.filter(date__year=int(year))
    if month:
        day_compliances_queryset = day_compliances_queryset.filter(
            date__month=int(month)
        )

    strategies_dict = {s.trade_id: s for s in strategies_queryset}

    day_compliances_dict: Dict[str, Any] = {}
    for compliance in day_compliances_queryset:
        date_str = compliance.date.isoformat()
        if date_str not in day_compliances_dict:
            day_compliances_dict[date_str] = compliance
        elif compliance.created_at > day_compliances_dict[date_str].created_at:
            day_compliances_dict[date_str] = compliance

    daily_compliance: defaultdict = defaultdict(
        lambda: {
            "total": 0,
            "with_strategy": 0,
            "respected": 0,
            "not_respected": 0,
            "has_day_compliance": False,
        }
    )
    all_dates: List[str] = []

    for trade in trades_queryset:
        if trade.trade_day:
            date_str = trade.trade_day.isoformat()
            daily_compliance[date_str]["total"] += 1
            strategy = strategies_dict.get(trade.id)
            if strategy and strategy.strategy_respected is not None:
                daily_compliance[date_str]["with_strategy"] += 1
                if strategy.strategy_respected:
                    daily_compliance[date_str]["respected"] += 1
                else:
                    daily_compliance[date_str]["not_respected"] += 1
            if date_str not in all_dates:
                all_dates.append(date_str)

    for date_str, compliance in day_compliances_dict.items():
        if compliance.strategy_respected is not None:
            if date_str not in all_dates:
                all_dates.append(date_str)
            daily_compliance[date_str]["has_day_compliance"] = True
            if daily_compliance[date_str]["total"] == 0:
                daily_compliance[date_str]["with_strategy"] += 1
                if compliance.strategy_respected:
                    daily_compliance[date_str]["respected"] += 1
                else:
                    daily_compliance[date_str]["not_respected"] += 1

    all_dates.sort()

    (
        best_streak,
        current_streak,
        current_streak_start,
        current_streak_days,
        best_streak_days,
        best_not_respect_streak_days,
        current_not_respect_streak,
        current_not_respect_streak_start,
        current_not_respect_streak_days,
    ) = _compute_streaks_from_aggregates(all_dates, daily_compliance, day_compliances_dict)
    current_streak_trades = _count_respected_trades_on_streak_days(
        strategies_queryset, current_streak_days
    )
    best_streak_trades = _count_respected_trades_on_streak_days(
        strategies_queryset, best_streak_days
    )
    best_not_respect_streak = len(best_not_respect_streak_days)
    best_not_respect_streak_trades = _count_trades_on_streak_days(
        strategies_queryset, best_not_respect_streak_days, respected=False
    )
    current_not_respect_streak_trades = _count_trades_on_streak_days(
        strategies_queryset, current_not_respect_streak_days, respected=False
    )

    total_trades_with_strategy = sum(d["with_strategy"] for d in daily_compliance.values())
    total_respected = sum(d["respected"] for d in daily_compliance.values())
    total_not_respected = sum(d["not_respected"] for d in daily_compliance.values())

    return {
        "strategies_queryset": strategies_queryset,
        "trades_queryset": trades_queryset,
        "strategies_dict": strategies_dict,
        "day_compliances_dict": day_compliances_dict,
        "daily_compliance": daily_compliance,
        "all_dates": all_dates,
        "best_streak": best_streak,
        "best_streak_trades": best_streak_trades,
        "current_streak": current_streak,
        "current_streak_start": current_streak_start,
        "current_streak_trades": current_streak_trades,
        "best_not_respect_streak": best_not_respect_streak,
        "best_not_respect_streak_trades": best_not_respect_streak_trades,
        "current_not_respect_streak": current_not_respect_streak,
        "current_not_respect_streak_start": current_not_respect_streak_start,
        "current_not_respect_streak_trades": current_not_respect_streak_trades,
        "total_trades_with_strategy": total_trades_with_strategy,
        "total_respected": total_respected,
        "total_not_respected": total_not_respected,
    }
