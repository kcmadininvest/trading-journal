"""
Service pour calculer les métriques quotidiennes d'un compte de trading.
"""
from django.db.models import Sum, QuerySet
from django.db import transaction
from decimal import Decimal
from datetime import date
from typing import cast, TYPE_CHECKING

if TYPE_CHECKING:
    from ..models import TradingAccount

from ..models import TopStepTrade, AccountDailyMetrics


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
    
    def calculate_metrics_for_date(self, trading_account: 'TradingAccount', target_date: date):
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
        else:
            # Première métrique : le solde maximum commence au capital initial
            # Il évolue ensuite avec le solde réel si celui-ci est supérieur
            # Pour le calcul du MLL, on commence toujours au capital initial
            account_balance_high = max(initial_capital, account_balance)
        
        # S'assurer que le solde maximum est toujours >= capital initial
        account_balance_high = max(account_balance_high, initial_capital)
        
        # Calculer le MLL
        mll_initial_decimal = self._to_decimal(mll_initial)
        
        # Le MLL commence toujours à initial_capital - mll_initial et reste fixe
        # jusqu'à ce que le solde dépasse le capital initial de manière persistante
        if previous_metrics:
            # Il y a des métriques précédentes
            # Vérifier si le solde maximum dépasse le capital initial
            if account_balance_high > initial_capital:
                # Le solde maximum dépasse le capital initial, le MLL doit évoluer
                mll_is_locked = False
                account_balance_high_for_mll = account_balance_high
                maximum_loss_limit = account_balance_high_for_mll - mll_initial_decimal
            else:
                # Le solde maximum n'a pas dépassé le capital initial, MLL reste verrouillé
                mll_is_locked = True
                maximum_loss_limit = initial_capital - mll_initial_decimal
        else:
            # Première métrique : le MLL commence toujours fixé à initial_capital - mll_initial
            # même si le solde du premier jour dépasse le capital initial
            mll_is_locked = True
            maximum_loss_limit = initial_capital - mll_initial_decimal
        
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
    
    def recalculate_metrics_from_date(self, trading_account: 'TradingAccount', from_date: date):
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
    
    def recalculate_all_metrics(self, trading_account: 'TradingAccount'):
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
