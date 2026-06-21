"""Calcul legacy analytics (extrait de views.py — sémantique inchangée)."""
from __future__ import annotations

from collections import defaultdict
from datetime import timedelta
from typing import Any, Dict

from ..fx_conversion import make_pnl_getters, resolve_fx_pnl_resolver
from ..services.behavior_discipline import compute_behavior_discipline, empty_behavior_discipline
from ..services.post_loss_sizing import compute_post_loss_sizing, empty_post_loss_sizing
from ..services.post_win_sizing import compute_post_win_sizing, empty_post_win_sizing
from ..timezone_utils import get_user_timezone

EMPTY_ANALYTICS_PAYLOAD: Dict[str, Any] = {
    'daily_stats': {
        'avg_gain_per_day': 0.0,
        'median_gain_per_day': 0.0,
        'avg_loss_per_day': 0.0,
        'median_loss_per_day': 0.0,
        'max_gain_per_day': 0.0,
        'max_loss_per_day': 0.0,
        'avg_trades_per_day': 0.0,
        'median_trades_per_day': 0.0,
        'days_with_profit': 0,
        'days_with_loss': 0,
        'days_break_even': 0,
        'best_day': None,
        'best_day_pnl': 0.0,
        'worst_day': None,
        'worst_day_pnl': 0.0,
    },
    'trade_stats': {
        'max_gain_per_trade': 0.0,
        'max_loss_per_trade': 0.0,
        'avg_winning_trade': 0.0,
        'median_winning_trade': 0.0,
        'avg_losing_trade': 0.0,
        'median_losing_trade': 0.0,
        'avg_duration_winning_trade': '00:00:00',
        'avg_duration_losing_trade': '00:00:00',
    },
    'consecutive_stats': {
        'max_consecutive_wins_per_day': 0,
        'max_consecutive_losses_per_day': 0,
        'max_consecutive_wins': 0,
        'max_consecutive_losses': 0,
    },
    'trade_type_stats': {
        'long_percentage': 0.0,
        'short_percentage': 0.0,
        'long_count': 0,
        'short_count': 0,
    },
    'monthly_performance': [],
    'post_loss_sizing': empty_post_loss_sizing(),
    'post_win_sizing': empty_post_win_sizing(),
    'behavior_discipline': empty_behavior_discipline(),
}


def compute_analytics_payload(request, trades, pf: str) -> Dict[str, Any]:
    """Calcule le payload analytics identique à l'ancien views.analytics."""
    
    if not trades.exists():
        import copy
        return copy.deepcopy(EMPTY_ANALYTICS_PAYLOAD)
    fx_resolver = resolve_fx_pnl_resolver(request, trades)
    pnl_dec, pnl_flt = make_pnl_getters(fx_resolver, pf)
    pnl_float_fn = pnl_flt if fx_resolver else None
    post_loss_sizing = compute_post_loss_sizing(trades, pf, pnl_float_fn=pnl_float_fn)
    post_win_sizing = compute_post_win_sizing(trades, pf, pnl_float_fn=pnl_float_fn)
    # Utiliser le timezone de l'utilisateur
    user_tz = get_user_timezone(request)
    trades_list = list(trades.select_related('trading_account'))
    # Agréger par jour
    daily_data = defaultdict(lambda: {'pnl': 0.0, 'trade_count': 0, 'trades': []})  # type: ignore
    for trade in trades_list:
        day_key = trade.entered_at.astimezone(user_tz).date()
        daily_data[day_key]['pnl'] += pnl_flt(trade)  # type: ignore
        daily_data[day_key]['trade_count'] += 1  # type: ignore
        daily_data[day_key]['trades'].append(trade)  # type: ignore

    # Calculer les statistiques quotidiennes
    daily_pnls = [data['pnl'] for data in daily_data.values()]  # type: ignore
    daily_gains = [pnl for pnl in daily_pnls if pnl > 0]  # type: ignore
    daily_losses = [pnl for pnl in daily_pnls if pnl < 0]  # type: ignore
    daily_trade_counts = [data['trade_count'] for data in daily_data.values()]  # type: ignore

    # Statistiques par trade
    winning_trades = [pnl_flt(trade) for trade in trades_list if pnl_flt(trade) > 0]
    losing_trades = [pnl_flt(trade) for trade in trades_list if pnl_flt(trade) < 0]
    all_trade_pnls = [pnl_flt(trade) for trade in trades_list]
    
    # Calculer les durées moyennes des trades gagnants et perdants
    def _avg_duration_for_sign(positive: bool):
        durations = [
            t.trade_duration
            for t in trades_list
            if t.trade_duration is not None
            and ((pnl_flt(t) > 0) if positive else (pnl_flt(t) < 0))
        ]
        if not durations:
            return None
        total_seconds = sum(d.total_seconds() for d in durations)
        from datetime import timedelta
        return timedelta(seconds=total_seconds / len(durations))

    winning_trades_duration = _avg_duration_for_sign(True)
    losing_trades_duration = _avg_duration_for_sign(False)
    
    # Convertir les durées en format HH:MM:SS
    def format_duration(timedelta_obj):
        if timedelta_obj is None:
            return "00:00:00"
        total_seconds = int(timedelta_obj.total_seconds())
        hours, remainder = divmod(total_seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    
    avg_duration_winning_trade = format_duration(winning_trades_duration)
    avg_duration_losing_trade = format_duration(losing_trades_duration)
    
    # Calculer les pourcentages de trades Long vs Short
    long_trades_count = trades.filter(trade_type='Long').count()
    short_trades_count = trades.filter(trade_type='Short').count()
    total_trades_with_type = long_trades_count + short_trades_count
    
    long_percentage = (long_trades_count / total_trades_with_type * 100) if total_trades_with_type > 0 else 0.0
    short_percentage = (short_trades_count / total_trades_with_type * 100) if total_trades_with_type > 0 else 0.0

    # Calculer les séquences consécutives de jours (seulement les jours avec trades)
    # La consécutivité est basée sur les jours avec trades, pas sur les jours calendaires
    max_consecutive_wins_per_day = 0
    max_consecutive_losses_per_day = 0
    
    # Trier les jours par date (seulement les jours avec trades)
    sorted_days = sorted(daily_data.keys())
    
    current_consecutive_wins_days = 0
    current_consecutive_losses_days = 0
    
    for day_key in sorted_days:
        day_data = daily_data[day_key]
        day_pnl = day_data['pnl']
        
        # S'assurer que day_pnl est un nombre (float ou int)
        if isinstance(day_pnl, (int, float)):
            if day_pnl > 0:
                # Jour gagnant (P/L positif)
                current_consecutive_wins_days += 1
                current_consecutive_losses_days = 0
                max_consecutive_wins_per_day = max(max_consecutive_wins_per_day, current_consecutive_wins_days)
            elif day_pnl < 0:
                # Jour perdant (P/L négatif)
                current_consecutive_losses_days += 1
                current_consecutive_wins_days = 0
                max_consecutive_losses_per_day = max(max_consecutive_losses_per_day, current_consecutive_losses_days)
            else:
                # Jour break-even (P/L = 0) - interrompt les séquences
                current_consecutive_wins_days = 0
                current_consecutive_losses_days = 0

    # Calculer les séquences consécutives globales (tous les trades)
    trades_sorted = sorted(trades_list, key=lambda t: t.entered_at)
    max_consecutive_wins = 0
    max_consecutive_losses = 0
    current_consecutive_wins = 0
    current_consecutive_losses = 0
    
    for trade in trades_sorted:
        tpv = pnl_flt(trade)
        if tpv > 0:
            # Trade gagnant
            current_consecutive_wins += 1
            current_consecutive_losses = 0
            max_consecutive_wins = max(max_consecutive_wins, current_consecutive_wins)
        elif tpv < 0:
            # Trade perdant
            current_consecutive_losses += 1
            current_consecutive_wins = 0
            max_consecutive_losses = max(max_consecutive_losses, current_consecutive_losses)
        else:
            # Trade break-even (P/L = 0) - interrompt les séquences
            current_consecutive_wins = 0
            current_consecutive_losses = 0

    # Fonction pour calculer la médiane
    def calculate_median(values):
        if not values:
            return 0.0
        sorted_values = sorted(values)
        n = len(sorted_values)
        if n % 2 == 0:
            return (sorted_values[n//2 - 1] + sorted_values[n//2]) / 2
        else:
            return sorted_values[n//2]

    # Days with Profit / Days with Loss
    # Filtrer pour ne garder que les valeurs numériques
    numeric_pnls = [pnl for pnl in daily_pnls if isinstance(pnl, (int, float))]
    days_with_profit = len([pnl for pnl in numeric_pnls if pnl > 0])
    days_with_loss = len([pnl for pnl in numeric_pnls if pnl < 0])
    days_break_even = len([pnl for pnl in numeric_pnls if pnl == 0])
    
    # Best Day / Worst Day avec dates
    best_day = None
    worst_day = None
    best_day_pnl = 0.0
    worst_day_pnl = 0.0
    
    for day_key, day_data in daily_data.items():
        day_pnl = day_data['pnl']
        # S'assurer que day_pnl est un nombre avant de comparer
        if isinstance(day_pnl, (int, float)):
            if day_pnl > best_day_pnl:
                best_day_pnl = day_pnl
                best_day = day_key.isoformat()
            if day_pnl < worst_day_pnl:
                worst_day_pnl = day_pnl
                worst_day = day_key.isoformat()
    
    # Monthly Performance (mois calendaire dans le fuseau utilisateur)
    monthly_performance = {}
    for trade in trades_list:
        month_key = trade.entered_at.astimezone(user_tz).strftime('%Y-%m')
        if month_key not in monthly_performance:
            monthly_performance[month_key] = 0.0
        monthly_performance[month_key] += pnl_flt(trade)
    
    # Convertir en liste triée
    monthly_list = [
        {'month': month, 'pnl': pnl}
        for month, pnl in sorted(monthly_performance.items())
    ]

    analytics_payload = {
    'daily_stats': {
        'avg_gain_per_day': sum(daily_gains) / len(daily_gains) if daily_gains else 0.0,  # type: ignore
        'median_gain_per_day': calculate_median(daily_gains),
        'avg_loss_per_day': sum(daily_losses) / len(daily_losses) if daily_losses else 0.0,  # type: ignore
        'median_loss_per_day': calculate_median(daily_losses),
        'max_gain_per_day': max(daily_gains) if daily_gains else 0.0,  # type: ignore
        'max_loss_per_day': min(daily_losses) if daily_losses else 0.0,  # type: ignore
        'avg_trades_per_day': sum(daily_trade_counts) / len(daily_trade_counts) if daily_trade_counts else 0.0,  # type: ignore
        'median_trades_per_day': calculate_median(daily_trade_counts),
        'days_with_profit': days_with_profit,
        'days_with_loss': days_with_loss,
        'days_break_even': days_break_even,
        'best_day': best_day,
        'best_day_pnl': best_day_pnl,
        'worst_day': worst_day,
        'worst_day_pnl': worst_day_pnl,
    },
    'trade_stats': {
        'max_gain_per_trade': max(winning_trades) if winning_trades else 0.0,
        'max_loss_per_trade': min(losing_trades) if losing_trades else 0.0,
        'avg_winning_trade': sum(winning_trades) / len(winning_trades) if winning_trades else 0.0,
        'median_winning_trade': calculate_median(winning_trades),
        'avg_losing_trade': sum(losing_trades) / len(losing_trades) if losing_trades else 0.0,
        'median_losing_trade': calculate_median(losing_trades),
        'avg_duration_winning_trade': avg_duration_winning_trade,
        'avg_duration_losing_trade': avg_duration_losing_trade,
    },
    'consecutive_stats': {
        'max_consecutive_wins_per_day': max_consecutive_wins_per_day,
        'max_consecutive_losses_per_day': max_consecutive_losses_per_day,
        'max_consecutive_wins': max_consecutive_wins,
        'max_consecutive_losses': max_consecutive_losses,
    },
    'trade_type_stats': {
        'long_percentage': round(long_percentage, 2),
        'short_percentage': round(short_percentage, 2),
        'long_count': long_trades_count,
        'short_count': short_trades_count,
    },
    'monthly_performance': monthly_list,
    'post_loss_sizing': post_loss_sizing,
    'post_win_sizing': post_win_sizing,
    'behavior_discipline': compute_behavior_discipline(
        daily_data, trades, pf, pnl_float_fn=pnl_float_fn
    ),
    }
    return analytics_payload
