"""
Services pour le calcul de progression des objectifs de trading.
"""
from django.db.models import Sum, Count, Max, Min, Q, QuerySet
from django.utils import timezone
from django.db import transaction
from decimal import Decimal
from datetime import timedelta, date
from typing import cast, TYPE_CHECKING

if TYPE_CHECKING:
    from .models import TradingAccount

from .models import TradingGoal, TopStepTrade, TradeStrategy, TradingAccount, AccountDailyMetrics


class GoalProgressCalculator:
    """
    Service pour calculer la progression des objectifs de trading.
    """
    
    @staticmethod
    def _to_decimal(value) -> Decimal:
        """Convertit une valeur (DecimalField ou autre) en Decimal."""
        if value is None:
            return Decimal('0')
        if isinstance(value, Decimal):
            return value
        return Decimal(str(value))
    
    def calculate_progress(self, goal: TradingGoal) -> dict:
        """
        Calcule la progression d'un objectif.
        
        Returns:
            dict: {
                'current_value': Decimal,
                'percentage': float,
                'status': str,
                'remaining_days': int,
                'remaining_amount': Decimal (pour PnL)
            }
        """
        # Récupérer les trades de la période
        trades = self._get_trades_for_goal(goal)
        
        # Calculer selon le type d'objectif
        if goal.goal_type == 'pnl_total':
            return self._calculate_pnl_goal(goal, trades)
        elif goal.goal_type == 'win_rate':
            return self._calculate_winrate_goal(goal, trades)
        elif goal.goal_type == 'trades_count':
            return self._calculate_trades_count_goal(goal, trades)
        elif goal.goal_type == 'profit_factor':
            return self._calculate_profit_factor_goal(goal, trades)
        elif goal.goal_type == 'max_drawdown':
            return self._calculate_drawdown_goal(goal, trades)
        elif goal.goal_type == 'strategy_respect':
            return self._calculate_strategy_respect_goal(goal, trades)
        elif goal.goal_type == 'winning_days':
            return self._calculate_winning_days_goal(goal, trades)
        else:
            return {
                'current_value': Decimal('0'),
                'percentage': 0,
                'status': 'active',
                'remaining_days': goal.remaining_days,
                'remaining_amount': Decimal('0')
            }
    
    def _get_trades_for_goal(self, goal: TradingGoal):
        """Récupère les trades pertinents pour l'objectif."""
        # Filtrer par compte si spécifié
        if goal.trading_account:
            # Accéder à topstep_trades via la relation Django (related_name défini dans le modèle)
            # Le cast indique au type checker que c'est une instance de TradingAccount
            trading_account = cast('TradingAccount', goal.trading_account)
            # Utiliser getattr pour accéder à la relation inverse avec une annotation de type
            # Cela permet au type checker de comprendre que topstep_trades existe
            from django.db.models import QuerySet
            topstep_trades = getattr(trading_account, 'topstep_trades')
            trades: QuerySet[TopStepTrade] = topstep_trades.filter(
                user=goal.user
            )
        else:
            # Tous les comptes de l'utilisateur
            from django.db.models import QuerySet
            trades_manager = getattr(TopStepTrade, 'objects')
            all_trades: QuerySet[TopStepTrade] = trades_manager.filter(
                user=goal.user
            )
            # Filtrer par période
            trades = all_trades.filter(
                trade_day__gte=goal.start_date,
                trade_day__lte=goal.end_date
            )
            return trades
        
        # Filtrer par période
        trades = trades.filter(
            trade_day__gte=goal.start_date,
            trade_day__lte=goal.end_date
        )
        
        return trades
    
    def _calculate_pnl_goal(self, goal: TradingGoal, trades) -> dict:
        """Calcule la progression pour un objectif PnL total."""
        total_pnl = trades.aggregate(total=Sum('net_pnl'))['total'] or Decimal('0')
        current_value = total_pnl
        
        # Convertir goal.target_value en Decimal pour les opérations
        target_value_decimal = self._to_decimal(goal.target_value)
        percentage_float = float((current_value / target_value_decimal * 100) if target_value_decimal != 0 else 0)
        remaining_amount = max(Decimal('0'), target_value_decimal - current_value)
        
        # Déterminer le statut
        status = self._determine_status(goal, percentage_float, current_value, target_value_decimal)
        
        return {
            'current_value': current_value,
            'percentage': percentage_float,
            'status': status,
            'remaining_days': goal.remaining_days,
            'remaining_amount': remaining_amount
        }
    
    def _calculate_winrate_goal(self, goal: TradingGoal, trades) -> dict:
        """Calcule la progression pour un objectif Win Rate."""
        total_trades = trades.count()
        if total_trades == 0:
            return {
                'current_value': Decimal('0'),
                'percentage': 0,
                'status': 'active',
                'remaining_days': goal.remaining_days,
                'remaining_amount': self._to_decimal(goal.target_value)
            }
        
        winning_trades = trades.filter(net_pnl__gt=0).count()
        win_rate = (winning_trades / total_trades) * 100
        current_value = Decimal(str(win_rate))
        
        target_value_decimal = self._to_decimal(goal.target_value)
        percentage_float = float((current_value / target_value_decimal * 100) if target_value_decimal != 0 else 0)
        remaining_amount = max(Decimal('0'), target_value_decimal - current_value)
        
        status = self._determine_status(goal, percentage_float, current_value, target_value_decimal)
        
        return {
            'current_value': current_value,
            'percentage': percentage_float,
            'status': status,
            'remaining_days': goal.remaining_days,
            'remaining_amount': remaining_amount
        }
    
    def _calculate_trades_count_goal(self, goal: TradingGoal, trades) -> dict:
        """Calcule la progression pour un objectif Nombre de Trades."""
        current_value = Decimal(str(trades.count()))
        
        target_value_decimal = self._to_decimal(goal.target_value)
        percentage_float = float((current_value / target_value_decimal * 100) if target_value_decimal != 0 else 0)
        remaining_amount = max(Decimal('0'), target_value_decimal - current_value)
        
        status = self._determine_status(goal, percentage_float, current_value, target_value_decimal)
        
        return {
            'current_value': current_value,
            'percentage': percentage_float,
            'status': status,
            'remaining_days': goal.remaining_days,
            'remaining_amount': remaining_amount
        }
    
    def _calculate_profit_factor_goal(self, goal: TradingGoal, trades) -> dict:
        """Calcule la progression pour un objectif Profit Factor."""
        total_gains = trades.filter(net_pnl__gt=0).aggregate(total=Sum('net_pnl'))['total'] or Decimal('0')
        total_losses = trades.filter(net_pnl__lt=0).aggregate(total=Sum('net_pnl'))['total'] or Decimal('0')
        
        if total_losses == 0:
            # Si pas de pertes, profit factor = infini (on met une valeur très élevée)
            current_value = Decimal('999999')
        else:
            profit_factor = abs(total_gains) / abs(total_losses)
            current_value = Decimal(str(profit_factor))
        
        target_value_decimal = self._to_decimal(goal.target_value)
        percentage_float = float((current_value / target_value_decimal * 100) if target_value_decimal != 0 else 0)
        remaining_amount = max(Decimal('0'), target_value_decimal - current_value)
        
        status = self._determine_status(goal, percentage_float, current_value, target_value_decimal)
        
        return {
            'current_value': current_value,
            'percentage': percentage_float,
            'status': status,
            'remaining_days': goal.remaining_days,
            'remaining_amount': remaining_amount
        }
    
    def _calculate_drawdown_goal(self, goal: TradingGoal, trades) -> dict:
        """Calcule la progression pour un objectif Drawdown Maximum."""
        if not trades.exists():
            return {
                'current_value': Decimal('0'),
                'percentage': 0,
                'status': 'active',
                'remaining_days': goal.remaining_days,
                'remaining_amount': self._to_decimal(goal.target_value)
            }
        
        # Calculer le drawdown maximum
        # On doit calculer le capital cumulé et trouver le drawdown max
        trades_ordered = trades.order_by('trade_day', 'entered_at')
        
        # Récupérer le capital initial
        if goal.trading_account:
            trading_account = cast('TradingAccount', goal.trading_account)
            initial_capital = self._to_decimal(getattr(trading_account, 'initial_capital', None))
            if initial_capital == 0:
                initial_capital = Decimal('50000')  # Valeur par défaut
        else:
            # Utiliser le premier trade comme référence
            first_trade = trades_ordered.first()
            if first_trade and first_trade.trading_account:
                trading_account = cast('TradingAccount', first_trade.trading_account)
                initial_capital = self._to_decimal(getattr(trading_account, 'initial_capital', None))
                if initial_capital == 0:
                    initial_capital = Decimal('50000')  # Valeur par défaut
            else:
                initial_capital = Decimal('50000')  # Valeur par défaut
        
        cumulative_pnl = Decimal('0')
        peak_capital = initial_capital
        max_drawdown = Decimal('0')
        
        for trade in trades_ordered:
            cumulative_pnl += trade.net_pnl or Decimal('0')
            current_capital = initial_capital + cumulative_pnl
            
            if current_capital > peak_capital:
                peak_capital = current_capital
            
            drawdown = peak_capital - current_capital
            if drawdown > max_drawdown:
                max_drawdown = drawdown
        
        # Convertir en pourcentage si nécessaire
        target_value_decimal = self._to_decimal(goal.target_value)
        if target_value_decimal < 100:  # Probablement un pourcentage
            max_drawdown_pct = (max_drawdown / peak_capital * 100) if peak_capital > 0 else Decimal('0')
            current_value = max_drawdown_pct
        else:
            current_value = max_drawdown
        
        # Pour le drawdown, on veut que la valeur actuelle soit INFÉRIEURE à la cible
        # (moins de drawdown = mieux)
        if current_value <= target_value_decimal:
            percentage_float = 100.0
            status = 'achieved'
        else:
            percentage_float = float((target_value_decimal / current_value * 100) if current_value > 0 else 0)
            status = 'active' if goal.remaining_days > 0 else 'failed'
        
        remaining_amount = max(Decimal('0'), current_value - target_value_decimal)
        
        return {
            'current_value': current_value,
            'percentage': percentage_float,
            'status': status,
            'remaining_days': goal.remaining_days,
            'remaining_amount': remaining_amount
        }
    
    def _calculate_strategy_respect_goal(self, goal: TradingGoal, trades) -> dict:
        """Calcule la progression pour un objectif Respect de Stratégie."""
        # Récupérer les stratégies associées aux trades
        trade_ids = trades.values_list('id', flat=True)
        from django.db.models import QuerySet
        strategies_manager = getattr(TradeStrategy, 'objects')
        strategies: QuerySet[TradeStrategy] = strategies_manager.filter(
            trade_id__in=trade_ids,
            user=goal.user
        )
        
        total_strategies = strategies.count()
        if total_strategies == 0:
            return {
                'current_value': Decimal('0'),
                'percentage': 0,
                'status': 'active',
                'remaining_days': goal.remaining_days,
                'remaining_amount': self._to_decimal(goal.target_value)
            }
        
        respected_count = strategies.filter(strategy_respected=True).count()
        respect_percentage = (respected_count / total_strategies) * 100
        current_value = Decimal(str(respect_percentage))
        
        target_value_decimal = self._to_decimal(goal.target_value)
        percentage_float = float((current_value / target_value_decimal * 100) if target_value_decimal != 0 else 0)
        remaining_amount = max(Decimal('0'), target_value_decimal - current_value)
        
        status = self._determine_status(goal, percentage_float, current_value, target_value_decimal)
        
        return {
            'current_value': current_value,
            'percentage': percentage_float,
            'status': status,
            'remaining_days': goal.remaining_days,
            'remaining_amount': remaining_amount
        }
    
    def _calculate_winning_days_goal(self, goal: TradingGoal, trades) -> dict:
        """Calcule la progression pour un objectif Nombre de Jours Gagnants."""
        # Grouper par jour et calculer le PnL par jour
        daily_pnl = trades.values('trade_day').annotate(
            daily_total=Sum('net_pnl')
        )
        
        winning_days = sum(1 for day in daily_pnl if day['daily_total'] and day['daily_total'] > 0)
        current_value = Decimal(str(winning_days))
        
        target_value_decimal = self._to_decimal(goal.target_value)
        percentage_float = float((current_value / target_value_decimal * 100) if target_value_decimal != 0 else 0)
        remaining_amount = max(Decimal('0'), target_value_decimal - current_value)
        
        status = self._determine_status(goal, percentage_float, current_value, target_value_decimal)
        
        return {
            'current_value': current_value,
            'percentage': percentage_float,
            'status': status,
            'remaining_days': goal.remaining_days,
            'remaining_amount': remaining_amount
        }
    
    def _determine_status(self, goal: TradingGoal, percentage: float, current_value: Decimal, target_value: Decimal) -> str:
        """Détermine le statut de l'objectif."""
        # Si déjà annulé, garder le statut
        if goal.status == 'cancelled':
            return 'cancelled'
        
        # Si objectif atteint
        if percentage >= 100:
            return 'achieved'
        
        # Si la période est terminée et l'objectif n'est pas atteint
        if goal.remaining_days <= 0:
            return 'failed'
        
        # Sinon, actif
        return 'active'


class AccountMetricsCalculator:
    """
    Service pour calculer les métriques quotidiennes d'un compte de trading,
    notamment le Maximum Loss Limit (MLL).
    """
    
    @staticmethod
    def _to_decimal(value) -> Decimal:
        """Convertit une valeur (DecimalField ou autre) en Decimal."""
        if value is None:
            return Decimal('0')
        if isinstance(value, Decimal):
            return value
        return Decimal(str(value))
    
    def calculate_metrics_for_date(self, trading_account: TradingAccount, target_date: date):
        """
        Calcule les métriques pour une date spécifique.
        
        Args:
            trading_account: Le compte de trading
            target_date: La date pour laquelle calculer les métriques
        
        Returns:
            AccountDailyMetrics: L'objet créé ou mis à jour
        """
        # Obtenir le MLL initial
        mll_initial = trading_account.get_mll_initial()
        if mll_initial is None:
            return None
        
        # Récupérer le capital initial
        initial_capital = self._to_decimal(trading_account.initial_capital)
        
        # Récupérer tous les trades jusqu'à cette date (inclus)
        trading_account_cast = cast('TradingAccount', trading_account)
        topstep_trades = getattr(trading_account_cast, 'topstep_trades')
        trades: QuerySet[TopStepTrade] = topstep_trades.filter(
            trade_day__lte=target_date
        ).order_by('trade_day', 'entered_at')
        
        # Calculer le PnL cumulé jusqu'à cette date
        cumulative_pnl = trades.aggregate(
            total=Sum('net_pnl')
        )['total'] or Decimal('0')
        
        # Calculer le solde de fin de journée
        account_balance = initial_capital + cumulative_pnl
        
        # Récupérer la dernière métrique avant cette date (si existe)
        metrics_manager = getattr(AccountDailyMetrics, 'objects')
        previous_metrics = metrics_manager.filter(
            trading_account=trading_account,
            date__lt=target_date
        ).order_by('-date').first()
        
        # Calculer le solde maximum atteint
        # Le solde maximum commence toujours au capital initial, puis évolue avec les gains
        if previous_metrics:
            # Utiliser le maximum entre le high précédent et le solde actuel
            previous_high = self._to_decimal(previous_metrics.account_balance_high)
            account_balance_high = max(previous_high, account_balance)
            mll_is_locked = previous_metrics.mll_is_locked
        else:
            # Première métrique : le solde maximum commence au capital initial
            # Il évolue ensuite avec le solde réel si celui-ci est supérieur
            # Pour le calcul du MLL, on commence toujours au capital initial
            account_balance_high = max(initial_capital, account_balance)
            mll_is_locked = False
        
        # S'assurer que le solde maximum est toujours >= capital initial
        account_balance_high = max(account_balance_high, initial_capital)
        
        # Calculer le MLL
        if mll_is_locked:
            # MLL est fixé au capital initial
            maximum_loss_limit = initial_capital
        else:
            # Pour le calcul du MLL, utiliser le solde maximum
            # Le MLL évolue avec le solde maximum dès le premier jour
            account_balance_high_for_mll = account_balance_high
            
            # Calculer le nouveau MLL = Account Balance High - MLL initial
            mll_initial_decimal = self._to_decimal(mll_initial)
            maximum_loss_limit = account_balance_high_for_mll - mll_initial_decimal
            
            # Le MLL est verrouillé seulement si le solde maximum atteint est égal au capital initial
            # ET qu'on n'a jamais dépassé le capital initial (c'est-à-dire qu'on est toujours au capital initial)
            # Si le solde maximum > capital initial, le MLL évolue normalement
            if account_balance_high_for_mll == initial_capital and account_balance <= initial_capital:
                # On n'a jamais dépassé le capital initial, donc on verrouille au capital initial
                maximum_loss_limit = initial_capital
                mll_is_locked = True
        
        # Créer ou mettre à jour la métrique
        # Pour account_balance_high, on stocke toujours le vrai solde maximum (pas celui pour le MLL)
        metrics_manager = getattr(AccountDailyMetrics, 'objects')
        metrics, created = metrics_manager.update_or_create(
            trading_account=trading_account,
            date=target_date,
            defaults={
                'account_balance': account_balance,
                'account_balance_high': account_balance_high,  # Le vrai solde maximum
                'maximum_loss_limit': maximum_loss_limit,
                'mll_is_locked': mll_is_locked,
            }
        )
        
        return metrics
    
    def recalculate_metrics_from_date(self, trading_account: TradingAccount, from_date: date):
        """
        Recalcule les métriques à partir d'une date donnée et pour toutes les dates suivantes.
        
        Args:
            trading_account: Le compte de trading
            from_date: La date à partir de laquelle recalculer
        
        Returns:
            int: Nombre de métriques recalculées
        """
        # Récupérer toutes les dates de trading à partir de from_date
        trading_account_cast = cast('TradingAccount', trading_account)
        topstep_trades = getattr(trading_account_cast, 'topstep_trades')
        trade_dates = topstep_trades.filter(
            trade_day__gte=from_date
        ).values_list('trade_day', flat=True).distinct().order_by('trade_day')
        
        count = 0
        with transaction.atomic():  # type: ignore
            for trade_date in trade_dates:
                self.calculate_metrics_for_date(trading_account, trade_date)
                count += 1
        
        return count
    
    def recalculate_all_metrics(self, trading_account: TradingAccount):
        """
        Recalcule toutes les métriques pour un compte.
        
        Args:
            trading_account: Le compte de trading
        
        Returns:
            int: Nombre de métriques recalculées
        """
        # Récupérer la première date de trading
        trading_account_cast = cast('TradingAccount', trading_account)
        topstep_trades = getattr(trading_account_cast, 'topstep_trades')
        first_trade = topstep_trades.order_by('trade_day').first()
        if not first_trade or not first_trade.trade_day:
            return 0
        
        return self.recalculate_metrics_from_date(trading_account, first_trade.trade_day)

