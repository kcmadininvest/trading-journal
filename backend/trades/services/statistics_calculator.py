"""Calcul legacy des statistiques (extrait de views.py — sémantique inchangée)."""
from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict

import pytz
from django.db.models import (
    Avg,
    Count,
    DecimalField,
    Exists,
    ExpressionWrapper,
    F,
    Max,
    Min,
    OuterRef,
    Q,
    Sum,
    Value,
)
from django.db.models.functions import Coalesce
from django.utils import timezone

from ..fx_conversion import (
    aggregate_monetary_from_trades,
    combined_initial_capital_in_base,
    make_pnl_getters,
    resolve_fx_pnl_resolver,
    sum_converted_pnl_for_queryset,
)
from ..models import ImportedTrade, TradeStrategy, TradingAccount
from ..risk_metrics import compute_sharpe_annualized_from_trades, compute_sharpe_per_trade
from ..serializers import TradeStatisticsSerializer
from ..statistics_temporal import compute_avg_daily_exposure_time, compute_avg_time_between_trades
from ..timezone_utils import get_user_timezone

logger = logging.getLogger(__name__)

EMPTY_STATISTICS_PAYLOAD: Dict[str, Any] = {
    'total_trades': 0,
    'winning_trades': 0,
    'losing_trades': 0,
    'win_rate': 0,
    'total_pnl': 0,
    'total_net_pnl': 0,
    'total_gains': 0,
    'total_losses': 0,
    'average_pnl': 0,
    'best_trade': 0,
    'worst_trade': 0,
    'total_fees': 0,
    'total_volume': 0,
    'average_duration': '00:00:00',
    'most_traded_contract': None,
    'profit_factor': 0,
    'win_loss_ratio': 0,
    'consistency_ratio': 0,
    'recovery_ratio': 0,
    'pnl_per_trade': 0,
    'fees_ratio': 0,
    'volume_pnl_ratio': 0,
    'frequency_ratio': 0,
    'duration_ratio': 0,
    'avg_time_between_trades': '00:00:00',
    'avg_daily_exposure_time': '00:00:00',
    'recovery_time': 0,
    'max_drawdown': 0.0,
    'max_drawdown_pct': 0.0,
    'max_drawdown_global': 0.0,
    'max_drawdown_global_pct': 0.0,
    'max_runup': 0.0,
    'max_runup_pct': 0.0,
    'max_runup_global': 0.0,
    'max_runup_global_pct': 0.0,
    'expectancy': 0.0,
    'break_even_trades': 0,
    'break_even_zero_trades': 0,
    'break_even_positive_trades': 0,
    'sharpe_ratio': 0.0,
    'sharpe_ratio_annualized': 0.0,
    'sortino_ratio': 0.0,
    'calmar_ratio': 0.0,
    'trade_efficiency': 0.0,
    'current_winning_streak_days': 0,
    'avg_planned_rr': 0.0,
    'avg_actual_rr': 0.0,
    'trades_with_planned_rr': 0,
    'trades_with_actual_rr': 0,
    'trades_with_both_rr': 0,
    'plan_respect_rate': 0.0,
}


def compute_statistics_payload(request, trades, pf: str) -> Dict[str, Any]:
    """Calcule le payload statistics identique à l'ancien views.statistics."""
    
    if not trades.exists():
        return EMPTY_STATISTICS_PAYLOAD.copy()

    user_tz = get_user_timezone(request)
    fx_resolver = resolve_fx_pnl_resolver(request, trades)
    pnl_dec, pnl_flt = make_pnl_getters(fx_resolver, pf)

    # Agrégations frais/volume (non convertis en FX ; PnL converti ci-dessous si multi-devises)
    _zero_money = Value(Decimal('0'), output_field=DecimalField(max_digits=20, decimal_places=9))
    _effective_fees = ExpressionWrapper(
        Coalesce(F('fees'), _zero_money) + Coalesce(F('commissions'), _zero_money),
        output_field=DecimalField(max_digits=20, decimal_places=9),
    )
    aggregates = trades.aggregate(
        total_pnl=Sum(pf),
        average_pnl=Avg(pf),
        total_fees=Sum(_effective_fees),
        total_volume=Sum('size'),
        total_raw_pnl=Sum('pnl'),
        total_net_pnl=Sum('net_pnl'),
    )

    if fx_resolver:
        trades_list = list(trades.select_related('trading_account'))
        monetary = aggregate_monetary_from_trades(trades_list, pnl_dec)
        total_trades = monetary['total_trades']
        winning_trades = monetary['winning_trades']
        losing_trades = monetary['losing_trades']
        total_gains = monetary['total_gains']
        total_losses = monetary['total_losses']
        best_trade = monetary['best_trade']
        worst_trade = monetary['worst_trade']
        aggregates['total_pnl'] = monetary['total_pnl']
        aggregates['average_pnl'] = monetary['average_pnl']
    else:
        total_trades = trades.count()
        winning_trades = trades.filter(**{f'{pf}__gt': 0}).count()
        losing_trades = trades.filter(**{f'{pf}__lt': 0}).count()
        best_trade = trades.filter(**{f'{pf}__gt': 0}).aggregate(best=Max(pf))['best']
        if best_trade is None:
            best_trade = Decimal('0')
        worst_trade = trades.filter(**{f'{pf}__lt': 0}).aggregate(worst=Min(pf))['worst']
        if worst_trade is None:
            worst_trade = Decimal('0')
        winning_trades_aggregate = trades.filter(**{f'{pf}__gt': 0}).aggregate(
            total_gains=Sum(pf)
        )
        losing_trades_aggregate = trades.filter(**{f'{pf}__lt': 0}).aggregate(
            total_losses=Sum(pf)
        )
        total_gains = winning_trades_aggregate['total_gains'] or Decimal('0')
        total_losses = losing_trades_aggregate['total_losses'] or Decimal('0')

    win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0
    trades_ordered = list(trades.select_related('trading_account').order_by('entered_at'))
    
    # Calculs des ratios
    # 1. Profit Factor
    # Ratio des gains totaux sur les pertes totales (en valeur absolue)
    profit_factor = 0
    if total_losses != 0:
        profit_factor = abs(total_gains) / abs(total_losses)
    
    # 2. Ratio Win/Loss
    win_loss_ratio = 0
    if losing_trades > 0:
        win_loss_ratio = winning_trades / losing_trades
    
    # 3. Ratio de Consistance (taux de réussite)
    consistency_ratio = win_rate
    
    # 4. Ratio de Récupération
    # Ratio du meilleur trade sur le pire trade (en valeur absolue)
    recovery_ratio = 0
    if worst_trade and best_trade:
        if worst_trade != 0:
            recovery_ratio = abs(best_trade) / abs(worst_trade)
    
    # 5. Ratio P/L par Trade
    pnl_per_trade = 0
    if total_trades > 0:
        pnl_per_trade = aggregates['total_pnl'] / total_trades
    
    # 6. Ratio de Frais (coût total frais+commissions vs P/L net en valeur absolue)
    # Le ratio représente le pourcentage des frais par rapport au P/L (en valeur absolue)
    # Cela permet d'avoir un ratio cohérent même quand le P/L est négatif
    fees_ratio = 0
    if aggregates['total_pnl'] and aggregates['total_pnl'] != 0:
        fees_ratio = abs(aggregates['total_fees']) / abs(aggregates['total_pnl'])
    
    # 7. Ratio Volume/P/L
    volume_pnl_ratio = 0
    if aggregates['total_volume'] and aggregates['total_volume'] != 0:
        volume_pnl_ratio = aggregates['total_pnl'] / aggregates['total_volume']
    
    # 8. Ratio de Fréquence (trades par jour, fuseau horaire utilisateur)
    frequency_ratio = 0
    if total_trades > 0:
        unique_days = len({
            entered_at.astimezone(user_tz).date()
            for entered_at in trades.values_list('entered_at', flat=True)
            if entered_at
        })
        if unique_days > 0:
            frequency_ratio = total_trades / unique_days
    
    # 9. Ratio de Durée (nécessite des calculs supplémentaires)
    duration_ratio = 0
    winning_trades_duration = trades.filter(**{f'{pf}__gt': 0}, trade_duration__isnull=False).aggregate(
        avg_duration=Avg('trade_duration')
    )['avg_duration']
    losing_trades_duration = trades.filter(**{f'{pf}__lt': 0}, trade_duration__isnull=False).aggregate(
        avg_duration=Avg('trade_duration')
    )['avg_duration']
    
    if winning_trades_duration and losing_trades_duration:
        winning_seconds = winning_trades_duration.total_seconds()
        losing_seconds = losing_trades_duration.total_seconds()
        if losing_seconds > 0:
            duration_ratio = winning_seconds / losing_seconds

    temporal_rows = list(trades.values('entered_at', 'exited_at', 'trade_day', 'trade_duration'))
    avg_time_between_trades = compute_avg_time_between_trades(temporal_rows, user_tz)
    avg_daily_exposure_time = compute_avg_daily_exposure_time(temporal_rows, user_tz)

    # 10. Recovery Time (temps moyen de récupération en trades)
    # Calcul du temps nécessaire pour revenir au niveau précédent après un drawdown
    recovery_time = 0
    if trades.exists():
        trades_ordered = list(trades.order_by('entered_at'))
        cumulative_capital = Decimal('0')
        peak_capital = Decimal('0')
        recovery_times = []
        drawdown_start_index = None
        drawdown_peak_value = Decimal('0')
        current_drawdown_start = None
        
        for idx, trade in enumerate(trades_ordered):
            cumulative_capital += pnl_dec(trade)
            
            # Si on dépasse ou égale le pic précédent, on a récupéré
            if cumulative_capital >= peak_capital:
                # Si on était en drawdown, calculer le temps de récupération
                if drawdown_start_index is not None:
                    recovery_trades = idx - drawdown_start_index
                    if recovery_trades > 0:
                        recovery_times.append(recovery_trades)
                    drawdown_start_index = None
                    drawdown_peak_value = Decimal('0')
                
                # Mettre à jour le pic si on a un nouveau pic
                if cumulative_capital > peak_capital:
                    peak_capital = cumulative_capital
                    current_drawdown_start = None  # Réinitialiser le drawdown actuel
            # Si on est en drawdown (en dessous du pic)
            elif cumulative_capital < peak_capital:
                if drawdown_start_index is None:
                    drawdown_start_index = idx
                    drawdown_peak_value = peak_capital
                # Garder trace du drawdown actuel (le plus récent)
                if current_drawdown_start is None:
                    current_drawdown_start = idx
        
        # Calculer la moyenne des temps de récupération
        if recovery_times:
            recovery_time = sum(recovery_times) / len(recovery_times)
        # Si on est toujours en drawdown et qu'on n'a aucune récupération, 
        # on peut retourner le temps depuis le début du drawdown actuel
        # Mais pour l'instant, on retourne 0 si aucune récupération n'a eu lieu
    
    # Durée moyenne
    avg_duration = trades.filter(trade_duration__isnull=False).aggregate(
        avg=Avg('trade_duration')
    )['avg']
    
    if avg_duration:
        total_seconds = int(avg_duration.total_seconds())
        hours, remainder = divmod(total_seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        avg_duration_str = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    else:
        avg_duration_str = "00:00:00"
    
    # Contrat le plus tradé
    most_traded = trades.values('contract_name').annotate(
        count=Count('id')
    ).order_by('-count').first()
    
    # 11. Maximum Drawdown (MDD) - Fonction helper
    def calculate_max_drawdown(trades_queryset, initial_capital=None):
        """
        Calcule le maximum drawdown pour un queryset de trades donné.
        Utilise le capital initial si fourni, sinon utilise 0 comme référence.
        Retourne (max_dd_absolu, max_dd_pourcentage, peak_capital)
        """
        max_dd = Decimal('0')
        peak_capital = Decimal('0')
        if trades_queryset.exists():
            # Récupérer le capital initial du compte si non fourni
            if initial_capital is None:
                # Essayer de récupérer le capital initial du premier trade
                first_trade = trades_queryset.first()
                if first_trade and first_trade.trading_account:
                    initial_capital = first_trade.trading_account.initial_capital or Decimal('0')
                else:
                    initial_capital = Decimal('0')
            else:
                initial_capital = Decimal(str(initial_capital))
            
            trades_ordered = trades_queryset.order_by('entered_at')
            cumulative_pnl = Decimal('0')
            peak_capital = initial_capital  # Le pic commence au capital initial
            
            for trade in trades_ordered:
                cumulative_pnl += pnl_dec(trade)
                current_capital = initial_capital + cumulative_pnl
                
                # Mettre à jour le pic si on dépasse le pic précédent
                if current_capital > peak_capital:
                    peak_capital = current_capital
                
                # Calculer le drawdown absolu seulement si on est en dessous du pic
                if current_capital < peak_capital:
                    # Drawdown absolu : différence entre le pic et la valeur actuelle
                    current_dd = peak_capital - current_capital
                    
                    if current_dd > max_dd:
                        max_dd = current_dd
        
        # Calculer le pourcentage de drawdown
        max_dd_pct = 0.0
        if peak_capital > 0 and max_dd > 0:
            max_dd_pct = float((max_dd / peak_capital) * 100)
        
        return (float(max_dd), max_dd_pct, float(peak_capital))
    
    # 11b. Maximum Run-up (MRU) - Fonction helper
    def calculate_max_runup(trades_queryset, initial_capital=None):
        """
        Calcule le maximum run-up pour un queryset de trades donné.
        Le run-up est la plus grande hausse depuis un point bas (inverse du drawdown).
        Retourne (max_ru_absolu, max_ru_pourcentage, trough_capital)
        """
        max_ru = Decimal('0')
        trough_capital = Decimal('0')
        trough_at_runup = Decimal('0')  # Le creux au moment du max run-up
        
        if trades_queryset.exists():
            # Récupérer le capital initial du compte si non fourni
            if initial_capital is None:
                # Essayer de récupérer le capital initial du premier trade
                first_trade = trades_queryset.first()
                if first_trade and first_trade.trading_account:
                    initial_capital = first_trade.trading_account.initial_capital or Decimal('0')
                else:
                    initial_capital = Decimal('0')
            else:
                initial_capital = Decimal(str(initial_capital))
            
            trades_ordered = trades_queryset.order_by('entered_at')
            cumulative_pnl = Decimal('0')
            trough_capital = initial_capital  # Le creux commence au capital initial
            peak_since_trough = initial_capital  # Le pic depuis le dernier creux
            
            for trade in trades_ordered:
                cumulative_pnl += pnl_dec(trade)
                current_capital = initial_capital + cumulative_pnl
                
                # Si on descend en dessous du creux actuel, c'est un nouveau creux
                if current_capital < trough_capital:
                    # Avant de mettre à jour le creux, calculer le run-up depuis l'ancien creux
                    if peak_since_trough > trough_capital:
                        current_ru = peak_since_trough - trough_capital
                        if current_ru > max_ru:
                            max_ru = current_ru
                            trough_at_runup = trough_capital
                    
                    # Nouveau creux, réinitialiser le pic
                    trough_capital = current_capital
                    peak_since_trough = current_capital
                else:
                    # Mettre à jour le pic depuis le dernier creux
                    if current_capital > peak_since_trough:
                        peak_since_trough = current_capital
                        # Calculer le run-up à chaque fois qu'on met à jour le pic
                        current_ru = peak_since_trough - trough_capital
                        if current_ru > max_ru:
                            max_ru = current_ru
                            trough_at_runup = trough_capital
            
            # Calculer le run-up final depuis le dernier creux
            if peak_since_trough > trough_capital:
                current_ru = peak_since_trough - trough_capital
                if current_ru > max_ru:
                    max_ru = current_ru
                    trough_at_runup = trough_capital
        
        # Calculer le pourcentage de run-up
        max_ru_pct = 0.0
        if max_ru > 0:
            # Utiliser le creux au moment du max run-up pour le calcul du pourcentage
            if trough_at_runup > 0:
                max_ru_pct = float((max_ru / trough_at_runup) * 100)
            elif trough_at_runup < 0:
                # Si le creux est négatif, on calcule le pourcentage par rapport à la valeur absolue
                max_ru_pct = float((max_ru / abs(trough_at_runup)) * 100)
            else:
                # Si le creux est 0, on utilise le capital initial comme référence
                if initial_capital and initial_capital > 0:
                    max_ru_pct = float((max_ru / initial_capital) * 100)
        
        return (float(max_ru), max_ru_pct, float(trough_at_runup if max_ru > 0 else trough_capital))
    
    # Récupérer le capital initial du compte si un compte est sélectionné
    trading_account_id = request.query_params.get('trading_account', None)
    initial_capital = None
    if fx_resolver:
        account_id_int = None
        if trading_account_id:
            try:
                account_id_int = int(trading_account_id)
            except (ValueError, TypeError):
                account_id_int = None
        initial_capital = combined_initial_capital_in_base(
            request.user, account_id_int, fx_resolver
        )
    elif trading_account_id:
        try:
            account = TradingAccount.objects.get(id=trading_account_id, user=request.user)  # type: ignore
            initial_capital = account.initial_capital
        except TradingAccount.DoesNotExist:  # type: ignore
            pass
    
    # Si pas de capital initial trouvé, essayer de le récupérer du premier trade
    if initial_capital is None and trades.exists():
        first_trade = trades.first()
        if first_trade and first_trade.trading_account:
            initial_capital = first_trade.trading_account.initial_capital
    
    # Si toujours None, utiliser 0 comme valeur par défaut
    if initial_capital is None:
        initial_capital = Decimal('0')
    
    # Calculer le capital au début de la période filtrée (si des filtres de date sont appliqués)
    # Pour cela, on additionne le PnL de tous les trades avant la période filtrée
    period_start_capital = initial_capital
    if trades.exists():
        # Déterminer la date de début de la période filtrée
        start_datetime = None
        start_date = request.query_params.get('start_date', None)
        year = request.query_params.get('year', None)
        month = request.query_params.get('month', None)
        
        if start_date:
            # Utiliser start_date si fourni
            try:
                start_datetime = datetime.strptime(start_date, '%Y-%m-%d')
                user_tz = get_user_timezone(request)
                start_datetime = user_tz.localize(start_datetime)
            except ValueError:
                pass
        elif year:
            # Utiliser year/month si fourni
            try:
                year_int = int(year)
                if month:
                    month_int = int(month)
                    start_datetime = timezone.datetime(year_int, month_int, 1)
                else:
                    start_datetime = timezone.datetime(year_int, 1, 1)
                user_tz = get_user_timezone(request)
                start_datetime = user_tz.localize(start_datetime)
            except (ValueError, TypeError):
                pass
        else:
            # Si aucun filtre de date explicite, utiliser la date du premier trade filtré
            # pour déterminer s'il y a des trades avant
            first_trade = trades.order_by('entered_at').first()
            if first_trade:
                start_datetime = first_trade.entered_at
        
        # Si on a une date de début, calculer le capital au début de la période
        if start_datetime:
            try:
                # Calculer le PnL cumulé de tous les trades avant la période filtrée
                trades_before_period = (
                    ImportedTrade.objects
                    .filter(user=request.user)  # type: ignore
                )
                if trading_account_id:
                    trades_before_period = trades_before_period.filter(trading_account_id=trading_account_id)
                trades_before_period = trades_before_period.filter(entered_at__lt=start_datetime)
                
                if fx_resolver:
                    pnl_before_period = sum_converted_pnl_for_queryset(
                        trades_before_period, pnl_dec
                    )
                else:
                    pnl_before_period = (
                        trades_before_period.aggregate(total=Sum(pf))['total'] or Decimal('0')
                    )
                period_start_capital = initial_capital + pnl_before_period
            except (ValueError, TypeError) as e:
                logger.warning(f"Erreur lors du calcul du capital de début de période: {str(e)}")
                period_start_capital = initial_capital
            except Exception as e:
                logger.error(f"Erreur inattendue lors du calcul du capital: {str(e)}", exc_info=True)
                period_start_capital = initial_capital
    
    # Max drawdown de la période (avec filtres de date)
    max_drawdown, max_drawdown_pct, peak_capital = calculate_max_drawdown(trades, period_start_capital)
    
    # Max drawdown global (sans filtres de date, mais avec les autres filtres comme le compte)
    # Créer un queryset global en gardant les filtres de compte mais sans les filtres de date
    global_trades = (
        ImportedTrade.objects
        .filter(user=request.user)  # type: ignore
        .select_related('trading_account', 'user')
    )
    
    # Appliquer le filtre de compte de trading si présent
    if trading_account_id:
        global_trades = global_trades.filter(trading_account_id=trading_account_id)
    
    max_drawdown_global, max_drawdown_global_pct, peak_capital_global = calculate_max_drawdown(global_trades, initial_capital)
    
    # Max run-up de la période (avec filtres de date) - utiliser le capital au début de la période
    try:
        max_runup, max_runup_pct, trough_capital = calculate_max_runup(trades, period_start_capital)
    except Exception as e:
        logger.error(f"Erreur calcul max_runup période: {e}")
        max_runup, max_runup_pct, trough_capital = (0.0, 0.0, 0.0)
    
    # Max run-up global (sans filtres de date, mais avec les autres filtres comme le compte)
    try:
        max_runup_global, max_runup_global_pct, trough_capital_global = calculate_max_runup(global_trades, initial_capital)
    except Exception as e:
        logger.error(f"Erreur calcul max_runup global: {e}")
        max_runup_global, max_runup_global_pct, trough_capital_global = (0.0, 0.0, 0.0)
    
    # 12. Expectancy
    expectancy = 0.0
    if total_trades > 0:
        win_rate_decimal = win_rate / 100
        loss_rate = 1 - win_rate_decimal
        avg_win = float(total_gains / winning_trades) if winning_trades > 0 else 0
        avg_loss = abs(float(total_losses / losing_trades)) if losing_trades > 0 else 0
        expectancy = (win_rate_decimal * avg_win) - (loss_rate * avg_loss)
    
    # 13. Break-even Trades
    # Break-even = trades avec P/L = 0 OU trades gagnants sans TP atteint
    from django.db.models import Q, Exists, OuterRef
    
    # Trades avec P/L = 0 (break-even classique)
    if fx_resolver:
        zero_break_even_count = sum(
            1 for trade in trades_ordered if pnl_dec(trade) == 0
        )
    else:
        trades_with_zero_pnl = trades.filter(**{pf: 0})
        zero_break_even_count = trades_with_zero_pnl.count()
    
    # Trades gagnants (P/L > 0) sans TP atteint (tp1_reached = False et tp2_plus_reached = False)
    winning_trades_without_tp = trades.filter(
        **{f'{pf}__gt': 0}
    ).filter(
        Exists(
            TradeStrategy.objects.filter(
                trade=OuterRef('pk')
            ).filter(
                Q(tp1_reached=False) & Q(tp2_plus_reached=False)
            )
        )
    )
    
    winning_break_even_count = winning_trades_without_tp.count()
    break_even_trades = zero_break_even_count + winning_break_even_count
    
    # 14. Sharpe Ratio — par trade et annualisé (rendements journaliers, √252)
    pnl_values_ordered = [float(pnl_dec(trade)) for trade in trades_ordered]
    sharpe_ratio = compute_sharpe_per_trade(pnl_values_ordered)
    period_start_balance = float(period_start_capital)
    sharpe_ratio_annualized = compute_sharpe_annualized_from_trades(
        period_start_balance,
        trades_ordered,
        lambda trade: float(pnl_dec(trade)),
        user_tz,
    )
    
    # 15. Sortino Ratio (similaire au Sharpe mais ne pénalise que la volatilité négative)
    sortino_ratio = 0.0
    if total_trades > 1:
        pnl_values = pnl_values_ordered if fx_resolver else list(trades.values_list(pf, flat=True))
        if len(pnl_values) > 1:
            import statistics
            mean_pnl = statistics.mean([float(v) for v in pnl_values])
            # Calculer l'écart-type des pertes uniquement
            negative_pnls = [float(v) for v in pnl_values if v < 0]
            if len(negative_pnls) > 0:
                if len(negative_pnls) > 1:
                    # Avec plusieurs pertes, utiliser l'écart-type
                    downside_deviation = statistics.stdev(negative_pnls)
                else:
                    # Avec une seule perte, utiliser la valeur absolue comme approximation
                    downside_deviation = abs(negative_pnls[0])
                
                if downside_deviation > 0:
                    sortino_ratio = mean_pnl / downside_deviation
    
    # 16. Calmar Ratio (rendement annuel en % / maximum drawdown en %)
    # Pour le Calmar Ratio, on utilise le drawdown en pourcentage du capital initial
    # Le Calmar ratio nécessite au moins 30 jours de trading pour être significatif
    calmar_ratio = 0.0
    if max_drawdown > 0 and trades.exists() and initial_capital and initial_capital > 0:
        # Calculer le rendement annuel en pourcentage basé sur le capital initial
        trades_ordered = trades.order_by('entered_at')
        first_trade = trades_ordered.first()
        last_trade = trades_ordered.last()
        if first_trade and last_trade and first_trade.entered_at < last_trade.entered_at:
            days_diff = (last_trade.entered_at - first_trade.entered_at).days
            # Exiger au moins 30 jours de trading pour un Calmar ratio significatif
            # Sinon, l'extrapolation sur une année entière donne des résultats absurdes
            if days_diff >= 30:
                total_pnl_decimal = float(aggregates['total_pnl'] or Decimal('0'))
                initial_capital_float = float(initial_capital)
                
                # Calculer le rendement annuel en pourcentage basé sur le capital initial
                annual_return_pct = (total_pnl_decimal / initial_capital_float) * (365 / days_diff) * 100
                
                # Calculer le drawdown en pourcentage du capital initial pour le Calmar Ratio
                max_drawdown_pct = (max_drawdown / initial_capital_float) * 100
                
                if max_drawdown_pct > 0:
                    calmar_ratio = annual_return_pct / max_drawdown_pct
    
    # 17. Trade Efficiency (% de trades où TP atteint)
    from django.db.models import Q, Exists, OuterRef
    # Filtrer les trades qui ont une stratégie avec TP1 ou TP2+ atteint
    trade_efficiency = 0.0
    if total_trades > 0:
        # Les trades sont déjà filtrés par utilisateur via get_queryset()
        # On cherche les trades qui ont une stratégie associée avec TP atteint
        trades_with_tp = trades.filter(
            Exists(
                TradeStrategy.objects.filter(
                    trade=OuterRef('pk')
                ).filter(Q(tp1_reached=True) | Q(tp2_plus_reached=True))
            )
        )
        trades_with_tp_count = trades_with_tp.count()
        trade_efficiency = (trades_with_tp_count / total_trades) * 100
    
    # Calculer la série en cours de jours consécutifs avec P/L positif
    # Cette série compte depuis le jour le plus récent jusqu'à trouver une perte
    current_winning_streak_days = 0
    if trades.exists():
        # Agréger les trades par jour (fuseau horaire utilisateur)
        daily_data = defaultdict(lambda: {'pnl': Decimal('0.0')})
        for trade in trades:
            day_key = trade.entered_at.astimezone(user_tz).date()
            daily_data[day_key]['pnl'] += pnl_dec(trade)
        
        # Trier les jours par date (du plus récent au plus ancien)
        sorted_days = sorted(daily_data.keys(), reverse=True)
        
        # Compter les jours consécutifs avec P/L positif depuis le plus récent
        for day_key in sorted_days:
            day_pnl = daily_data[day_key]['pnl']
            if day_pnl > 0:
                current_winning_streak_days += 1
            else:
                # Dès qu'on trouve une perte ou un break-even, on s'arrête
                break
    
    # Statistiques Risk/Reward Ratio
    trades_with_planned_rr = trades.filter(planned_risk_reward_ratio__isnull=False)
    trades_with_actual_rr = trades.filter(actual_risk_reward_ratio__isnull=False)
    trades_with_both_rr = trades.filter(
        planned_risk_reward_ratio__isnull=False,
        actual_risk_reward_ratio__isnull=False
    )
    
    # R:R moyen prévu
    avg_planned_rr = 0.0
    if trades_with_planned_rr.exists():
        avg_planned_rr_agg = trades_with_planned_rr.aggregate(avg=Avg('planned_risk_reward_ratio'))
        avg_planned_rr = float(avg_planned_rr_agg['avg'] or 0.0)
    
    # R:R moyen réel
    avg_actual_rr = 0.0
    if trades_with_actual_rr.exists():
        avg_actual_rr_agg = trades_with_actual_rr.aggregate(avg=Avg('actual_risk_reward_ratio'))
        avg_actual_rr = float(avg_actual_rr_agg['avg'] or 0.0)
    
    # Taux de respect du plan (trades où R:R réel >= R:R prévu)
    plan_respect_rate = 0.0
    plan_respect_count = 0
    if trades_with_both_rr.exists():
        for trade in trades_with_both_rr:
            if trade.actual_risk_reward_ratio and trade.planned_risk_reward_ratio:
                if trade.actual_risk_reward_ratio >= trade.planned_risk_reward_ratio:
                    plan_respect_count += 1
        plan_respect_rate = (plan_respect_count / trades_with_both_rr.count()) * 100 if trades_with_both_rr.count() > 0 else 0.0
    
    stats = {
        'total_trades': total_trades,
        'winning_trades': winning_trades,
        'losing_trades': losing_trades,
        'win_rate': win_rate,
        'total_pnl': aggregates['total_pnl'] or Decimal('0'),
        'total_raw_pnl': aggregates['total_raw_pnl'] or Decimal('0'),
        'total_net_pnl': aggregates['total_net_pnl'] or Decimal('0'),
        'total_gains': total_gains,
        'total_losses': total_losses,
        'average_pnl': aggregates['average_pnl'] or Decimal('0'),
        'best_trade': best_trade,
        'worst_trade': worst_trade,
        'total_fees': aggregates['total_fees'] or Decimal('0'),
        'total_volume': aggregates['total_volume'] or Decimal('0'),
        'average_duration': avg_duration_str,
        'most_traded_contract': most_traded['contract_name'] if most_traded else None,
        # Ratios de Performance
        'profit_factor': round(float(profit_factor), 2),
        'win_loss_ratio': round(win_loss_ratio, 2),
        'consistency_ratio': round(consistency_ratio, 2),
        'recovery_ratio': round(recovery_ratio, 2),
        'pnl_per_trade': round(float(pnl_per_trade), 2),
        'fees_ratio': round(float(fees_ratio), 2),
        'volume_pnl_ratio': round(float(volume_pnl_ratio), 6),
        'frequency_ratio': round(frequency_ratio, 2),
        'duration_ratio': round(duration_ratio, 2),
        'avg_time_between_trades': avg_time_between_trades,
        'avg_daily_exposure_time': avg_daily_exposure_time,
        'recovery_time': round(recovery_time, 1),
        'max_drawdown': round(max_drawdown, 2),
        'max_drawdown_pct': round(max_drawdown_pct, 2),
        'max_drawdown_global': round(max_drawdown_global, 2),
        'max_drawdown_global_pct': round(max_drawdown_global_pct, 2),
        'max_runup': round(max_runup, 2),
        'max_runup_pct': round(max_runup_pct, 2),
        'max_runup_global': round(max_runup_global, 2),
        'max_runup_global_pct': round(max_runup_global_pct, 2),
        'expectancy': round(expectancy, 2),
        'break_even_trades': break_even_trades,
        'break_even_zero_trades': zero_break_even_count,
        'break_even_positive_trades': winning_break_even_count,
        'sharpe_ratio': round(sharpe_ratio, 2),
        'sharpe_ratio_annualized': round(sharpe_ratio_annualized, 2),
        'sortino_ratio': round(sortino_ratio, 2),
        'calmar_ratio': round(calmar_ratio, 2),
        'trade_efficiency': round(trade_efficiency, 2),
        'current_winning_streak_days': current_winning_streak_days,
        # Statistiques Risk/Reward Ratio
        'avg_planned_rr': round(avg_planned_rr, 4),  # 4 décimales pour préserver la précision
        'avg_actual_rr': round(avg_actual_rr, 4),  # 4 décimales pour préserver la précision
        'trades_with_planned_rr': trades_with_planned_rr.count(),
        'trades_with_actual_rr': trades_with_actual_rr.count(),
        'trades_with_both_rr': trades_with_both_rr.count(),
        'plan_respect_rate': round(plan_respect_rate, 2)
    }
    
    serializer = TradeStatisticsSerializer(stats)
    return dict(serializer.data)
