"""Métriques de risque partagées (statistiques API, exports)."""
from __future__ import annotations

import math
import statistics
from collections import defaultdict
from datetime import date
from typing import Callable, Sequence

TRADING_DAYS_PER_YEAR = 252


def compute_sharpe_per_trade(pnl_values: Sequence[float]) -> float:
    """Sharpe simplifié : moyenne(PnL) / écart-type(PnL) — écart-type échantillon (n-1)."""
    if len(pnl_values) < 2:
        return 0.0
    std = statistics.stdev(pnl_values)
    if std <= 0:
        return 0.0
    return statistics.mean(pnl_values) / std


def aggregate_daily_pnl(
    trades_ordered: Sequence,
    user_tz,
    pnl_getter: Callable,
) -> list[tuple[date, float]]:
    """Somme des PnL par jour de trading (fuseau utilisateur)."""
    by_day: dict[date, float] = defaultdict(float)
    for trade in trades_ordered:
        entered_at = getattr(trade, 'entered_at', None)
        if not entered_at:
            continue
        day = entered_at.astimezone(user_tz).date()
        by_day[day] += float(pnl_getter(trade))
    return sorted(by_day.items())


def compute_sharpe_annualized_from_trades(
    start_balance: float,
    trades_ordered: Sequence,
    pnl_getter: Callable,
    user_tz,
) -> float:
    """
    Sharpe annualisé : moyenne(PnL journalier) / écart-type(PnL journalier) × √252.

    Les PnL sont agrégés par jour de trading (fuseau utilisateur). Cette méthode
    en dollars est cohérente avec le Sharpe par trade et évite les biais des
    rendements % sur un capital initial nul ou très élevé.

    Repli si un seul jour de trading : Sharpe par trade × √252.
    start_balance est conservé pour compatibilité d'appel (non utilisé ici).
    """
    _ = start_balance
    pnl_values = [float(pnl_getter(trade)) for trade in trades_ordered]
    if len(pnl_values) < 2:
        return 0.0

    daily_pnls = aggregate_daily_pnl(trades_ordered, user_tz, pnl_getter)
    daily_values = [pnl for _, pnl in daily_pnls]

    if len(daily_values) >= 2:
        daily_sharpe = compute_sharpe_per_trade(daily_values)
        return daily_sharpe * math.sqrt(TRADING_DAYS_PER_YEAR)

    per_trade_sharpe = compute_sharpe_per_trade(pnl_values)
    return per_trade_sharpe * math.sqrt(TRADING_DAYS_PER_YEAR)
