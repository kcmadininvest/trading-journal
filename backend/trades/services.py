"""
Services pour le calcul de progression des objectifs de trading.
"""
from django.db.models import Sum, Count, Max, Min, Q
from django.utils import timezone
from django.db import transaction
from decimal import Decimal
from datetime import timedelta, date
from .models import TradingGoal, TopStepTrade, TradeStrategy, TradingAccount, AccountDailyMetrics


class GoalProgressCalculator:
    """
    Service pour calculer la progression des objectifs de trading.
    """
    
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
            trades = goal.trading_account.topstep_trades.filter(
                user=goal.user
            )
        else:
            # Tous les comptes de l'utilisateur
            trades = TopStepTrade.objects.filter(
                user=goal.user
            )
        
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
        
        percentage = (current_value / goal.target_value * 100) if goal.target_value != 0 else 0
        remaining_amount = max(Decimal('0'), goal.target_value - current_value)
        
        # Déterminer le statut
        status = self._determine_status(goal, percentage, current_value, goal.target_value)
        
        return {
            'current_value': current_value,
            'percentage': float(percentage),
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
                'remaining_amount': goal.target_value
            }
        
        winning_trades = trades.filter(net_pnl__gt=0).count()
        win_rate = (winning_trades / total_trades) * 100
        current_value = Decimal(str(win_rate))
        
        percentage = (current_value / goal.target_value * 100) if goal.target_value != 0 else 0
        remaining_amount = max(Decimal('0'), goal.target_value - current_value)
        
        status = self._determine_status(goal, percentage, current_value, goal.target_value)
        
        return {
            'current_value': current_value,
            'percentage': float(percentage),
            'status': status,
            'remaining_days': goal.remaining_days,
            'remaining_amount': remaining_amount
        }
    
    def _calculate_trades_count_goal(self, goal: TradingGoal, trades) -> dict:
        """Calcule la progression pour un objectif Nombre de Trades."""
        current_value = Decimal(str(trades.count()))
        
        percentage = (current_value / goal.target_value * 100) if goal.target_value != 0 else 0
        remaining_amount = max(Decimal('0'), goal.target_value - current_value)
        
        status = self._determine_status(goal, percentage, current_value, goal.target_value)
        
        return {
            'current_value': current_value,
            'percentage': float(percentage),
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
        
        percentage = (current_value / goal.target_value * 100) if goal.target_value != 0 else 0
        remaining_amount = max(Decimal('0'), goal.target_value - current_value)
        
        status = self._determine_status(goal, percentage, current_value, goal.target_value)
        
        return {
            'current_value': current_value,
            'percentage': float(percentage),
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
                'remaining_amount': goal.target_value
            }
        
        # Calculer le drawdown maximum
        # On doit calculer le capital cumulé et trouver le drawdown max
        trades_ordered = trades.order_by('trade_day', 'entered_at')
        
        # Récupérer le capital initial
        if goal.trading_account and goal.trading_account.initial_capital:
            initial_capital = goal.trading_account.initial_capital
        else:
            # Utiliser le premier trade comme référence
            first_trade = trades_ordered.first()
            if first_trade and first_trade.trading_account.initial_capital:
                initial_capital = first_trade.trading_account.initial_capital
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
        if goal.target_value < 100:  # Probablement un pourcentage
            max_drawdown_pct = (max_drawdown / peak_capital * 100) if peak_capital > 0 else Decimal('0')
            current_value = max_drawdown_pct
        else:
            current_value = max_drawdown
        
        # Pour le drawdown, on veut que la valeur actuelle soit INFÉRIEURE à la cible
        # (moins de drawdown = mieux)
        if current_value <= goal.target_value:
            percentage = 100
            status = 'achieved'
        else:
            percentage = (goal.target_value / current_value * 100) if current_value > 0 else 0
            status = 'active' if goal.remaining_days > 0 else 'failed'
        
        remaining_amount = max(Decimal('0'), current_value - goal.target_value)
        
        return {
            'current_value': current_value,
            'percentage': float(percentage),
            'status': status,
            'remaining_days': goal.remaining_days,
            'remaining_amount': remaining_amount
        }
    
    def _calculate_strategy_respect_goal(self, goal: TradingGoal, trades) -> dict:
        """Calcule la progression pour un objectif Respect de Stratégie."""
        # Récupérer les stratégies associées aux trades
        trade_ids = trades.values_list('id', flat=True)
        strategies = TradeStrategy.objects.filter(
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
                'remaining_amount': goal.target_value
            }
        
        respected_count = strategies.filter(strategy_respected=True).count()
        respect_percentage = (respected_count / total_strategies) * 100
        current_value = Decimal(str(respect_percentage))
        
        percentage = (current_value / goal.target_value * 100) if goal.target_value != 0 else 0
        remaining_amount = max(Decimal('0'), goal.target_value - current_value)
        
        status = self._determine_status(goal, percentage, current_value, goal.target_value)
        
        return {
            'current_value': current_value,
            'percentage': float(percentage),
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
        
        percentage = (current_value / goal.target_value * 100) if goal.target_value != 0 else 0
        remaining_amount = max(Decimal('0'), goal.target_value - current_value)
        
        status = self._determine_status(goal, percentage, current_value, goal.target_value)
        
        return {
            'current_value': current_value,
            'percentage': float(percentage),
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
        initial_capital = trading_account.initial_capital or Decimal('0')
        
        # Récupérer tous les trades jusqu'à cette date (inclus)
        trades = trading_account.topstep_trades.filter(
            trade_day__lte=target_date
        ).order_by('trade_day', 'entered_at')
        
        # Calculer le PnL cumulé jusqu'à cette date
        cumulative_pnl = trades.aggregate(
            total=Sum('net_pnl')
        )['total'] or Decimal('0')
        
        # Calculer le solde de fin de journée
        account_balance = initial_capital + cumulative_pnl
        
        # Récupérer la dernière métrique avant cette date (si existe)
        previous_metrics = AccountDailyMetrics.objects.filter(
            trading_account=trading_account,
            date__lt=target_date
        ).order_by('-date').first()
        
        # Calculer le solde maximum atteint
        # Le solde maximum commence toujours au capital initial, puis évolue avec les gains
        if previous_metrics:
            # Utiliser le maximum entre le high précédent et le solde actuel
            account_balance_high = max(previous_metrics.account_balance_high, account_balance)
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
            maximum_loss_limit = account_balance_high_for_mll - mll_initial
            
            # Le MLL est verrouillé seulement si le solde maximum atteint est égal au capital initial
            # ET qu'on n'a jamais dépassé le capital initial (c'est-à-dire qu'on est toujours au capital initial)
            # Si le solde maximum > capital initial, le MLL évolue normalement
            if account_balance_high_for_mll == initial_capital and account_balance <= initial_capital:
                # On n'a jamais dépassé le capital initial, donc on verrouille au capital initial
                maximum_loss_limit = initial_capital
                mll_is_locked = True
        
        # Créer ou mettre à jour la métrique
        # Pour account_balance_high, on stocke toujours le vrai solde maximum (pas celui pour le MLL)
        metrics, created = AccountDailyMetrics.objects.update_or_create(
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
        # Vérifier que c'est un compte TopStep
        # Récupérer toutes les dates de trading à partir de from_date
        trade_dates = trading_account.topstep_trades.filter(
            trade_day__gte=from_date
        ).values_list('trade_day', flat=True).distinct().order_by('trade_day')
        
        count = 0
        with transaction.atomic():
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
        # Vérifier que c'est un compte TopStep
        # Récupérer la première date de trading
        first_trade = trading_account.topstep_trades.order_by('trade_day').first()
        if not first_trade or not first_trade.trade_day:
            return 0
        
        return self.recalculate_metrics_from_date(trading_account, first_trade.trade_day)

