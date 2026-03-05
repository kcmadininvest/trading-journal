"""
Services d'analyse statistique pour les trades.
"""
from typing import Dict, List, Any, Optional, TYPE_CHECKING
from decimal import Decimal
from datetime import timedelta
from django.db.models import Count, Avg, Q, F, Sum, Max, Min
from django.contrib.auth import get_user_model

from ..models import TopStepTrade
from ..models_analytics import TradeContext, TradeSetup, SessionContext, TradeExecution
from ..models_statistics import TradeStatistics, ConditionalProbability

if TYPE_CHECKING:
    from django.contrib.auth.models import AbstractUser as User
else:
    User = get_user_model()


class ProbabilityCalculator:
    """Calculateur de probabilités et statistiques."""
    
    @staticmethod
    def calculate_win_rate(trades) -> Decimal:
        """
        Calcule le taux de réussite.
        
        Args:
            trades: QuerySet de trades
            
        Returns:
            Taux de réussite en pourcentage (0-100)
        """
        total = trades.count()
        if total == 0:
            return Decimal('0.00')
        
        winning = trades.filter(net_pnl__gt=0).count()
        return Decimal(str(round((winning / total) * 100, 2)))
    
    @staticmethod
    def calculate_expectancy(trades) -> Decimal:
        """
        Calcule l'expectancy (gain moyen par trade).
        
        Args:
            trades: QuerySet de trades
            
        Returns:
            Expectancy (gain moyen par trade)
        """
        total = trades.count()
        if total == 0:
            return Decimal('0.00')
        
        total_pnl = trades.aggregate(total=Sum('net_pnl'))['total'] or Decimal('0')
        return Decimal(str(round(total_pnl / total, 2)))
    
    @staticmethod
    def calculate_profit_factor(trades) -> Optional[Decimal]:
        """
        Calcule le profit factor (gains totaux / pertes totales).
        
        Args:
            trades: QuerySet de trades
            
        Returns:
            Profit factor ou None si pas de pertes
        """
        total_wins = trades.filter(net_pnl__gt=0).aggregate(total=Sum('net_pnl'))['total'] or Decimal('0')
        total_losses = abs(trades.filter(net_pnl__lt=0).aggregate(total=Sum('net_pnl'))['total'] or Decimal('0'))
        
        if total_losses == 0:
            return None if total_wins == 0 else Decimal('999.99')
        
        return Decimal(str(round(total_wins / total_losses, 2)))
    
    @staticmethod
    def calculate_confidence_interval(trades, confidence: float = 0.95) -> Optional[Decimal]:
        """
        Calcule l'intervalle de confiance pour le win rate.
        
        Args:
            trades: QuerySet de trades
            confidence: Niveau de confiance (0.95 pour 95%)
            
        Returns:
            Intervalle de confiance en pourcentage
        """
        import math
        
        n = trades.count()
        if n < 2:
            return None
        
        p = float(ProbabilityCalculator.calculate_win_rate(trades)) / 100
        
        # Formule de l'intervalle de confiance pour une proportion
        # z = 1.96 pour 95% de confiance
        z = 1.96 if confidence == 0.95 else 2.576  # 2.576 pour 99%
        
        se = math.sqrt((p * (1 - p)) / n)
        margin = z * se
        
        return Decimal(str(round(margin * 100, 2)))
    
    @staticmethod
    def is_statistically_significant(sample_size: int, min_size: int = 30) -> bool:
        """
        Vérifie si l'échantillon est statistiquement significatif.
        
        Args:
            sample_size: Taille de l'échantillon
            min_size: Taille minimale requise (défaut: 30)
            
        Returns:
            True si significatif
        """
        return sample_size >= min_size


class TradeAnalysisService:
    """Service d'analyse des trades."""
    
    def __init__(self, user: User):
        self.user = user
        self.calculator = ProbabilityCalculator()
    
    def calculate_statistics(
        self,
        filters: Optional[Dict[str, Any]] = None,
        trading_account_id: Optional[int] = None
    ) -> TradeStatistics:
        """
        Calcule les statistiques pour un ensemble de trades.
        
        Args:
            filters: Filtres à appliquer (ex: {'context__trend_m15': 'bullish'})
            trading_account_id: ID du compte de trading
            
        Returns:
            Objet TradeStatistics
        """
        # Construire le queryset
        trades = TopStepTrade.objects.filter(user=self.user)
        
        if trading_account_id:
            trades = trades.filter(trading_account_id=trading_account_id)
        
        if filters:
            trades = trades.filter(**filters)
        
        # Calculer les statistiques
        total_trades = trades.count()
        winning_trades = trades.filter(net_pnl__gt=0).count()
        losing_trades = trades.filter(net_pnl__lt=0).count()
        
        win_rate = self.calculator.calculate_win_rate(trades)
        expectancy = self.calculator.calculate_expectancy(trades)
        profit_factor = self.calculator.calculate_profit_factor(trades)
        
        # Moyennes
        avg_win = trades.filter(net_pnl__gt=0).aggregate(avg=Avg('net_pnl'))['avg'] or Decimal('0')
        avg_loss = trades.filter(net_pnl__lt=0).aggregate(avg=Avg('net_pnl'))['avg'] or Decimal('0')
        
        # Extremes
        largest_win = trades.filter(net_pnl__gt=0).aggregate(max=Max('net_pnl'))['max'] or Decimal('0')
        largest_loss = trades.filter(net_pnl__lt=0).aggregate(min=Min('net_pnl'))['min'] or Decimal('0')
        
        # Durée moyenne
        trades_with_duration = trades.exclude(exited_at__isnull=True).exclude(entered_at__isnull=True)
        if trades_with_duration.exists():
            durations = [
                (t.exited_at - t.entered_at).total_seconds()
                for t in trades_with_duration
            ]
            avg_duration_seconds = sum(durations) / len(durations)
            average_duration = timedelta(seconds=avg_duration_seconds)
        else:
            average_duration = None
        
        # Créer ou mettre à jour l'objet TradeStatistics
        stats, created = TradeStatistics.objects.update_or_create(
            user=self.user,
            trading_account_id=trading_account_id,
            filter_criteria=filters or {},
            defaults={
                'total_trades': total_trades,
                'winning_trades': winning_trades,
                'losing_trades': losing_trades,
                'win_rate': win_rate,
                'average_win': avg_win,
                'average_loss': avg_loss,
                'profit_factor': profit_factor,
                'expectancy': expectancy,
                'largest_win': largest_win,
                'largest_loss': largest_loss,
                'average_duration': average_duration,
            }
        )
        
        return stats
    
    def calculate_conditional_probability(
        self,
        conditions: Dict[str, Any],
        min_sample_size: int = 30
    ) -> ConditionalProbability:
        """
        Calcule la probabilité de réussite selon des conditions spécifiques.
        
        Args:
            conditions: Conditions à appliquer (ex: {'context__trend_m15': 'bullish'})
            min_sample_size: Taille minimale de l'échantillon
            
        Returns:
            Objet ConditionalProbability
        """
        # Filtrer les trades selon les conditions
        trades = TopStepTrade.objects.filter(user=self.user, **conditions)
        
        sample_size = trades.count()
        win_rate = self.calculator.calculate_win_rate(trades)
        expectancy = self.calculator.calculate_expectancy(trades)
        confidence_interval = self.calculator.calculate_confidence_interval(trades)
        
        # Calculer le R:R moyen
        trades_with_rr = trades.exclude(actual_risk_reward_ratio__isnull=True)
        average_rr = trades_with_rr.aggregate(avg=Avg('actual_risk_reward_ratio'))['avg']
        
        # Créer ou mettre à jour l'objet ConditionalProbability
        prob, created = ConditionalProbability.objects.update_or_create(
            user=self.user,
            condition_set=conditions,
            defaults={
                'sample_size': sample_size,
                'win_rate': win_rate,
                'average_rr': average_rr,
                'expectancy': expectancy,
                'confidence_interval': confidence_interval,
                'is_statistically_significant': self.calculator.is_statistically_significant(sample_size, min_sample_size),
            }
        )
        
        return prob
    
    def find_best_setups(self, min_sample_size: int = 30) -> List[Dict[str, Any]]:
        """
        Identifie les setups avec le meilleur expectancy.
        
        Args:
            min_sample_size: Taille minimale de l'échantillon
            
        Returns:
            Liste de dictionnaires avec les statistiques par setup
        """
        # Agréger par catégorie de setup
        setup_stats = (
            TopStepTrade.objects
            .filter(user=self.user)
            .exclude(setup__isnull=True)
            .values('setup__setup_category', 'setup__setup_quality')
            .annotate(
                count=Count('id'),
                total_pnl=Sum('net_pnl'),
                avg_pnl=Avg('net_pnl'),
                win_count=Count('id', filter=Q(net_pnl__gt=0)),
            )
            .filter(count__gte=min_sample_size, avg_pnl__gt=0)
            .order_by('-avg_pnl')
        )
        
        results = []
        for stat in setup_stats:
            win_rate = (stat['win_count'] / stat['count']) * 100 if stat['count'] > 0 else 0
            results.append({
                'setup_category': stat['setup__setup_category'],
                'setup_quality': stat['setup__setup_quality'],
                'sample_size': stat['count'],
                'expectancy': stat['avg_pnl'],
                'total_pnl': stat['total_pnl'],
                'win_rate': round(win_rate, 2),
            })
        
        return results
    
    def find_worst_patterns(self) -> List[Dict[str, Any]]:
        """
        Identifie les patterns perdants récurrents.
        
        Returns:
            Liste de dictionnaires avec les erreurs récurrentes
        """
        # Analyser les erreurs d'exécution
        executions = (
            TradeExecution.objects
            .filter(trade__user=self.user, followed_trading_plan=False)
            .exclude(execution_errors=[])
        )
        
        # Compter les erreurs
        error_counts = {}
        for execution in executions:
            for error in execution.execution_errors:
                error_counts[error] = error_counts.get(error, 0) + 1
        
        # Trier par fréquence
        sorted_errors = sorted(error_counts.items(), key=lambda x: x[1], reverse=True)
        
        results = []
        for error, count in sorted_errors:
            # Calculer l'impact moyen
            trades_with_error = executions.filter(execution_errors__contains=[error])
            avg_pnl = trades_with_error.aggregate(avg=Avg('trade__net_pnl'))['avg'] or Decimal('0')
            
            results.append({
                'error': error,
                'count': count,
                'average_pnl': avg_pnl,
            })
        
        return results
    
    def compare_conditions(
        self,
        condition_a: Dict[str, Any],
        condition_b: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Compare deux ensembles de conditions.
        
        Args:
            condition_a: Premier ensemble de conditions
            condition_b: Deuxième ensemble de conditions
            
        Returns:
            Dictionnaire avec les statistiques comparatives
        """
        prob_a = self.calculate_conditional_probability(condition_a)
        prob_b = self.calculate_conditional_probability(condition_b)
        
        return {
            'condition_a': {
                'conditions': condition_a,
                'sample_size': prob_a.sample_size,
                'win_rate': prob_a.win_rate,
                'expectancy': prob_a.expectancy,
                'is_significant': prob_a.is_statistically_significant,
            },
            'condition_b': {
                'conditions': condition_b,
                'sample_size': prob_b.sample_size,
                'win_rate': prob_b.win_rate,
                'expectancy': prob_b.expectancy,
                'is_significant': prob_b.is_statistically_significant,
            },
            'comparison': {
                'win_rate_diff': prob_a.win_rate - prob_b.win_rate,
                'expectancy_diff': prob_a.expectancy - prob_b.expectancy,
                'better_condition': 'A' if prob_a.expectancy > prob_b.expectancy else 'B',
            }
        }
    
    def get_edge_analysis(self) -> Dict[str, Any]:
        """
        Analyse complète de l'edge statistique.
        
        Returns:
            Dictionnaire avec l'analyse complète
        """
        # Statistiques globales
        global_stats = self.calculate_statistics()
        
        # Meilleurs setups
        best_setups = self.find_best_setups()
        
        # Pires patterns
        worst_patterns = self.find_worst_patterns()
        
        # Analyse par tendance
        trend_analysis = []
        for trend in ['bullish', 'bearish', 'ranging']:
            prob = self.calculate_conditional_probability({'context__trend_m15': trend})
            if prob.sample_size >= 10:  # Au moins 10 trades
                trend_analysis.append({
                    'trend': trend,
                    'sample_size': prob.sample_size,
                    'win_rate': prob.win_rate,
                    'expectancy': prob.expectancy,
                })
        
        # Analyse par session
        session_analysis = []
        for session in ['asian', 'london', 'new_york', 'overlap_london_ny']:
            prob = self.calculate_conditional_probability({'session_context__trading_session': session})
            if prob.sample_size >= 10:
                session_analysis.append({
                    'session': session,
                    'sample_size': prob.sample_size,
                    'win_rate': prob.win_rate,
                    'expectancy': prob.expectancy,
                })
        
        return {
            'global_statistics': {
                'total_trades': global_stats.total_trades,
                'win_rate': global_stats.win_rate,
                'expectancy': global_stats.expectancy,
                'profit_factor': global_stats.profit_factor,
            },
            'best_setups': best_setups[:5],  # Top 5
            'worst_patterns': worst_patterns[:5],  # Top 5
            'trend_analysis': trend_analysis,
            'session_analysis': session_analysis,
        }


class PatternRecognitionService:
    """Service de reconnaissance de patterns."""
    
    def __init__(self, user: User):
        self.user = user
    
    @staticmethod
    def get_default_bias_thresholds() -> Dict[str, Any]:
        """
        Retourne les seuils par défaut pour la détection des biais.
        
        Returns:
            Dictionnaire des seuils par défaut
        """
        return {
            'overtrading': {
                'min_days': 5,
                'min_trades_per_day': 10,
                'high_severity_threshold': 15
            },
            'revenge_trading': {
                'min_occurrences': 5,
                'quick_trade_minutes': 30
            },
            'fomo': {
                'min_occurrences': 5,
                'entry_range_threshold': 80
            },
            'loss_aversion': {
                'min_occurrences': 5
            },
            'premature_exit': {
                'min_occurrences': 5,
                'rr_threshold': 0.5
            },
            'stop_loss_widening': {
                'min_occurrences': 5
            }
        }
    
    def _get_thresholds(self, custom_thresholds: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Fusionne les seuils personnalisés avec les seuils par défaut.
        
        Args:
            custom_thresholds: Seuils personnalisés de l'utilisateur
            
        Returns:
            Seuils à utiliser (personnalisés ou par défaut)
        """
        defaults = self.get_default_bias_thresholds()
        
        if not custom_thresholds:
            return defaults
        
        # Fusionner les seuils personnalisés avec les défauts
        merged = defaults.copy()
        for bias_type, thresholds in custom_thresholds.items():
            if bias_type in merged:
                merged[bias_type].update(thresholds)
        
        return merged
    
    def identify_recurring_patterns(self) -> List[Dict[str, Any]]:
        """
        Identifie les patterns qui se répètent.
        
        Returns:
            Liste de patterns récurrents
        """
        # Analyser les combinaisons de conditions qui apparaissent fréquemment
        patterns = []
        
        # Pattern 1: Tendance alignée + Fibonacci
        for fib_level in ['50', '61.8', '38.2']:
            trades = TopStepTrade.objects.filter(
                user=self.user,
                context__trend_alignment=True,
                context__fibonacci_level=fib_level
            )
            
            if trades.count() >= 10:
                calc = ProbabilityCalculator()
                patterns.append({
                    'pattern': f'Tendance alignée + Fibo {fib_level}%',
                    'count': trades.count(),
                    'win_rate': calc.calculate_win_rate(trades),
                    'expectancy': calc.calculate_expectancy(trades),
                })
        
        # Pattern 2: Setup quality A/B dans certaines sessions
        for quality in ['A', 'B']:
            for session in ['london', 'new_york']:
                trades = TopStepTrade.objects.filter(
                    user=self.user,
                    setup__setup_quality=quality,
                    session_context__trading_session=session
                )
                
                if trades.count() >= 10:
                    calc = ProbabilityCalculator()
                    patterns.append({
                        'pattern': f'Setup {quality} en session {session}',
                        'count': trades.count(),
                        'win_rate': calc.calculate_win_rate(trades),
                        'expectancy': calc.calculate_expectancy(trades),
                    })
        
        # Trier par expectancy
        patterns.sort(key=lambda x: float(x['expectancy']), reverse=True)
        
        return patterns
    
    def cluster_similar_trades(self, trade_id: int, max_results: int = 10) -> List[Dict[str, Any]]:
        """
        Regroupe les trades similaires à un trade donné.
        
        Args:
            trade_id: ID du trade de référence
            max_results: Nombre maximum de résultats
            
        Returns:
            Liste de trades similaires
        """
        try:
            reference_trade = TopStepTrade.objects.get(id=trade_id, user=self.user)
        except TopStepTrade.DoesNotExist:
            return []
        
        # Construire les critères de similarité
        filters = Q(user=self.user)
        filters &= ~Q(id=trade_id)  # Exclure le trade de référence
        
        # Similarité basée sur le contexte
        if hasattr(reference_trade, 'context'):
            ctx = reference_trade.context
            if ctx.trend_m15:
                filters &= Q(context__trend_m15=ctx.trend_m15)
            if ctx.fibonacci_level and ctx.fibonacci_level != 'none':
                filters &= Q(context__fibonacci_level=ctx.fibonacci_level)
        
        # Similarité basée sur le setup
        if hasattr(reference_trade, 'setup'):
            setup = reference_trade.setup
            filters &= Q(setup__setup_category=setup.setup_category)
            filters &= Q(setup__setup_quality=setup.setup_quality)
        
        similar_trades = TopStepTrade.objects.filter(filters)[:max_results]
        
        results = []
        for trade in similar_trades:
            results.append({
                'id': trade.id,
                'contract_name': trade.contract_name,
                'entered_at': trade.entered_at,
                'net_pnl': trade.net_pnl,
                'similarity_score': 0.8,  # Placeholder - pourrait être calculé
            })
        
        return results
    
    def detect_behavioral_biases(self, custom_thresholds: Optional[Dict] = None) -> List[Dict[str, Any]]:
        """
        Détecte les biais comportementaux.
        
        Args:
            custom_thresholds: Seuils personnalisés de l'utilisateur
        
        Returns:
            Liste de biais détectés
        """
        biases = []
        
        # Obtenir les seuils à utiliser
        thresholds = self._get_thresholds(custom_thresholds)
        
        # Vérifier qu'il y a suffisamment de données globales
        total_trades = TopStepTrade.objects.filter(user=self.user).count()
        
        # Minimum 30 trades pour détecter des patterns significatifs
        if total_trades < 30:
            return biases
        
        # Biais 1: Overtrading (trop de trades par jour)
        from django.db.models.functions import TruncDate
        overtrading_thresholds = thresholds['overtrading']
        daily_trade_counts = (
            TopStepTrade.objects
            .filter(user=self.user)
            .annotate(date=TruncDate('entered_at'))
            .values('date')
            .annotate(count=Count('id'))
            .filter(count__gte=overtrading_thresholds['min_trades_per_day'])
        )
        
        # Vérifier qu'il y a au moins min_days jours avec min_trades_per_day+ trades pour confirmer le pattern
        if daily_trade_counts.count() >= overtrading_thresholds['min_days']:
            avg_count = daily_trade_counts.aggregate(avg=Avg('count'))['avg']
            biases.append({
                'bias': 'Overtrading',
                'description': f'Moyenne de {avg_count:.1f} trades les jours actifs',
                'severity': 'high' if avg_count > overtrading_thresholds['high_severity_threshold'] else 'medium',
                'recommendation': 'Limiter le nombre de trades par jour',
            })
        
        # Biais 2: Revenge Trading (trades motivés par la vengeance après une perte)
        revenge_thresholds = thresholds['revenge_trading']
        revenge_trades = SessionContext.objects.filter(
            trade__user=self.user,
            previous_trade_result='loss',
            trade_motivation__in=['revenge', 'recovery_attempt']
        ).select_related('trade')
        
        if revenge_trades.count() >= revenge_thresholds['min_occurrences']:
            # Analyser les performances des revenge trades
            revenge_pnl = revenge_trades.aggregate(
                avg_pnl=Avg('trade__net_pnl'),
                total_loss=Sum('trade__net_pnl', filter=Q(trade__net_pnl__lt=0))
            )
            
            # Analyser le timing (trades rapides après une perte)
            quick_revenge = revenge_trades.filter(minutes_since_last_trade__lt=revenge_thresholds['quick_trade_minutes']).count()
            
            severity = 'high' if revenge_pnl['avg_pnl'] and revenge_pnl['avg_pnl'] < 0 else 'medium'
            
            biases.append({
                'bias': 'Revenge Trading',
                'description': f'{revenge_trades.count()} trades de vengeance détectés ({quick_revenge} dans les {revenge_thresholds["quick_trade_minutes"]} min)',
                'severity': severity,
                'recommendation': 'Prendre une pause après une perte. Attendre au moins 30 minutes avant le prochain trade.',
                'metrics': {
                    'count': revenge_trades.count(),
                    'avg_pnl': float(revenge_pnl['avg_pnl']) if revenge_pnl['avg_pnl'] else 0,
                    'quick_trades': quick_revenge
                }
            })
        
        # Biais 3: FOMO (Fear Of Missing Out)
        fomo_thresholds = thresholds['fomo']
        fomo_trades = TradeSetup.objects.filter(
            trade__user=self.user
        ).filter(
            Q(missed_better_entry=True) |
            Q(entry_timing='late') |
            Q(entry_in_range_percentage__gte=fomo_thresholds['entry_range_threshold'])
        ).select_related('trade')
        
        # Filtrer aussi par motivation FOMO
        fomo_motivated = SessionContext.objects.filter(
            trade__user=self.user,
            trade_motivation='fomo'
        ).values_list('trade_id', flat=True)
        
        total_fomo = fomo_trades.count() + len(fomo_motivated)
        
        if total_fomo >= fomo_thresholds['min_occurrences']:
            fomo_pnl = fomo_trades.aggregate(avg_pnl=Avg('trade__net_pnl'))
            
            biases.append({
                'bias': 'FOMO',
                'description': f'{total_fomo} trades avec signes de FOMO (entrées tardives, meilleure entrée ratée)',
                'severity': 'medium',
                'recommendation': 'Attendre le bon setup. Ne pas courir après le marché.',
                'metrics': {
                    'count': total_fomo,
                    'late_entries': fomo_trades.filter(entry_timing='late').count(),
                    'missed_better': fomo_trades.filter(missed_better_entry=True).count(),
                    'avg_pnl': float(fomo_pnl['avg_pnl']) if fomo_pnl['avg_pnl'] else 0
                }
            })
        
        # Biais 4: Loss Aversion (garder les perdants trop longtemps)
        loss_aversion_thresholds = thresholds['loss_aversion']
        loss_aversion_trades = TradeExecution.objects.filter(
            trade__user=self.user,
            trade__net_pnl__lt=0,
            time_in_position_vs_planned__in=['longer', 'much_longer']
        ).select_related('trade')
        
        # Trades avec SL élargi sur des positions perdantes
        widened_sl_losses = TradeExecution.objects.filter(
            trade__user=self.user,
            trade__net_pnl__lt=0,
            moved_stop_loss=True,
            stop_loss_direction='wider'
        )
        
        total_loss_aversion = loss_aversion_trades.count() + widened_sl_losses.count()
        
        if total_loss_aversion >= loss_aversion_thresholds['min_occurrences']:
            avg_loss = loss_aversion_trades.aggregate(avg=Avg('trade__net_pnl'))['avg']
            
            biases.append({
                'bias': 'Loss Aversion',
                'description': f'{total_loss_aversion} trades perdants gardés trop longtemps ou avec SL élargi',
                'severity': 'high',
                'recommendation': 'Respecter le stop loss initial. Couper les pertes rapidement.',
                'metrics': {
                    'count': total_loss_aversion,
                    'held_too_long': loss_aversion_trades.count(),
                    'widened_sl': widened_sl_losses.count(),
                    'avg_loss': float(avg_loss) if avg_loss else 0
                }
            })
        
        # Biais 5: Premature Exit (couper les gagnants trop tôt)
        premature_exit_thresholds = thresholds['premature_exit']
        premature_exit_trades = TradeExecution.objects.filter(
            trade__user=self.user,
            trade__net_pnl__gt=0,
            time_in_position_vs_planned__in=['shorter', 'much_shorter']
        ).select_related('trade')
        
        # Trades sortis par peur/émotion alors qu'ils étaient gagnants
        fear_exits = TradeExecution.objects.filter(
            trade__user=self.user,
            trade__net_pnl__gt=0,
            exit_emotional_context='fear'
        )
        
        # Trades avec R:R réalisé < R:R planifié
        poor_rr_trades = TopStepTrade.objects.filter(
            user=self.user,
            net_pnl__gt=0,
            actual_risk_reward_ratio__isnull=False,
            planned_risk_reward_ratio__isnull=False,
            actual_risk_reward_ratio__lt=F('planned_risk_reward_ratio') * premature_exit_thresholds['rr_threshold']
        )
        
        total_premature = premature_exit_trades.count() + fear_exits.count() + poor_rr_trades.count()
        
        if total_premature >= premature_exit_thresholds['min_occurrences']:
            # Calculer le manque à gagner potentiel
            avg_rr_diff = poor_rr_trades.aggregate(
                avg_planned=Avg('planned_risk_reward_ratio'),
                avg_actual=Avg('actual_risk_reward_ratio')
            )
            
            biases.append({
                'bias': 'Premature Exit',
                'description': f'{total_premature} trades gagnants coupés trop tôt',
                'severity': 'high',
                'recommendation': 'Laisser courir les gagnants. Respecter les objectifs de take profit.',
                'metrics': {
                    'count': total_premature,
                    'held_too_short': premature_exit_trades.count(),
                    'fear_exits': fear_exits.count(),
                    'poor_rr': poor_rr_trades.count(),
                    'avg_rr_planned': float(avg_rr_diff['avg_planned']) if avg_rr_diff['avg_planned'] else 0,
                    'avg_rr_actual': float(avg_rr_diff['avg_actual']) if avg_rr_diff['avg_actual'] else 0
                }
            })
        
        # Biais 6: Déplacement du stop loss (Stop Loss Widening)
        sl_widening_thresholds = thresholds['stop_loss_widening']
        moved_sl_trades = TradeExecution.objects.filter(
            trade__user=self.user,
            moved_stop_loss=True,
            stop_loss_direction='wider'
        )
        
        if moved_sl_trades.count() >= sl_widening_thresholds['min_occurrences']:
            avg_pnl = moved_sl_trades.aggregate(avg=Avg('trade__net_pnl'))['avg']
            biases.append({
                'bias': 'Stop Loss Widening',
                'description': f'{moved_sl_trades.count()} trades avec SL élargi',
                'severity': 'high' if avg_pnl and avg_pnl < 0 else 'medium',
                'recommendation': 'Respecter le stop loss initial. Ne jamais élargir le SL.',
                'metrics': {
                    'count': moved_sl_trades.count(),
                    'avg_pnl': float(avg_pnl) if avg_pnl else 0
                }
            })
        
        return biases
