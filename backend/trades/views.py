from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.db.models import Sum, Count, Avg, Max, Min, F, Value, CharField, Q
from django.db.models.functions import TruncDate, Cast
from django.db import models
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.http import Http404
from django.conf import settings
from datetime import timedelta, datetime
import pytz
from decimal import Decimal
from collections import defaultdict
from typing import cast, Any

from .models import TopStepTrade, TopStepImportLog, TradeStrategy, DayStrategyCompliance, PositionStrategy, TradingAccount, Currency, TradingGoal, AccountTransaction, AccountDailyMetrics
from .serializers import (
    TopStepTradeSerializer,
    TopStepTradeListSerializer,
    TopStepImportLogSerializer,
    TradeStatisticsSerializer,
    TradingMetricsSerializer,
    CSVUploadSerializer,
    TradeStrategySerializer,
    DayStrategyComplianceSerializer,
    PositionStrategySerializer,
    PositionStrategyCreateSerializer,
    PositionStrategyUpdateSerializer,
    PositionStrategyVersionSerializer,
    TradingAccountSerializer,
    TradingAccountListSerializer,
    CurrencySerializer,
    TradingGoalSerializer,
    TradingGoalProgressSerializer,
    AccountTransactionSerializer,
    AccountDailyMetricsSerializer,
)
from .utils import TopStepCSVImporter




class TradingAccountViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour gérer les comptes de trading.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get_serializer_class(self):  # type: ignore
        if self.action == 'list':
            return TradingAccountListSerializer
        return TradingAccountSerializer
    
    def get_queryset(self):
        """Retourne uniquement les comptes de l'utilisateur connecté."""
        if not self.request.user.is_authenticated:
            return TradingAccount.objects.none()  # type: ignore
        return TradingAccount.objects.filter(user=self.request.user)  # type: ignore
    
    def perform_create(self, serializer):
        """Associe automatiquement le compte à l'utilisateur connecté."""
        user = self.request.user
        has_default_account = TradingAccount.objects.filter(user=user, is_default=True).exists()  # type: ignore
        serializer.save(
            user=user,
            is_default=serializer.validated_data.get('is_default') or not has_default_account
        )
    
    @action(detail=False, methods=['get'])
    def default(self, request):
        """
        Retourne le compte par défaut de l'utilisateur.
        """
        try:
            default_account = self.get_queryset().filter(is_default=True).first()
            if not default_account:
                # Aucun compte marqué comme défaut : tenter d'en sélectionner un automatiquement
                fallback_account = self.get_queryset().filter(status='active').order_by('created_at').first()
                if fallback_account:
                    fallback_account.is_default = True
                    fallback_account.save(update_fields=['is_default'])
                    default_account = fallback_account
                else:
                    return Response(
                        {'error': 'Aucun compte disponible pour cet utilisateur'}, 
                        status=status.HTTP_404_NOT_FOUND
                    )
            serializer = self.get_serializer(default_account)
            return Response(serializer.data)
        except Exception as e:
            return Response(
                {'error': f'Erreur lors de la récupération du compte par défaut: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def set_default(self, request, pk=None):
        """
        Définit ce compte comme compte par défaut.
        """
        try:
            account = self.get_object()
            
            # Désactiver tous les autres comptes par défaut
            self.get_queryset().exclude(pk=account.pk).update(is_default=False)
            
            # Activer ce compte comme défaut
            account.is_default = True
            account.save()
            
            serializer = self.get_serializer(account)
            return Response(serializer.data)
        except Exception as e:
            return Response(
                {'error': f'Erreur lors de la définition du compte par défaut: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'])
    def statistics(self, request, pk=None):
        """
        Retourne les statistiques pour un compte spécifique.
        """
        try:
            account = self.get_object()
            trades = account.topstep_trades.all()
            
            if not trades.exists():
                return Response({
                    'account_name': account.name,
                    'total_trades': 0,
                    'message': 'Aucun trade trouvé pour ce compte'
                })
            
            # Calcul des statistiques de base
            total_trades = trades.count()
            winning_trades = trades.filter(net_pnl__gt=0).count()
            losing_trades = trades.filter(net_pnl__lt=0).count()
            win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0
            
            total_pnl = trades.aggregate(total=Sum('net_pnl'))['total'] or Decimal('0')
            total_gains = trades.filter(net_pnl__gt=0).aggregate(total=Sum('net_pnl'))['total'] or Decimal('0')
            total_losses = trades.filter(net_pnl__lt=0).aggregate(total=Sum('net_pnl'))['total'] or Decimal('0')
            
            # Meilleur trade : le plus gros gain parmi les trades gagnants uniquement
            # Si aucun trade gagnant, best_trade = 0 (ne pas afficher)
            best_trade = trades.filter(net_pnl__gt=0).aggregate(best=Max('net_pnl'))['best']
            if best_trade is None:
                best_trade = Decimal('0')
            
            # Pire trade : le plus gros loss parmi les trades perdants uniquement
            # Si aucun trade perdant, worst_trade = 0 (ne pas afficher)
            worst_trade = trades.filter(net_pnl__lt=0).aggregate(worst=Min('net_pnl'))['worst']
            if worst_trade is None:
                worst_trade = Decimal('0')
            
            stats = {
                'account_name': account.name,
                'account_type': account.account_type,
                'total_trades': total_trades,
                'winning_trades': winning_trades,
                'losing_trades': losing_trades,
                'win_rate': round(win_rate, 2),
                'total_pnl': str(total_pnl),
                'total_gains': str(total_gains),
                'total_losses': str(total_losses),
                'best_trade': str(best_trade),
                'worst_trade': str(worst_trade),
                'average_pnl': str(total_pnl / total_trades) if total_trades > 0 else '0',
            }
            
            return Response(stats)
        except Exception as e:
            return Response(
                {'error': f'Erreur lors du calcul des statistiques: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'])
    def daily_metrics(self, request, pk=None):
        """
        Retourne les métriques quotidiennes (MLL) pour ce compte.
        """
        try:
            account = self.get_object()
            
            # Filtrer par période si fournie
            start_date = request.query_params.get('start_date', None)
            end_date = request.query_params.get('end_date', None)
            
            queryset = AccountDailyMetrics.objects.filter(trading_account=account)  # type: ignore
            
            if start_date:
                queryset = queryset.filter(date__gte=start_date)
            if end_date:
                queryset = queryset.filter(date__lte=end_date)
            
            queryset = queryset.order_by('date')
            
            serializer = AccountDailyMetricsSerializer(queryset, many=True)
            return Response(serializer.data)
        except Exception as e:
            return Response(
                {'error': f'Erreur lors de la récupération des métriques: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CurrencyViewSet(viewsets.ReadOnlyModelViewSet):
    """Liste des devises disponibles."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CurrencySerializer  # type: ignore

    def get_queryset(self):
        return Currency.objects.all()


class AccountTransactionViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour gérer les transactions de compte (dépôts et retraits).
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AccountTransactionSerializer  # type: ignore
    
    def get_queryset(self):
        """Retourne uniquement les transactions de l'utilisateur connecté."""
        if not self.request.user.is_authenticated:
            return AccountTransaction.objects.none()  # type: ignore
        
        queryset = AccountTransaction.objects.filter(user=self.request.user)  # type: ignore
        
        # Filtre par compte de trading (optionnel)
        trading_account_id = self.request.query_params.get('trading_account', None)
        if trading_account_id:
            queryset = queryset.filter(trading_account_id=trading_account_id)
        
        # Filtre par type de transaction (optionnel)
        transaction_type = self.request.query_params.get('transaction_type', None)
        if transaction_type:
            queryset = queryset.filter(transaction_type=transaction_type)
        
        # Filtre par date de début (optionnel)
        start_date = self.request.query_params.get('start_date', None)
        if start_date and isinstance(start_date, str):
            start_date_str: str = start_date  # Type narrowing pour le type checker
            try:
                start_dt = datetime.strptime(start_date_str, '%Y-%m-%d')
                queryset = queryset.filter(transaction_date__gte=start_dt)
            except ValueError:
                pass
        
        # Filtre par date de fin (optionnel)
        end_date = self.request.query_params.get('end_date', None)
        if end_date and isinstance(end_date, str):
            end_date_str: str = end_date  # Type narrowing pour le type checker
            try:
                end_dt = datetime.strptime(end_date_str, '%Y-%m-%d')
                # Ajouter 23h59 pour inclure toute la journée
                end_dt = end_dt.replace(hour=23, minute=59, second=59)
                queryset = queryset.filter(transaction_date__lte=end_dt)
            except ValueError:
                pass
        
        return queryset.select_related('trading_account', 'user').order_by('-transaction_date', '-created_at')
    
    def perform_create(self, serializer):
        """Associe automatiquement la transaction à l'utilisateur connecté."""
        serializer.save(user=self.request.user)
    
    @action(detail=False, methods=['get'])
    def balance(self, request):
        """
        Retourne le solde actuel d'un compte en tenant compte des transactions.
        """
        trading_account_id = request.query_params.get('trading_account', None)
        if not trading_account_id:
            return Response(
                {'error': 'Le paramètre trading_account est requis'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            account = TradingAccount.objects.get(id=trading_account_id, user=request.user)  # type: ignore
        except TradingAccount.DoesNotExist:  # type: ignore
            return Response(
                {'error': 'Compte de trading non trouvé'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Calculer le solde initial
        initial_capital = account.initial_capital or Decimal('0')
        
        # Calculer le PnL total des trades
        trades = account.topstep_trades.all()
        total_pnl = trades.aggregate(total=Sum('net_pnl'))['total'] or Decimal('0')
        
        # Calculer le total des transactions (dépôts - retraits)
        transactions = account.transactions.all()
        total_deposits = transactions.filter(transaction_type='deposit').aggregate(
            total=Sum('amount')
        )['total'] or Decimal('0')
        total_withdrawals = transactions.filter(transaction_type='withdrawal').aggregate(
            total=Sum('amount')
        )['total'] or Decimal('0')
        net_transactions = total_deposits - total_withdrawals
        
        # Solde actuel = capital initial + PnL + transactions nettes
        current_balance = initial_capital + total_pnl + net_transactions
        
        return Response({
            'trading_account_id': account.id,
            'trading_account_name': account.name,
            'initial_capital': str(initial_capital),
            'total_pnl': str(total_pnl),
            'total_deposits': str(total_deposits),
            'total_withdrawals': str(total_withdrawals),
            'net_transactions': str(net_transactions),
            'current_balance': str(current_balance),
            'currency': account.currency,
        })


class TopStepTradeViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour gérer les trades TopStep.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get_serializer_class(self):  # type: ignore
        if self.action == 'list':
            return TopStepTradeListSerializer
        return TopStepTradeSerializer
    
    def get_queryset(self):
        """Retourne uniquement les trades de l'utilisateur connecté avec optimisations de requêtes."""
        if not self.request.user.is_authenticated:
            return TopStepTrade.objects.none()  # type: ignore
        queryset = (
            TopStepTrade.objects
            .filter(user=self.request.user)  # type: ignore
            .select_related('trading_account', 'user')
            .order_by('-entered_at')
        )
        
        # Filtre par compte de trading (uniquement si fourni)
        trading_account_id = self.request.query_params.get('trading_account', None)
        if trading_account_id:
            queryset = queryset.filter(trading_account_id=trading_account_id)
        
        # Filtres optionnels
        contract = self.request.query_params.get('contract', None)
        trade_type = self.request.query_params.get('type', None)
        start_date = self.request.query_params.get('start_date', None)
        end_date = self.request.query_params.get('end_date', None)
        profitable = self.request.query_params.get('profitable', None)
        trade_day = self.request.query_params.get('trade_day', None)
        
        if contract:
            queryset = queryset.filter(contract_name=contract)
        if trade_type:
            queryset = queryset.filter(trade_type=trade_type)
        if start_date:
            # Convertir la date de début en datetime timezone-aware
            try:
                start_datetime = datetime.strptime(start_date, '%Y-%m-%d')  # type: ignore
                # Ajouter le timezone Europe/Paris pour la date de début (00:00:00)
                paris_tz = pytz.timezone('Europe/Paris')
                start_datetime = paris_tz.localize(start_datetime)
                queryset = queryset.filter(entered_at__gte=start_datetime)
            except ValueError:
                pass  # Ignorer les dates mal formatées
        
        if end_date:
            # Convertir la date de fin en datetime timezone-aware
            try:
                end_datetime = datetime.strptime(end_date, '%Y-%m-%d')  # type: ignore
                # Ajouter le timezone Europe/Paris pour la date de fin (23:59:59)
                paris_tz = pytz.timezone('Europe/Paris')
                end_datetime = paris_tz.localize(end_datetime.replace(hour=23, minute=59, second=59))
                queryset = queryset.filter(entered_at__lte=end_datetime)
            except ValueError:
                pass  # Ignorer les dates mal formatées
        if profitable is not None:
            if profitable.lower() == 'true':  # type: ignore
                queryset = queryset.filter(net_pnl__gt=0)
            elif profitable.lower() == 'false':  # type: ignore
                queryset = queryset.filter(net_pnl__lt=0)
        
        if trade_day:
            # Filtrer par date de trade spécifique
            try:
                from datetime import date
                trade_date = date.fromisoformat(trade_day)  # type: ignore
                queryset = queryset.filter(trade_day=trade_date)
            except ValueError:
                pass  # Ignorer les dates mal formatées
        
        return queryset.order_by('-entered_at')
    
    @action(detail=False, methods=['delete'])
    def clear_all(self, request):
        """
        Supprime tous les trades et les logs d'import de l'utilisateur connecté (reset complet).
        Les stratégies associées sont automatiquement supprimées.
        """
        if not request.user.is_authenticated:
            return Response({'error': 'Authentification requise'}, status=status.HTTP_401_UNAUTHORIZED)
        
        # Compter les stratégies avant suppression (seulement pour l'utilisateur connecté)
        total_strategies = TradeStrategy.objects.filter(user=request.user).count()  # type: ignore
        
        # Supprimer seulement les données de l'utilisateur connecté
        TopStepTrade.objects.filter(user=request.user).delete()  # type: ignore
        TopStepImportLog.objects.filter(user=request.user).delete()  # type: ignore
        
        return Response({ 
            'success': True, 
            'message': 'Historique réinitialisé.',
            'deleted_strategies_count': total_strategies
        })

    @action(detail=False, methods=['delete'])
    def clear_by_date(self, request):
        """
        Supprime tous les trades d'une date spécifique de l'utilisateur connecté et leurs stratégies associées.
        """
        if not request.user.is_authenticated:
            return Response({'error': 'Authentification requise'}, status=status.HTTP_401_UNAUTHORIZED)
        
        date = request.query_params.get('date')
        if not date:
            return Response({'error': 'Paramètre date requis (format: YYYY-MM-DD)'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Convertir la date en datetime timezone-aware
            from datetime import datetime
            trade_date = datetime.strptime(date, '%Y-%m-%d').date()
            
            # Récupérer les trades de cette date pour l'utilisateur connecté uniquement
            trades_to_delete = TopStepTrade.objects.filter(trade_day=trade_date, user=request.user)  # type: ignore
            
            # Compter les stratégies associées
            strategy_count = TradeStrategy.objects.filter(trade__in=trades_to_delete).count()  # type: ignore
            
            # Supprimer les trades (les stratégies seront supprimées automatiquement)
            deleted_count = trades_to_delete.count()
            trades_to_delete.delete()
            
            return Response({
                'success': True,
                'message': f'{deleted_count} trades supprimés pour la date {date}',
                'deleted_trades_count': deleted_count,
                'deleted_strategies_count': strategy_count
            })
            
        except ValueError:
            return Response({'error': 'Format de date invalide. Utilisez YYYY-MM-DD'}, 
                          status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """
        Retourne les statistiques globales des trades.
        """
        trades = self.get_queryset()
        
        if not trades.exists():
            return Response({
                'total_trades': 0,
                'winning_trades': 0,
                'losing_trades': 0,
                'win_rate': 0,
                'total_pnl': 0,
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
                'sharpe_ratio': 0.0,
                'sortino_ratio': 0.0,
                'calmar_ratio': 0.0,
                'trade_efficiency': 0.0,
                'current_winning_streak_days': 0,
                'avg_planned_rr': 0.0,
                'avg_actual_rr': 0.0,
                'trades_with_planned_rr': 0,
                'trades_with_actual_rr': 0,
                'trades_with_both_rr': 0,
                'plan_respect_rate': 0.0
            })
        
        # Statistiques de base
        total_trades = trades.count()
        winning_trades = trades.filter(net_pnl__gt=0).count()
        losing_trades = trades.filter(net_pnl__lt=0).count()
        win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0
        
        # Agrégations
        aggregates = trades.aggregate(
            total_pnl=Sum('net_pnl'),
            average_pnl=Avg('net_pnl'),
            total_fees=Sum('fees'),
            total_volume=Sum('size'),
            total_raw_pnl=Sum('pnl')
        )
        
        # Meilleur trade : le plus gros gain parmi les trades gagnants uniquement
        # Si aucun trade gagnant, best_trade = 0 (ne pas afficher)
        best_trade = trades.filter(net_pnl__gt=0).aggregate(best=Max('net_pnl'))['best']
        if best_trade is None:
            best_trade = Decimal('0')
        
        # Pire trade : le plus gros loss parmi les trades perdants uniquement
        # Si aucun trade perdant, worst_trade = 0 (ne pas afficher)
        worst_trade = trades.filter(net_pnl__lt=0).aggregate(worst=Min('net_pnl'))['worst']
        if worst_trade is None:
            worst_trade = Decimal('0')
        
        # Calculs séparés pour gains et pertes
        winning_trades_aggregate = trades.filter(net_pnl__gt=0).aggregate(
            total_gains=Sum('net_pnl')
        )
        losing_trades_aggregate = trades.filter(net_pnl__lt=0).aggregate(
            total_losses=Sum('net_pnl')
        )
        
        total_gains = winning_trades_aggregate['total_gains'] or Decimal('0')
        total_losses = losing_trades_aggregate['total_losses'] or Decimal('0')
        
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
        
        # 6. Ratio de Frais
        # Le ratio représente le pourcentage des frais par rapport au P/L (en valeur absolue)
        # Cela permet d'avoir un ratio cohérent même quand le P/L est négatif
        fees_ratio = 0
        if aggregates['total_pnl'] and aggregates['total_pnl'] != 0:
            fees_ratio = abs(aggregates['total_fees']) / abs(aggregates['total_pnl'])
        
        # 7. Ratio Volume/P/L
        volume_pnl_ratio = 0
        if aggregates['total_volume'] and aggregates['total_volume'] != 0:
            volume_pnl_ratio = aggregates['total_pnl'] / aggregates['total_volume']
        
        # 8. Ratio de Fréquence (trades par jour)
        frequency_ratio = 0
        if total_trades > 0:
            # Calculer le nombre de jours uniques de trading
            unique_days = trades.values('entered_at__date').distinct().count()
            if unique_days > 0:
                frequency_ratio = total_trades / unique_days
        
        # 9. Ratio de Durée (nécessite des calculs supplémentaires)
        duration_ratio = 0
        winning_trades_duration = trades.filter(net_pnl__gt=0, trade_duration__isnull=False).aggregate(
            avg_duration=Avg('trade_duration')
        )['avg_duration']
        losing_trades_duration = trades.filter(net_pnl__lt=0, trade_duration__isnull=False).aggregate(
            avg_duration=Avg('trade_duration')
        )['avg_duration']
        
        if winning_trades_duration and losing_trades_duration:
            winning_seconds = winning_trades_duration.total_seconds()
            losing_seconds = losing_trades_duration.total_seconds()
            if losing_seconds > 0:
                duration_ratio = winning_seconds / losing_seconds
        
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
                cumulative_capital += trade.net_pnl
                
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
                    cumulative_pnl += trade.net_pnl
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
                    cumulative_pnl += trade.net_pnl
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
        if trading_account_id:
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
                    paris_tz = pytz.timezone('Europe/Paris')
                    start_datetime = paris_tz.localize(start_datetime)
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
                    paris_tz = pytz.timezone('Europe/Paris')
                    start_datetime = paris_tz.localize(start_datetime)
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
                        TopStepTrade.objects
                        .filter(user=request.user)  # type: ignore
                    )
                    if trading_account_id:
                        trades_before_period = trades_before_period.filter(trading_account_id=trading_account_id)
                    trades_before_period = trades_before_period.filter(entered_at__lt=start_datetime)
                    
                    pnl_before_period = trades_before_period.aggregate(total=Sum('net_pnl'))['total'] or Decimal('0')
                    period_start_capital = initial_capital + pnl_before_period
                except Exception:
                    # En cas d'erreur, utiliser le capital initial
                    period_start_capital = initial_capital
        
        # Max drawdown de la période (avec filtres de date)
        max_drawdown, max_drawdown_pct, peak_capital = calculate_max_drawdown(trades, period_start_capital)
        
        # Max drawdown global (sans filtres de date, mais avec les autres filtres comme le compte)
        # Créer un queryset global en gardant les filtres de compte mais sans les filtres de date
        global_trades = (
            TopStepTrade.objects
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
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Erreur calcul max_runup période: {e}")
            max_runup, max_runup_pct, trough_capital = (0.0, 0.0, 0.0)
        
        # Max run-up global (sans filtres de date, mais avec les autres filtres comme le compte)
        try:
            max_runup_global, max_runup_global_pct, trough_capital_global = calculate_max_runup(global_trades, initial_capital)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
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
        trades_with_zero_pnl = trades.filter(net_pnl=0)
        
        # Trades gagnants (P/L > 0) sans TP atteint (tp1_reached = False et tp2_plus_reached = False)
        winning_trades_without_tp = trades.filter(
            net_pnl__gt=0
        ).filter(
            Exists(
                TradeStrategy.objects.filter(
                    trade=OuterRef('pk')
                ).filter(
                    Q(tp1_reached=False) & Q(tp2_plus_reached=False)
                )
            )
        )
        
        # Compter les deux types de break-even
        break_even_trades = trades_with_zero_pnl.count() + winning_trades_without_tp.count()
        
        # 14. Sharpe Ratio (rendement ajusté à la volatilité)
        sharpe_ratio = 0.0
        if total_trades > 1:
            pnl_values = list(trades.values_list('net_pnl', flat=True))
            if len(pnl_values) > 1:
                import statistics
                mean_pnl = statistics.mean([float(v) for v in pnl_values])
                std_pnl = statistics.stdev([float(v) for v in pnl_values])
                if std_pnl > 0:
                    sharpe_ratio = mean_pnl / std_pnl
        
        # 15. Sortino Ratio (similaire au Sharpe mais ne pénalise que la volatilité négative)
        sortino_ratio = 0.0
        if total_trades > 1:
            pnl_values = list(trades.values_list('net_pnl', flat=True))
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
            # Agréger les trades par jour
            daily_data = defaultdict(lambda: {'pnl': Decimal('0.0')})
            for trade in trades:
                day_key = trade.entered_at.date()
                daily_data[day_key]['pnl'] += trade.net_pnl
            
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
            'sharpe_ratio': round(sharpe_ratio, 2),
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
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def contracts(self, request):
        """
        Retourne la liste des contrats tradés.
        """
        contracts = self.get_queryset().values_list('contract_name', flat=True).distinct()
        return Response({'contracts': list(contracts)})

    @action(detail=False, methods=['get'])
    def instruments(self, request):
        """Liste des instruments (contract_name) distincts pour l'utilisateur."""
        if not request.user.is_authenticated:
            return Response({'instruments': []})
        instruments = (
            TopStepTrade.objects
            .filter(user=request.user)  # type: ignore
            .values_list('contract_name', flat=True)
            .distinct()
            .order_by('contract_name')
        )
        return Response({'instruments': list(instruments)})
    
    @action(detail=False, methods=['get'])
    def trading_metrics(self, request):
        """
        Calcule les métriques de trading avancées : risk reward ratio, profit factor, max drawdown.
        """
        trades = self.get_queryset()
        
        if not trades.exists():
            return Response({
                'risk_reward_ratio': 0.0,
                'profit_factor': 0.0,
                'max_drawdown': 0.0,
                'win_rate': 0.0,
                'recovery_factor': 0.0,
                'expectancy': 0.0,
                'sharpe_ratio': 0.0
            })
        
        # Séparer les trades gagnants et perdants
        winning_trades = trades.filter(net_pnl__gt=0)
        losing_trades = trades.filter(net_pnl__lt=0)
        
        # Calcul du Risk Reward Ratio
        risk_reward_ratio = 0.0
        if winning_trades.exists() and losing_trades.exists():
            avg_win = winning_trades.aggregate(avg=Avg('net_pnl'))['avg']
            avg_loss = abs(losing_trades.aggregate(avg=Avg('net_pnl'))['avg'])
            if avg_loss > 0:
                risk_reward_ratio = float(avg_win / avg_loss)
        
        # Calcul du Profit Factor
        profit_factor = 0.0
        total_profits = winning_trades.aggregate(total=Sum('net_pnl'))['total'] or Decimal('0')
        total_losses = abs(losing_trades.aggregate(total=Sum('net_pnl'))['total'] or Decimal('0'))
        if total_losses > 0:
            profit_factor = float(total_profits / total_losses)
        
        # Calcul du Max Drawdown
        max_drawdown = 0.0
        if trades.exists():
            # Trier les trades par date d'entrée
            trades_ordered = trades.order_by('entered_at')
            
            # Calculer le capital cumulé
            cumulative_capital = Decimal('0')
            peak_capital = Decimal('0')
            max_dd = Decimal('0')
            
            for trade in trades_ordered:
                cumulative_capital += trade.net_pnl
                if cumulative_capital > peak_capital:
                    peak_capital = cumulative_capital
                
                # Calculer le drawdown actuel seulement si on est en dessous du pic
                if cumulative_capital < peak_capital and peak_capital != 0:
                    # Calculer le drawdown en pourcentage depuis le pic
                    # Si le pic est positif, calcul standard
                    if peak_capital > 0:
                        current_dd = ((peak_capital - cumulative_capital) / peak_capital) * 100
                    # Si le pic est négatif, on mesure l'aggravation de la perte
                    # en utilisant la valeur absolue du pic comme référence
                    else:
                        # Pour un pic négatif, cumulative est encore plus négatif
                        # Le drawdown représente l'augmentation de la perte en pourcentage
                        current_dd = ((cumulative_capital - peak_capital) / abs(peak_capital)) * 100
                    
                    if current_dd > max_dd:
                        max_dd = current_dd
            
            max_drawdown = float(max_dd)
        
        # Calcul du Win Rate
        total_trades = trades.count()
        winning_trades_count = winning_trades.count()
        win_rate = (winning_trades_count / total_trades * 100) if total_trades > 0 else 0.0
        
        
        # Calcul du Recovery Factor
        recovery_factor = 0.0
        if max_drawdown > 0:
            # Le Recovery Factor = Profit Net / Max Drawdown (en valeur absolue)
            total_pnl = trades.aggregate(total=Sum('net_pnl'))['total'] or Decimal('0')
            # Calculer le drawdown en valeur absolue (pas en pourcentage)
            if trades.exists():
                trades_ordered = trades.order_by('entered_at')
                cumulative_capital = Decimal('0')
                peak_capital = Decimal('0')
                max_dd_absolute = Decimal('0')
                
                for trade in trades_ordered:
                    cumulative_capital += trade.net_pnl
                    if cumulative_capital > peak_capital:
                        peak_capital = cumulative_capital
                    
                    # Calculer le drawdown absolu actuel
                    current_dd_absolute = peak_capital - cumulative_capital
                    if current_dd_absolute > max_dd_absolute:
                        max_dd_absolute = current_dd_absolute
                
                if max_dd_absolute > 0:
                    recovery_factor = float(total_pnl / max_dd_absolute)
        
        # Calcul de l'Expectancy
        expectancy = 0.0
        if total_trades > 0:
            total_pnl = trades.aggregate(total=Sum('net_pnl'))['total'] or Decimal('0')
            expectancy = float(total_pnl / total_trades)
        
        # Calcul du Sharpe Ratio (simplifié)
        sharpe_ratio = 0.0
        if total_trades > 1:
            # Calculer la volatilité des rendements
            pnl_values = list(trades.values_list('net_pnl', flat=True))
            if len(pnl_values) > 1:
                import statistics
                mean_pnl = statistics.mean(pnl_values)
                std_pnl = statistics.stdev(pnl_values) if len(pnl_values) > 1 else 0
                if std_pnl > 0:
                    sharpe_ratio = mean_pnl / std_pnl
        
        metrics = {
            'risk_reward_ratio': round(risk_reward_ratio, 2),
            'profit_factor': round(profit_factor, 2),
            'max_drawdown': round(max_drawdown, 2),
            'win_rate': round(win_rate, 2),
            'recovery_factor': round(recovery_factor, 2),
            'expectancy': round(expectancy, 2),
            'sharpe_ratio': round(sharpe_ratio, 2)
        }
        
        serializer = TradingMetricsSerializer(metrics)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload_csv(self, request):
        """
        Upload et import d'un fichier CSV TopStep.
        """
        from django.contrib.auth.models import User
        import logging
        logger = logging.getLogger(__name__)
        
        # Log de la requête
        logger.info(f"=== DEBUT UPLOAD CSV ===")
        logger.info(f"Fichiers reçus: {list(request.FILES.keys())}")
        logger.info(f"Data reçue: {list(request.data.keys())}")
        
        serializer = CSVUploadSerializer(data=request.data)
        
        if not serializer.is_valid():
            logger.error(f"Validation serializer échouée: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        csv_file = serializer.validated_data.get('file')  # type: ignore
        if not csv_file:
            return Response({'error': 'Fichier CSV requis'}, status=status.HTTP_400_BAD_REQUEST)
        logger.info(f"Fichier validé: {csv_file.name} ({csv_file.size} bytes)")
        
        try:
            # Lire le contenu du fichier et supprimer le BOM si présent
            content = csv_file.read().decode('utf-8-sig')  # utf-8-sig supprime automatiquement le BOM
            logger.info(f"Contenu lu: {len(content)} caractères")
            logger.info(f"Premières lignes:\n{content[:500]}")
            
            # Utiliser l'utilisateur connecté
            user = request.user
            logger.info(f"Utilisateur: {user.username}")
            
            # Récupérer le compte de trading (paramètre optionnel)
            trading_account_id = request.data.get('trading_account')
            trading_account = None
            if trading_account_id:
                try:
                    trading_account = TradingAccount.objects.get(  # type: ignore
                        id=trading_account_id, 
                        user=user
                    )
                    logger.info(f"Compte de trading sélectionné: {trading_account.name}")
                except TradingAccount.DoesNotExist:  # type: ignore
                    return Response({
                        'error': 'Compte de trading invalide'
                    }, status=status.HTTP_400_BAD_REQUEST)
            else:
                # Utiliser le compte par défaut
                trading_account = TradingAccount.objects.filter(  # type: ignore
                    user=user, 
                    is_default=True
                ).first()
                if trading_account:
                    logger.info(f"Utilisation du compte par défaut: {trading_account.name}")
                else:
                    return Response({
                        'error': 'Aucun compte de trading par défaut trouvé. Veuillez créer un compte de trading d\'abord.'
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            # Récupérer le paramètre dry_run (pour l'aperçu)
            dry_run = request.data.get('dry_run', 'false').lower() == 'true'
            
            # Importer via l'utilitaire
            importer = TopStepCSVImporter(user, trading_account)
            result = importer.import_from_string(content, csv_file.name, dry_run=dry_run)
            
            # Log des résultats
            logger.info(f"Résultat import: success={result.get('success')}, total={result.get('total_rows')}, success_count={result.get('success_count')}, skipped={result.get('skipped_count')}, errors={result.get('error_count')}")
            
            # Log des erreurs détaillées
            if result.get('error_count', 0) > 0 and result.get('errors'):
                logger.error(f"=== ERREURS D'IMPORT ({len(result['errors'])} erreurs) ===")
                for err in result['errors']:
                    logger.error(f"  Ligne {err.get('row')}: {err.get('error')}")
                    logger.error(f"    Données: {err.get('data')}")
            
            # Log des colonnes manquantes
            if not result.get('success') and result.get('missing_columns'):
                logger.error(f"=== COLONNES MANQUANTES ===")
                logger.error(f"  Colonnes manquantes: {result.get('missing_columns')}")
                logger.error(f"  Erreur: {result.get('error')}")
            
            if result['success']:
                # Construire un message détaillé
                message_parts = []
                if result['success_count'] > 0:
                    message_parts.append(f"{result['success_count']} trade{'s' if result['success_count'] > 1 else ''} importé{'s' if result['success_count'] > 1 else ''}")
                
                if result.get('skipped_count', 0) > 0:
                    message_parts.append(f"{result['skipped_count']} doublon{'s' if result['skipped_count'] > 1 else ''} ignoré{'s' if result['skipped_count'] > 1 else ''}")
                
                if result['error_count'] > 0:
                    message_parts.append(f"{result['error_count']} erreur{'s' if result['error_count'] > 1 else ''}")
                
                final_message = "Import terminé : " + ", ".join(message_parts) if message_parts else "Aucun trade à importer"
                
                response_data = {
                    'success': True,
                    'message': final_message,
                    'total_rows': result['total_rows'],
                    'success_count': result['success_count'],
                    'error_count': result['error_count'],
                    'skipped_count': result.get('skipped_count', 0),
                    'errors': result.get('errors', [])
                }
                # Ajouter les totaux PnL et fees si disponibles
                if 'total_pnl' in result:
                    response_data['total_pnl'] = result['total_pnl']
                if 'total_fees' in result:
                    response_data['total_fees'] = result['total_fees']
                
                return Response(response_data, status=status.HTTP_201_CREATED)
            else:
                return Response({
                    'success': False,
                    'error': result.get('error', 'Erreur inconnue')
                }, status=status.HTTP_400_BAD_REQUEST)
        
        except Exception as e:
            logger.error(f"=== EXCEPTION LORS DE L'IMPORT ===")
            logger.error(f"Type: {type(e).__name__}")
            logger.error(f"Message: {str(e)}")
            logger.exception("Stack trace complète:")
            return Response({
                'success': False,
                'error': f"Erreur lors de l'import : {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        finally:
            logger.info(f"=== FIN UPLOAD CSV ===")

    @action(detail=False, methods=['get'])
    def capital_evolution(self, request):
        """
        Retourne les données pour le graphique d'évolution du capital par jour.
        """
        trades = self.get_queryset()
        
        if not trades.exists():
            return Response([])
        
        # Agréger les PnL par jour
        pnl_by_day = defaultdict(float)
        for trade in trades:
            date = trade.entered_at.date()
            pnl_by_day[date] += float(trade.net_pnl)
        
        # Ordonner les jours chronologiquement et calculer le cumul
        sorted_dates = sorted(pnl_by_day.keys())
        cumulative = 0
        result = []
        
        for date in sorted_dates:
            daily_pnl = pnl_by_day[date]
            cumulative += daily_pnl
            result.append({
                'date': date.strftime('%d/%m/%Y'),
                'pnl': daily_pnl,
                'cumulative': cumulative,
                'is_positive': daily_pnl >= 0
            })
        
        return Response(result)

    @action(detail=False, methods=['get'])
    def weekday_performance(self, request):
        """
        Retourne les données pour le graphique de performance par jour de la semaine.
        """
        trades = self.get_queryset()
        
        if not trades.exists():
            return Response([])
        
        # Agréger les données par jour de la semaine
        weekday_stats = defaultdict(lambda: {
            'total_pnl': 0.0,
            'trade_count': 0,
            'winning_trades': 0
        })
        
        for trade in trades:
            weekday = trade.entered_at.strftime('%A')
            pnl = float(trade.net_pnl)
            
            weekday_stats[weekday]['total_pnl'] += pnl
            weekday_stats[weekday]['trade_count'] += 1
            if pnl > 0:
                weekday_stats[weekday]['winning_trades'] += 1
        
        # Convertir en format pour le graphique
        weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        weekday_names_fr = {
            'Monday': 'Lundi',
            'Tuesday': 'Mardi', 
            'Wednesday': 'Mercredi',
            'Thursday': 'Jeudi',
            'Friday': 'Vendredi',
            'Saturday': 'Samedi',
            'Sunday': 'Dimanche'
        }
        
        result = []
        for weekday in weekdays:
            stats = weekday_stats[weekday]
            result.append({
                'day': weekday_names_fr[weekday],
                'total_pnl': stats['total_pnl'],
                'trade_count': stats['trade_count'],
                'win_rate': (stats['winning_trades'] / stats['trade_count'] * 100) if stats['trade_count'] > 0 else 0,
                'average_pnl': stats['total_pnl'] / stats['trade_count'] if stats['trade_count'] > 0 else 0
            })
        
        return Response(result)

    @action(detail=False, methods=['get'])
    def calendar_data(self, request):
        """
        Retourne les données pour le calendrier mensuel (P/L par jour et par semaine).
        """
        trades = self.get_queryset()
        
        if not trades.exists():
            return Response({
                'daily_data': [],
                'weekly_data': [],
                'monthly_total': 0
            })
        
        # Récupérer les paramètres de date
        year = request.query_params.get('year')
        month = request.query_params.get('month')
        
        if not year or not month:
            # Utiliser le mois courant par défaut
            now = timezone.now()
            year = now.year
            month = now.month
        else:
            year = int(year)
            month = int(month)
        
        # Filtrer les trades du mois spécifié
        start_date = timezone.datetime(year, month, 1)
        if month == 12:
            end_date = timezone.datetime(year + 1, 1, 1)
        else:
            end_date = timezone.datetime(year, month + 1, 1)
        
        month_trades = trades.filter(
            entered_at__gte=start_date,
            entered_at__lt=end_date
        )
        
        # Récupérer toutes les stratégies pour ce mois
        month_strategies = TradeStrategy.objects.filter(
            user=request.user,
            trade__in=month_trades
        ).select_related('trade')
        
        # Récupérer les compliances pour les jours sans trades de ce mois
        month_compliances = DayStrategyCompliance.objects.filter(  # type: ignore
            user=request.user,
            date__gte=start_date.date(),
            date__lt=end_date.date()
        ).select_related('trading_account')
        
        # Filtrer par compte de trading si spécifié
        trading_account_id = request.query_params.get('trading_account')
        if trading_account_id:
            try:
                trading_account_id = int(trading_account_id)
                month_compliances = month_compliances.filter(
                    trading_account_id=trading_account_id
                )
            except (ValueError, TypeError):
                # Ignorer si l'ID n'est pas valide
                pass
        
        # Créer une map des compliances par jour (pour jours sans trades)
        compliances_by_day = {}
        for compliance in month_compliances:
            day = compliance.date.day
            # Convertir strategy_respected en statut de compliance
            if compliance.strategy_respected is True:
                compliances_by_day[day] = 'compliant'
            elif compliance.strategy_respected is False:
                compliances_by_day[day] = 'non_compliant'
            else:
                compliances_by_day[day] = 'unknown'
        
        # Créer une map des stratégies par jour
        strategies_by_day = defaultdict(lambda: {'total': 0, 'respected': 0, 'non_respected': 0, 'unknown': 0})
        for strategy in month_strategies:
            try:
                trade_day = strategy.trade.trade_day
                if trade_day:
                    # trade_day est un objet date, on peut accéder directement à .day
                    day = trade_day.day
                    strategies_by_day[day]['total'] += 1
                    if strategy.strategy_respected is True:
                        strategies_by_day[day]['respected'] += 1
                    elif strategy.strategy_respected is False:
                        strategies_by_day[day]['non_respected'] += 1
                    else:
                        strategies_by_day[day]['unknown'] += 1
            except (AttributeError, TypeError, ValueError):
                # Ignorer les stratégies avec des données invalides
                continue
        
        # Agréger par jour
        daily_data = defaultdict(lambda: {'pnl': 0.0, 'trade_count': 0})
        for trade in month_trades:
            try:
                day = trade.entered_at.day
                daily_data[day]['pnl'] += float(trade.net_pnl or 0)
                daily_data[day]['trade_count'] += 1
            except (AttributeError, TypeError, ValueError):
                continue
        
        # Fonction pour déterminer le statut de compliance
        def get_strategy_compliance_status(day):
            total_trades = daily_data.get(day, {}).get('trade_count', 0)
            
            # Si aucun trade pour ce jour, vérifier s'il y a une compliance pour jour sans trade
            if total_trades == 0:
                return compliances_by_day.get(day, None)
            
            # Si ce jour n'a pas de stratégies renseignées
            if day not in strategies_by_day:
                return 'unknown'
            
            day_stats = strategies_by_day[day]
            trades_with_strategy = day_stats['total']
            
            # Si aucun trade n'a de stratégie renseignée
            if trades_with_strategy == 0:
                return 'unknown'
            
            # Si tous les trades avec stratégie ont strategy_respected = True
            # ET que tous les trades du jour ont une stratégie renseignée
            if (day_stats['respected'] == trades_with_strategy and 
                day_stats['non_respected'] == 0 and 
                day_stats['unknown'] == 0 and
                trades_with_strategy == total_trades):
                return 'compliant'
            
            # Si tous les trades avec stratégie ont strategy_respected = False
            # ET que tous les trades du jour ont une stratégie renseignée
            if (day_stats['non_respected'] == trades_with_strategy and 
                day_stats['respected'] == 0 and
                day_stats['unknown'] == 0 and
                trades_with_strategy == total_trades):
                return 'non_compliant'
            
            # Mix de True et False, ou certains trades sans stratégie
            if day_stats['respected'] > 0 or day_stats['non_respected'] > 0:
                return 'partial'
            
            return 'unknown'
        
        # Convertir en format pour le frontend
        daily_result = []
        for day in range(1, 32):  # Maximum 31 jours dans un mois
            if day in daily_data:
                compliance_status = get_strategy_compliance_status(day)
                daily_result.append({
                    'date': str(day),
                    'pnl': daily_data[day]['pnl'],
                    'trade_count': daily_data[day]['trade_count'],
                    'strategy_compliance_status': compliance_status
                })
            else:
                # Jour sans trade - vérifier s'il y a une compliance
                compliance_status = compliances_by_day.get(day, None)
                daily_result.append({
                    'date': str(day),
                    'pnl': 0.0,
                    'trade_count': 0,
                    'strategy_compliance_status': compliance_status
                })
        
        # Agréger par semaine (vraies semaines du calendrier - dimanche à samedi)
        weekly_data = defaultdict(lambda: {'pnl': 0.0, 'trade_count': 0})
        
        # Calculer le premier jour du mois et son jour de la semaine
        first_day = start_date.date()
        first_weekday = first_day.weekday()  # 0 = Lundi, 6 = Dimanche
        
        for trade in month_trades:
            trade_date = trade.entered_at.date()
            day_of_month = trade_date.day
            
            # Calculer dans quelle semaine du calendrier ce jour tombe
            # Le calendrier commence par dimanche (weekday = 6)
            # Semaine 1: du dimanche précédent le 1er jour jusqu'au samedi suivant
            # Semaine 2: du dimanche suivant jusqu'au samedi suivant, etc.
            
            # Ajuster pour que dimanche soit le début de la semaine
            # Si le 1er jour est dimanche (weekday=6), c'est la semaine 1
            # Si le 1er jour est lundi (weekday=0), on remonte au dimanche précédent
            days_from_start = (trade_date - first_day).days
            adjusted_days = days_from_start + (6 - first_weekday)  # Ajuster pour commencer par dimanche
            week_number = adjusted_days // 7 + 1
            
            weekly_data[week_number]['pnl'] += float(trade.net_pnl)
            weekly_data[week_number]['trade_count'] += 1
        
        # Convertir en format pour le frontend
        weekly_result = []
        for week in range(1, 7):  # Maximum 6 semaines
            if week in weekly_data:
                weekly_result.append({
                    'week': week,
                    'pnl': weekly_data[week]['pnl'],
                    'trade_count': weekly_data[week]['trade_count']
                })
            else:
                weekly_result.append({
                    'week': week,
                    'pnl': 0.0,
                    'trade_count': 0
                })
        
        # Calculer le total mensuel
        monthly_total = sum(float(trade.net_pnl) for trade in month_trades)
        
        return Response({
            'daily_data': daily_result,
            'weekly_data': weekly_result,
            'monthly_total': monthly_total,
            'year': year,
            'month': month
        })

    @action(detail=False, methods=['get'])
    def calendar_monthly_data(self, request):
        """
        Retourne les données pour le calendrier annuel (P/L par mois).
        """
        trades = self.get_queryset()
        
        if not trades.exists():
            return Response({
                'monthly_data': [],
                'yearly_total': 0
            })
        
        # Récupérer le paramètre d'année
        year = request.query_params.get('year')
        
        if not year:
            # Utiliser l'année courante par défaut
            now = timezone.now()
            year = now.year
        else:
            year = int(year)
        
        # Filtrer les trades de l'année spécifiée
        start_date = timezone.datetime(year, 1, 1)
        end_date = timezone.datetime(year + 1, 1, 1)
        
        year_trades = trades.filter(
            entered_at__gte=start_date,
            entered_at__lt=end_date
        )
        
        # Agréger par mois
        monthly_data = defaultdict(lambda: {'pnl': 0.0, 'trade_count': 0})
        for trade in year_trades:
            month = trade.entered_at.month
            monthly_data[month]['pnl'] += float(trade.net_pnl)
            monthly_data[month]['trade_count'] += 1
        
        # Convertir en format pour le frontend
        monthly_result = []
        for month in range(1, 13):
            if month in monthly_data:
                monthly_result.append({
                    'month': month,
                    'pnl': monthly_data[month]['pnl'],
                    'trade_count': monthly_data[month]['trade_count']
                })
            else:
                monthly_result.append({
                    'month': month,
                    'pnl': 0.0,
                    'trade_count': 0
                })
        
        # Calculer le total annuel
        yearly_total = sum(float(trade.net_pnl) for trade in year_trades)
        
        return Response({
            'monthly_data': monthly_result,
            'yearly_total': yearly_total,
            'year': year
        })

    @action(detail=False, methods=['get'])
    def calendar_weekly_data(self, request):
        """
        Retourne les données hebdomadaires pour une année (P/L par semaine avec samedi).
        """
        trades = self.get_queryset()
        
        if not trades.exists():
            return Response({
                'weekly_data': [],
                'yearly_total': 0
            })
        
        # Récupérer le paramètre d'année
        year = request.query_params.get('year')
        
        if not year:
            # Utiliser l'année courante par défaut
            now = timezone.now()
            year = now.year
        else:
            year = int(year)
        
        # Filtrer les trades de l'année spécifiée
        start_date = timezone.datetime(year, 1, 1)
        end_date = timezone.datetime(year + 1, 1, 1)
        
        year_trades = trades.filter(
            entered_at__gte=start_date,
            entered_at__lt=end_date
        )
        
        # Agréger par semaine (samedi de chaque semaine)
        weekly_data = defaultdict(lambda: {'pnl': 0.0, 'trade_count': 0, 'saturday_date': None})
        
        # Trouver le premier dimanche de l'année (ou le 1er janvier s'il est dimanche)
        first_day = start_date.date()
        first_weekday = first_day.weekday()  # 0 = Lundi, 6 = Dimanche
        
        # Calculer le premier dimanche
        # Si le 1er janvier est dimanche (weekday=6), c'est le premier dimanche
        # Sinon, remonter au dimanche précédent
        # weekday() : 0=Lundi, 1=Mardi, ..., 5=Samedi, 6=Dimanche
        if first_weekday == 6:
            first_sunday = first_day
        else:
            # Pour aller au dimanche précédent: weekday + 1 jours en arrière
            # Ex: Lundi (0) -> 1 jour en arrière, Samedi (5) -> 6 jours en arrière
            days_to_subtract = first_weekday + 1
            first_sunday = first_day - timedelta(days=days_to_subtract)
        
        for trade in year_trades:
            trade_date = trade.entered_at.date()
            
            # Calculer le samedi de la semaine pour ce trade
            days_from_first_sunday = (trade_date - first_sunday).days
            week_number = days_from_first_sunday // 7
            saturday_date = first_sunday + timedelta(days=week_number * 7 + 6)
            
            # S'assurer que le samedi est dans l'année en cours
            if saturday_date.year == year or saturday_date.year == year + 1:
                week_key = saturday_date.isoformat()
                if trade.net_pnl is not None:
                    current_pnl = weekly_data[week_key]['pnl']
                    if current_pnl is None:
                        current_pnl = 0.0
                    weekly_data[week_key]['pnl'] = current_pnl + float(trade.net_pnl)
                current_count = weekly_data[week_key]['trade_count']
                if current_count is None:
                    current_count = 0
                weekly_data[week_key]['trade_count'] = current_count + 1
                if weekly_data[week_key]['saturday_date'] is None:
                    saturday_date_str = saturday_date.isoformat()
                    # Le type checker ne comprend pas que saturday_date peut être une str
                    weekly_data[week_key]['saturday_date'] = cast(Any, saturday_date_str)
        
        # Convertir en format pour le frontend
        weekly_result = []
        for week_key in sorted(weekly_data.keys()):
            saturday_date = weekly_data[week_key]['saturday_date']
            # Ne garder que les semaines de l'année en cours
            # Vérifier que saturday_date est une chaîne avant d'utiliser strptime
            if saturday_date and isinstance(saturday_date, str):
                saturday_date_str: str = saturday_date  # Type narrowing pour le type checker
                if datetime.strptime(saturday_date_str, '%Y-%m-%d').year == year:
                    weekly_result.append({
                        'saturday_date': saturday_date_str,
                        'pnl': weekly_data[week_key]['pnl'],
                        'trade_count': weekly_data[week_key]['trade_count']
                    })
        
        # Calculer le total annuel
        yearly_total = sum(float(trade.net_pnl) for trade in year_trades)
        
        return Response({
            'weekly_data': weekly_result,
            'yearly_total': yearly_total,
            'year': year
        })

    @action(detail=False, methods=['get'])
    def daily_aggregates(self, request):
        """
        Retourne les données agrégées par jour (beaucoup plus rapide que de charger tous les trades).
        Utilise des requêtes SQL GROUP BY pour optimiser les performances.
        """
        # Récupérer les filtres
        trading_account_id = request.query_params.get('trading_account', None)
        start_date = request.query_params.get('start_date', None)
        end_date = request.query_params.get('end_date', None)
        
        # Construire le queryset de base
        queryset = TopStepTrade.objects.filter(user=request.user)  # type: ignore
        
        if trading_account_id:
            queryset = queryset.filter(trading_account_id=trading_account_id)
        
        if start_date:
            try:
                start_datetime = datetime.strptime(start_date, '%Y-%m-%d')
                paris_tz = pytz.timezone('Europe/Paris')
                start_datetime = paris_tz.localize(start_datetime)
                queryset = queryset.filter(entered_at__gte=start_datetime)
            except ValueError:
                pass
        
        if end_date:
            try:
                end_datetime = datetime.strptime(end_date, '%Y-%m-%d')
                paris_tz = pytz.timezone('Europe/Paris')
                end_datetime = paris_tz.localize(end_datetime.replace(hour=23, minute=59, second=59))
                queryset = queryset.filter(entered_at__lte=end_datetime)
            except ValueError:
                pass
        
        # Agréger par jour en utilisant SQL GROUP BY (beaucoup plus rapide)
        # Utiliser trade_day si disponible, sinon utiliser la date de entered_at
        from django.db.models import Q
        from django.db.models.functions import Coalesce
        
        # Utiliser trade_day si disponible, sinon extraire la date de entered_at
        # trade_day est un DateField, donc on peut l'utiliser directement
        daily_aggregates = queryset.annotate(
            date=Coalesce(
                'trade_day',
                TruncDate('entered_at')
            )
        ).values('date').annotate(
            pnl=Sum('net_pnl'),
            trade_count=Count('id'),
            winning_count=Count('id', filter=Q(net_pnl__gt=0)),
            losing_count=Count('id', filter=Q(net_pnl__lt=0)),
        ).order_by('date')
        
        # Convertir en format attendu
        result = []
        for item in daily_aggregates:
            if item['date']:  # Ignorer les dates None
                # Convertir la date en string YYYY-MM-DD
                date_str = item['date']
                if hasattr(date_str, 'strftime'):
                    date_str = date_str.strftime('%Y-%m-%d')
                elif isinstance(date_str, str):
                    # Si c'est déjà une string, vérifier le format
                    pass
                else:
                    date_str = str(date_str)
                
                result.append({
                    'date': date_str,
                    'pnl': float(item['pnl'] or 0),
                    'trade_count': item['trade_count'],
                    'winning_count': item['winning_count'],
                    'losing_count': item['losing_count'],
                })
        
        return Response({
            'results': result,
            'count': len(result)
        })

    @action(detail=False, methods=['get'])
    def analytics(self, request):
        """
        Retourne les analyses détaillées avec toutes les métriques avancées.
        """
        trades = self.get_queryset()
        
        if not trades.exists():
            return Response({
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
                'monthly_performance': []
            })

        # Agréger par jour
        daily_data = defaultdict(lambda: {'pnl': 0.0, 'trade_count': 0, 'trades': []})  # type: ignore
        for trade in trades:
            day_key = trade.entered_at.date()
            daily_data[day_key]['pnl'] += float(trade.net_pnl)  # type: ignore
            daily_data[day_key]['trade_count'] += 1  # type: ignore
            daily_data[day_key]['trades'].append(trade)  # type: ignore

        # Calculer les statistiques quotidiennes
        daily_pnls = [data['pnl'] for data in daily_data.values()]  # type: ignore
        daily_gains = [pnl for pnl in daily_pnls if pnl > 0]  # type: ignore
        daily_losses = [pnl for pnl in daily_pnls if pnl < 0]  # type: ignore
        daily_trade_counts = [data['trade_count'] for data in daily_data.values()]  # type: ignore

        # Statistiques par trade
        winning_trades = [float(trade.net_pnl) for trade in trades if trade.net_pnl > 0]
        losing_trades = [float(trade.net_pnl) for trade in trades if trade.net_pnl < 0]
        all_trade_pnls = [float(trade.net_pnl) for trade in trades]
        
        # Calculer les durées moyennes des trades gagnants et perdants
        winning_trades_duration = trades.filter(net_pnl__gt=0, trade_duration__isnull=False).aggregate(
            avg_duration=Avg('trade_duration')
        )['avg_duration']
        losing_trades_duration = trades.filter(net_pnl__lt=0, trade_duration__isnull=False).aggregate(
            avg_duration=Avg('trade_duration')
        )['avg_duration']
        
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
        trades_sorted = sorted(trades, key=lambda t: t.entered_at)
        max_consecutive_wins = 0
        max_consecutive_losses = 0
        current_consecutive_wins = 0
        current_consecutive_losses = 0
        
        for trade in trades_sorted:
            if trade.net_pnl > 0:
                # Trade gagnant
                current_consecutive_wins += 1
                current_consecutive_losses = 0
                max_consecutive_wins = max(max_consecutive_wins, current_consecutive_wins)
            elif trade.net_pnl < 0:
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
        
        # Monthly Performance
        monthly_performance = {}
        for trade in trades:
            month_key = trade.entered_at.strftime('%Y-%m')
            if month_key not in monthly_performance:
                monthly_performance[month_key] = 0.0
            monthly_performance[month_key] += float(trade.net_pnl)
        
        # Convertir en liste triée
        monthly_list = [
            {'month': month, 'pnl': pnl}
            for month, pnl in sorted(monthly_performance.items())
        ]

        return Response({
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
            'monthly_performance': monthly_list
        })

    @action(detail=False, methods=['get'])
    def hourly_performance(self, request):
        """
        Retourne les performances par tranche de 30 minutes de la journée.
        """
        trades = self.get_queryset()
        
        if not trades.exists():
            return Response({
                'hourly_data': [{'hour': i/2, 'pnl': 0.0, 'trade_count': 0} for i in range(48)]
            })

        # Agréger par tranche de 30 minutes
        hourly_data = defaultdict(lambda: {'pnl': 0.0, 'trade_count': 0})
        
        for trade in trades:
            # Calculer la tranche de 30 minutes en heure locale
            local_time = trade.entered_at.astimezone()
            hour = local_time.hour
            minute = local_time.minute
            time_slot = hour + (0.5 if minute >= 30 else 0.0)
            
            hourly_data[time_slot]['pnl'] += float(trade.net_pnl)
            hourly_data[time_slot]['trade_count'] += 1

        # Créer le résultat pour toutes les tranches de 30 minutes (0-23.5)
        result = []
        for i in range(48):  # 24 heures × 2 = 48 tranches de 30 minutes
            time_slot = i / 2.0
            result.append({
                'hour': time_slot,
                'pnl': hourly_data[time_slot]['pnl'],
                'trade_count': hourly_data[time_slot]['trade_count']
            })

        return Response({
            'hourly_data': result
        })

    @action(detail=False, methods=['get'])
    def pnl_trades_correlation(self, request):
        """
        Retourne les données de corrélation entre P/L et nombre de trades par jour.
        """
        trades = self.get_queryset()
        
        if not trades.exists():
            return Response({
                'correlation_data': []
            })

        # Agréger par jour
        daily_data = defaultdict(lambda: {'pnl': 0.0, 'trade_count': 0})
        
        for trade in trades:
            date = trade.entered_at.date()
            daily_data[date]['pnl'] += float(trade.net_pnl)
            daily_data[date]['trade_count'] += 1

        # Créer le résultat
        result = []
        for date, data in daily_data.items():
            if data['trade_count'] > 0:  # Seulement les jours avec des trades
                result.append({
                    'date': date.isoformat(),
                    'pnl': data['pnl'],
                    'trade_count': data['trade_count'],
                    'avg_pnl_per_trade': data['pnl'] / data['trade_count']
                })

        # Trier par date
        result.sort(key=lambda x: x['date'])

        return Response({
            'correlation_data': result
        })

    @action(detail=False, methods=['get'])
    def drawdown_data(self, request):
        """Retourne les données de drawdown pour le graphique"""
        if not request.user.is_authenticated:
            return Response({'drawdown_data': []})
        
        # Filtrer par trading_account si spécifié
        trading_account_id = request.query_params.get('trading_account')
        trades = TopStepTrade.objects.filter(user=request.user)  # type: ignore
        if trading_account_id:
            try:
                trades = trades.filter(trading_account_id=int(trading_account_id))
            except (ValueError, TypeError):
                # Si trading_account_id n'est pas un entier valide, ignorer le filtre
                pass
        trades = trades.order_by('entered_at')  # type: ignore
        
        if not trades.exists():
            return Response({
                'drawdown_data': []
            })
        
        # Calculer le P/L cumulé et le drawdown
        cumulative_pnl = 0
        peak_pnl = 0
        drawdown_data = []
        
        # Grouper par date
        daily_data = {}
        for trade in trades:
            date_str = trade.entered_at.date().isoformat()
            if date_str not in daily_data:
                daily_data[date_str] = {'pnl': 0, 'trades': 0}
            daily_data[date_str]['pnl'] += trade.net_pnl
            daily_data[date_str]['trades'] += 1
        
        # Calculer le drawdown jour par jour
        for date_str in sorted(daily_data.keys()):
            daily_pnl = daily_data[date_str]['pnl']
            cumulative_pnl += daily_pnl
            
            # Mettre à jour le pic si nécessaire
            if cumulative_pnl > peak_pnl:
                peak_pnl = cumulative_pnl
            
            # Calculer le drawdown (différence entre le pic et la valeur actuelle)
            drawdown = peak_pnl - cumulative_pnl
            
            drawdown_data.append({
                'date': date_str,
                'pnl': daily_pnl,
                'cumulative_pnl': cumulative_pnl,
                'drawdown': drawdown
            })
        
        return Response({
            'drawdown_data': drawdown_data
        })

    def destroy(self, request, *args, **kwargs):
        """
        Supprime un trade et toutes ses stratégies associées.
        """
        try:
            instance = self.get_object()
        except Exception as e:
            # Django REST Framework lève Http404, mais on peut aussi avoir d'autres exceptions
            return Response({
                'error': 'Trade non trouvé',
                'message': f'Aucun trade trouvé avec l\'ID {kwargs.get("pk", "inconnu")}'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Compter les stratégies associées avant suppression
        strategy_count = instance.strategy_data.count()
        topstep_id = instance.topstep_id
        
        # La suppression du trade supprimera automatiquement les stratégies
        # grâce à on_delete=models.CASCADE
        self.perform_destroy(instance)
        
        return Response({
            'message': f'Trade {topstep_id} supprimé avec succès',
            'deleted_strategies_count': strategy_count
        }, status=status.HTTP_200_OK)


class TopStepImportLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet pour consulter les logs d'import (lecture seule).
    """
    serializer_class = TopStepImportLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Retourne uniquement les logs de l'utilisateur connecté."""
        if not self.request.user.is_authenticated:
            return TopStepImportLog.objects.none()  # type: ignore
        return TopStepImportLog.objects.filter(user=self.request.user).order_by('-imported_at')  # type: ignore


class TradeStrategyViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour gérer les données de stratégie liées aux trades.
    """
    serializer_class = TradeStrategySerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Retourne uniquement les stratégies de l'utilisateur connecté."""
        if not self.request.user.is_authenticated:
            return TradeStrategy.objects.none()  # type: ignore
        queryset = TradeStrategy.objects.filter(user=self.request.user).select_related('trade')  # type: ignore
        
        # Filtres optionnels
        trade_id = self.request.query_params.get('trade_id', None)
        strategy_respected = self.request.query_params.get('strategy_respected', None)
        contract_name = self.request.query_params.get('contract_name', None)
        
        if trade_id:
            queryset = queryset.filter(trade__topstep_id=trade_id)
        if strategy_respected is not None:
            queryset = queryset.filter(strategy_respected=strategy_respected.lower() == 'true')  # type: ignore
        if contract_name:
            queryset = queryset.filter(trade__contract_name__icontains=contract_name)
        
        return queryset.order_by('-created_at')
    
    def perform_create(self, serializer):
        """Associe automatiquement l'utilisateur connecté à la stratégie."""
        serializer.save(user=self.request.user)
    
    @action(detail=False, methods=['get'])
    def by_trade(self, request):
        """Récupère la stratégie pour un trade spécifique."""
        trade_id = request.query_params.get('trade_id')
        if not trade_id:
            return Response({'error': 'Paramètre trade_id requis'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # 🔒 SÉCURITÉ : Filtrer par utilisateur connecté
            strategy = TradeStrategy.objects.filter(  # type: ignore
                user=self.request.user,  # ✅ Filtre par utilisateur
                trade__topstep_id=trade_id
            ).first()
            if strategy:
                serializer = self.get_serializer(strategy)
                return Response(serializer.data)
            else:
                return Response({'error': 'Aucune stratégie trouvée pour ce trade'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'])
    def by_date(self, request):
        """Récupère les stratégies pour les trades d'une date spécifique."""
        date = request.query_params.get('date')
        if not date:
            return Response({'error': 'Paramètre date requis'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # 🔒 SÉCURITÉ : Filtrer par utilisateur connecté
            strategies = TradeStrategy.objects.filter(  # type: ignore
                user=self.request.user,  # ✅ Filtre par utilisateur
                trade__trade_day=date
            ).select_related('trade')
            
            # Filtrer par compte de trading si spécifié
            trading_account_id = request.query_params.get('trading_account')
            if trading_account_id:
                strategies = strategies.filter(trade__trading_account_id=trading_account_id)
            
            serializer = self.get_serializer(strategies, many=True)
            return Response(serializer.data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'])
    def strategy_data(self, request):
        """Récupère les données de stratégie agrégées par date pour un mois donné."""
        year = request.query_params.get('year')
        month = request.query_params.get('month')
        
        if not year or not month:
            return Response({'error': 'Paramètres year et month requis'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            year = int(year)
            month = int(month)
            
            # Créer les dates de début et fin du mois
            start_date = timezone.datetime(year, month, 1)
            if month == 12:
                end_date = timezone.datetime(year + 1, 1, 1)
            else:
                end_date = timezone.datetime(year, month + 1, 1)
            
            # Récupérer les stratégies du mois
            strategies = TradeStrategy.objects.filter(  # type: ignore
                user=self.request.user,
                trade__trade_day__gte=start_date.strftime('%Y-%m-%d'),
                trade__trade_day__lt=end_date.strftime('%Y-%m-%d')
            ).select_related('trade')
            
            # Agréger par date
            data_by_date = {}
            
            for strategy in strategies:
                trade_day = strategy.trade.trade_day
                
                # Initialiser la date si elle n'existe pas
                if trade_day not in data_by_date:
                    data_by_date[trade_day] = {'strategies': [], 'total': 0, 'respected': 0}
                
                data_by_date[trade_day]['strategies'].append({
                    'id': strategy.id,
                    'strategy_respected': strategy.strategy_respected,
                    'dominant_emotions': strategy.dominant_emotions,
                    'tp1_reached': strategy.tp1_reached,
                    'tp2_plus_reached': strategy.tp2_plus_reached,
                    'trade_info': {
                        'net_pnl': str(strategy.trade.net_pnl) if strategy.trade.net_pnl else '0'
                    }
                })
                data_by_date[trade_day]['total'] += 1
                if strategy.strategy_respected:
                    data_by_date[trade_day]['respected'] += 1
            
            # Convertir en format attendu par le frontend
            result = []
            for date, data in data_by_date.items():
                result.append({
                    'date': date,
                    'strategies': data['strategies']
                })
            
            return Response(result)
            
        except ValueError:
            return Response({'error': 'Format de date invalide'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Retourne les statistiques de stratégies pour une période donnée."""
        now = timezone.now()
        
        # Paramètres de filtrage
        start_date_param = request.query_params.get('start_date')
        end_date_param = request.query_params.get('end_date')
        year = request.query_params.get('year')
        month = request.query_params.get('month')
        trading_account_id = request.query_params.get('trading_account')
        # Convertir en int si fourni
        if trading_account_id:
            try:
                trading_account_id = int(trading_account_id)
            except (ValueError, TypeError):
                trading_account_id = None
        
        # Déterminer la période (priorité à start_date/end_date)
        if start_date_param and end_date_param:
            # Utiliser les dates fournies directement
            try:
                start_date = timezone.datetime.strptime(start_date_param, '%Y-%m-%d')
                end_date = timezone.datetime.strptime(end_date_param, '%Y-%m-%d')
                # Ajouter un jour à end_date pour inclure toute la journée
                end_date = end_date + timezone.timedelta(days=1)
            except ValueError:
                return Response({'error': 'Format de date invalide. Utilisez YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)
        elif year:
            year = int(year)
            if month:
                # Filtrer par mois spécifique
                month = int(month)
                start_date = timezone.datetime(year, month, 1)
                if month == 12:
                    end_date = timezone.datetime(year + 1, 1, 1)
                else:
                    end_date = timezone.datetime(year, month + 1, 1)
            else:
                # Filtrer par année complète
                start_date = timezone.datetime(year, 1, 1)
                end_date = timezone.datetime(year + 1, 1, 1)
        else:
            # Par défaut: année en cours
            current_year = now.year
            start_date = timezone.datetime(current_year, 1, 1)
            end_date = timezone.datetime(current_year + 1, 1, 1)
        
        # Base queryset : stratégies de l'utilisateur dans la période
        queryset = TradeStrategy.objects.filter(  # type: ignore
            user=self.request.user,
            trade__trade_day__gte=start_date.strftime('%Y-%m-%d'),
            trade__trade_day__lt=end_date.strftime('%Y-%m-%d')
        ).select_related('trade')
        
        # Filtrer par compte si spécifié
        if trading_account_id:
            queryset = queryset.filter(trade__trading_account_id=trading_account_id)
        
        # Statistiques globales (toutes périodes et tous comptes)
        # Pour all_time : compter TOUS les trades de l'utilisateur (pas seulement ceux avec stratégie)
        all_time_trades_queryset = TopStepTrade.objects.filter(user=self.request.user)  # type: ignore
        all_time_strategies_queryset = TradeStrategy.objects.filter(user=self.request.user)  # type: ignore
        
        # Pour la période sélectionnée (tous comptes) : compter TOUS les trades de l'utilisateur pour la période
        period_trades_queryset = TopStepTrade.objects.filter(  # type: ignore
            user=self.request.user,
            trade_day__gte=start_date.strftime('%Y-%m-%d'),
            trade_day__lt=end_date.strftime('%Y-%m-%d')
        )
        period_strategies_queryset = TradeStrategy.objects.filter(  # type: ignore
            user=self.request.user,
            trade__trade_day__gte=start_date.strftime('%Y-%m-%d'),
            trade__trade_day__lt=end_date.strftime('%Y-%m-%d')
        )
        
        # Pour le compte : compter TOUS les trades du compte (toutes périodes, pas seulement la période sélectionnée)
        account_trades_queryset = TopStepTrade.objects.filter(user=self.request.user)  # type: ignore
        account_strategies_queryset = TradeStrategy.objects.filter(user=self.request.user)  # type: ignore
        if trading_account_id:
            account_trades_queryset = account_trades_queryset.filter(trading_account_id=trading_account_id)
            account_strategies_queryset = account_strategies_queryset.filter(trade__trading_account_id=trading_account_id)
        
        # Pour le compte et la période sélectionnée : compter TOUS les trades du compte pour la période
        account_period_trades_queryset = TopStepTrade.objects.filter(  # type: ignore
            user=self.request.user,
            trade_day__gte=start_date.strftime('%Y-%m-%d'),
            trade_day__lt=end_date.strftime('%Y-%m-%d')
        )
        account_period_strategies_queryset = TradeStrategy.objects.filter(  # type: ignore
            user=self.request.user,
            trade__trade_day__gte=start_date.strftime('%Y-%m-%d'),
            trade__trade_day__lt=end_date.strftime('%Y-%m-%d')
        )
        if trading_account_id:
            account_period_trades_queryset = account_period_trades_queryset.filter(trading_account_id=trading_account_id)
            account_period_strategies_queryset = account_period_strategies_queryset.filter(trade__trading_account_id=trading_account_id)
        
        # Récupérer les compliances pour les jours sans trades
        # IMPORTANT: Exclure les compliances pour les jours qui ont des trades (pour éviter le double comptage)
        # Pour toutes périodes
        all_time_day_compliances_queryset = DayStrategyCompliance.objects.filter(  # type: ignore
            user=self.request.user
        ).exclude(strategy_respected__isnull=True)
        if trading_account_id:
            all_time_day_compliances_queryset = all_time_day_compliances_queryset.filter(trading_account_id=trading_account_id)
        
        # Exclure les compliances pour les jours qui ont des trades
        # Récupérer toutes les dates avec des trades pour cet utilisateur/compte
        trades_dates = set(account_trades_queryset.values_list('trade_day', flat=True))
        trades_dates = {d for d in trades_dates if d is not None}  # Filtrer les None
        if trades_dates:
            # trade_day est déjà un objet date, pas besoin de conversion
            # Construire le Q object directement avec toutes les dates
            date_filters = Q(date__in=list(trades_dates))
            all_time_day_compliances_queryset = all_time_day_compliances_queryset.exclude(date_filters)
        
        # Pour la période sélectionnée
        period_day_compliances_queryset = DayStrategyCompliance.objects.filter(  # type: ignore
            user=self.request.user,
            date__gte=start_date.date(),
            date__lt=end_date.date()
        ).exclude(strategy_respected__isnull=True)
        if trading_account_id:
            period_day_compliances_queryset = period_day_compliances_queryset.filter(trading_account_id=trading_account_id)
        
        # Exclure les compliances pour les jours qui ont des trades dans la période
        period_trades_dates = set(account_period_trades_queryset.values_list('trade_day', flat=True))
        period_trades_dates = {d for d in period_trades_dates if d is not None}  # Filtrer les None
        if period_trades_dates:
            # trade_day est déjà un objet date, pas besoin de conversion
            # Construire le Q object directement avec toutes les dates
            period_date_filters = Q(date__in=list(period_trades_dates))
            period_day_compliances_queryset = period_day_compliances_queryset.exclude(period_date_filters)
        
        # Calculs
        total_strategies = queryset.count()  # Trades avec stratégie pour la période (pour les graphiques)
        total_period_trades = period_trades_queryset.count()  # Tous les trades pour la période (tous comptes)
        total_account_trades = account_trades_queryset.count()  # Tous les trades du compte (toutes périodes)
        total_account_period_trades = account_period_trades_queryset.count()  # Tous les trades du compte pour la période
        total_all_time_trades = all_time_trades_queryset.count()  # Tous les trades
        total_all_time_strategies = all_time_strategies_queryset.count()  # Trades avec stratégie
        
        # Ajouter les compliances pour all_time (toutes périodes, tous comptes)
        # IMPORTANT: Exclure les compliances pour les jours qui ont des trades
        all_time_all_day_compliances_queryset = DayStrategyCompliance.objects.filter(  # type: ignore
            user=self.request.user
        ).exclude(strategy_respected__isnull=True)
        
        # Exclure les compliances pour les jours qui ont des trades (tous comptes)
        all_time_trades_dates = set(all_time_trades_queryset.values_list('trade_day', flat=True))
        all_time_trades_dates = {d for d in all_time_trades_dates if d is not None}  # Filtrer les None
        if all_time_trades_dates:
            # trade_day est déjà un objet date, pas besoin de conversion
            # Construire le Q object directement avec toutes les dates
            all_time_date_filters = Q(date__in=list(all_time_trades_dates))
            all_time_all_day_compliances_queryset = all_time_all_day_compliances_queryset.exclude(all_time_date_filters)
        
        all_time_all_day_compliances_count = all_time_all_day_compliances_queryset.count()
        total_all_time_strategies += all_time_all_day_compliances_count  # Inclure les compliances dans le total
        
        # 1. Respect de la stratégie en % pour le compte (toutes périodes, pas seulement la période sélectionnée)
        # IMPORTANT: Compter les JOURS respectés, pas les trades/compliances respectés
        # Un jour est respecté si tous les trades du jour sont respectés (ou si la compliance indique respecté)
        account_strategies_with_respect = account_strategies_queryset.exclude(strategy_respected__isnull=True)
        total_account_strategies = account_strategies_with_respect.count()  # Trades avec stratégie (respectée ou non)
        
        # Calculer le nombre de jours uniques avec évaluation (trades avec stratégie OU compliances)
        # Jours avec trades ayant stratégie
        account_strategies_dates = set(account_strategies_with_respect.values_list('trade__trade_day', flat=True))
        account_strategies_dates = {d for d in account_strategies_dates if d is not None}
        # Jours avec compliances (sans trades)
        account_compliances_dates = set(all_time_day_compliances_queryset.values_list('date', flat=True))
        # Union des deux ensembles pour obtenir le total de jours uniques
        account_total_days = len(account_strategies_dates | account_compliances_dates)
        account_total_trades_in_days = total_account_strategies  # Nombre de trades avec stratégie
        
        # Compter les jours respectés (jours où TOUS les trades sont respectés)
        account_days_respected = 0
        account_days_not_respected = 0
        for trade_date in account_strategies_dates:
            # Récupérer tous les trades avec stratégie pour ce jour
            day_strategies = account_strategies_with_respect.filter(trade__trade_day=trade_date)
            # Récupérer tous les trades du jour (pour vérifier que tous ont une stratégie)
            day_all_trades = account_trades_queryset.filter(trade_day=trade_date)
            # Un jour est respecté si tous les trades du jour ont une stratégie ET tous sont respectés
            if day_all_trades.count() == day_strategies.count():  # Tous les trades ont une stratégie
                if day_strategies.filter(strategy_respected=False).count() == 0:  # Aucun non respecté
                    account_days_respected += 1
                else:
                    account_days_not_respected += 1
            # Si certains trades n'ont pas de stratégie, on ne compte pas ce jour comme respecté ou non respecté
        
        # Ajouter les compliances pour les jours sans trades
        account_days_respected += all_time_day_compliances_queryset.filter(strategy_respected=True).count()
        account_days_not_respected += all_time_day_compliances_queryset.filter(strategy_respected=False).count()
        
        # Pourcentages par rapport au total de jours
        account_respect_percentage = (account_days_respected / account_total_days * 100) if account_total_days > 0 else 0
        account_not_respect_percentage = (account_days_not_respected / account_total_days * 100) if account_total_days > 0 else 0
        
        # Pour compatibilité avec l'ancien code, garder aussi le compte des trades/compliances respectés
        account_respected_count = account_strategies_with_respect.filter(strategy_respected=True).count()
        account_not_respected_count = account_strategies_with_respect.filter(strategy_respected=False).count()
        all_time_day_respected = all_time_day_compliances_queryset.filter(strategy_respected=True).count()
        all_time_day_not_respected = all_time_day_compliances_queryset.filter(strategy_respected=False).count()
        account_respected_count += all_time_day_respected
        account_not_respected_count += all_time_day_not_respected
        total_account_with_strategy = total_account_strategies + all_time_day_compliances_queryset.count()
        
        # Respect du compte pour la période sélectionnée - compter les JOURS respectés
        account_period_with_respect = account_period_strategies_queryset.exclude(strategy_respected__isnull=True)
        total_account_period_strategies = account_period_with_respect.count()  # Trades avec stratégie pour la période
        
        # Calculer le nombre de jours uniques avec évaluation pour la période du compte
        account_period_strategies_dates = set(account_period_with_respect.values_list('trade__trade_day', flat=True))
        account_period_strategies_dates = {d for d in account_period_strategies_dates if d is not None}
        account_period_compliances_dates = set(period_day_compliances_queryset.values_list('date', flat=True))
        account_period_total_days = len(account_period_strategies_dates | account_period_compliances_dates)
        account_period_total_trades_in_days = total_account_period_strategies
        
        # Compter les jours respectés pour la période du compte
        account_period_days_respected = 0
        account_period_days_not_respected = 0
        for trade_date in account_period_strategies_dates:
            day_strategies = account_period_with_respect.filter(trade__trade_day=trade_date)
            day_all_trades = account_period_trades_queryset.filter(trade_day=trade_date)
            if day_all_trades.count() == day_strategies.count():  # Tous les trades ont une stratégie
                if day_strategies.filter(strategy_respected=False).count() == 0:  # Aucun non respecté
                    account_period_days_respected += 1
                else:
                    account_period_days_not_respected += 1
        
        # Ajouter les compliances pour les jours sans trades
        account_period_days_respected += period_day_compliances_queryset.filter(strategy_respected=True).count()
        account_period_days_not_respected += period_day_compliances_queryset.filter(strategy_respected=False).count()
        
        # Pourcentages par rapport au total de jours
        account_period_respect_percentage = (account_period_days_respected / account_period_total_days * 100) if account_period_total_days > 0 else 0
        account_period_not_respect_percentage = (account_period_days_not_respected / account_period_total_days * 100) if account_period_total_days > 0 else 0
        
        # Pour compatibilité
        account_period_respected = account_period_with_respect.filter(strategy_respected=True).count()
        account_period_not_respected = account_period_with_respect.filter(strategy_respected=False).count()
        period_day_respected = period_day_compliances_queryset.filter(strategy_respected=True).count()
        period_day_not_respected = period_day_compliances_queryset.filter(strategy_respected=False).count()
        account_period_respected += period_day_respected
        account_period_not_respected += period_day_not_respected
        total_account_period_with_strategy = total_account_period_strategies + period_day_compliances_queryset.count()
        
        # Pour la période (utilisé pour les graphiques uniquement)
        strategies_with_respect = queryset.exclude(strategy_respected__isnull=True)
        respected_count = strategies_with_respect.filter(strategy_respected=True).count()
        not_respected_count = strategies_with_respect.filter(strategy_respected=False).count()
        
        # Ajouter les compliances pour les jours sans trades (période sélectionnée, tous comptes)
        # IMPORTANT: Exclure les compliances pour les jours qui ont des trades
        all_period_day_compliances_queryset = DayStrategyCompliance.objects.filter(  # type: ignore
            user=self.request.user,
            date__gte=start_date.date(),
            date__lt=end_date.date()
        ).exclude(strategy_respected__isnull=True)
        
        # Exclure les compliances pour les jours qui ont des trades dans la période (tous comptes)
        period_all_trades_dates = set(period_trades_queryset.values_list('trade_day', flat=True))
        period_all_trades_dates = {d for d in period_all_trades_dates if d is not None}  # Filtrer les None
        if period_all_trades_dates:
            # trade_day est déjà un objet date, pas besoin de conversion
            # Construire le Q object directement avec toutes les dates
            period_all_date_filters = Q(date__in=list(period_all_trades_dates))
            all_period_day_compliances_queryset = all_period_day_compliances_queryset.exclude(period_all_date_filters)
        
        all_period_day_respected = all_period_day_compliances_queryset.filter(strategy_respected=True).count()
        all_period_day_not_respected = all_period_day_compliances_queryset.filter(strategy_respected=False).count()
        respected_count += all_period_day_respected
        not_respected_count += all_period_day_not_respected
        
        # Respect total toutes périodes - compter les JOURS respectés
        all_time_with_respect = all_time_strategies_queryset.exclude(strategy_respected__isnull=True)
        total_all_time_strategies_count = all_time_with_respect.count()  # Trades avec stratégie (toutes périodes, tous comptes)
        
        # Calculer le nombre de jours uniques avec évaluation (toutes périodes, tous comptes)
        all_time_strategies_dates = set(all_time_with_respect.values_list('trade__trade_day', flat=True))
        all_time_strategies_dates = {d for d in all_time_strategies_dates if d is not None}
        all_time_compliances_dates = set(all_time_all_day_compliances_queryset.values_list('date', flat=True))
        all_time_total_days = len(all_time_strategies_dates | all_time_compliances_dates)
        all_time_total_trades_in_days = total_all_time_strategies_count
        
        # Compter les jours respectés (toutes périodes, tous comptes)
        all_time_days_respected = 0
        all_time_days_not_respected = 0
        for trade_date in all_time_strategies_dates:
            day_strategies = all_time_with_respect.filter(trade__trade_day=trade_date)
            day_all_trades = all_time_trades_queryset.filter(trade_day=trade_date)
            if day_all_trades.count() == day_strategies.count():  # Tous les trades ont une stratégie
                if day_strategies.filter(strategy_respected=False).count() == 0:  # Aucun non respecté
                    all_time_days_respected += 1
                else:
                    all_time_days_not_respected += 1
        
        # Ajouter les compliances pour les jours sans trades
        all_time_days_respected += all_time_all_day_compliances_queryset.filter(strategy_respected=True).count()
        all_time_days_not_respected += all_time_all_day_compliances_queryset.filter(strategy_respected=False).count()
        
        # Pourcentages par rapport au total de jours
        all_time_respect_percentage = (all_time_days_respected / all_time_total_days * 100) if all_time_total_days > 0 else 0
        all_time_not_respect_percentage = (all_time_days_not_respected / all_time_total_days * 100) if all_time_total_days > 0 else 0
        
        # Pour compatibilité
        all_time_respected = all_time_with_respect.filter(strategy_respected=True).count()
        all_time_not_respected = all_time_with_respect.filter(strategy_respected=False).count()
        all_time_all_day_respected = all_time_all_day_compliances_queryset.filter(strategy_respected=True).count()
        all_time_all_day_not_respected = all_time_all_day_compliances_queryset.filter(strategy_respected=False).count()
        all_time_respected += all_time_all_day_respected
        all_time_not_respected += all_time_all_day_not_respected
        total_all_time_with_strategy = total_all_time_strategies_count + all_time_all_day_compliances_queryset.count()
        
        # Respect total pour la période sélectionnée (tous comptes) - compter les JOURS respectés
        period_with_respect = period_strategies_queryset.exclude(strategy_respected__isnull=True)
        total_period_strategies_count = period_with_respect.count()  # Trades avec stratégie pour la période (tous comptes)
        
        # Calculer le nombre de jours uniques avec évaluation pour la période (tous comptes)
        period_strategies_dates = set(period_with_respect.values_list('trade__trade_day', flat=True))
        period_strategies_dates = {d for d in period_strategies_dates if d is not None}
        period_compliances_dates = set(all_period_day_compliances_queryset.values_list('date', flat=True))
        period_total_days = len(period_strategies_dates | period_compliances_dates)
        period_total_trades_in_days = total_period_strategies_count
        
        # Compter les jours respectés pour la période (tous comptes)
        period_days_respected = 0
        period_days_not_respected = 0
        for trade_date in period_strategies_dates:
            day_strategies = period_with_respect.filter(trade__trade_day=trade_date)
            day_all_trades = period_trades_queryset.filter(trade_day=trade_date)
            if day_all_trades.count() == day_strategies.count():  # Tous les trades ont une stratégie
                if day_strategies.filter(strategy_respected=False).count() == 0:  # Aucun non respecté
                    period_days_respected += 1
                else:
                    period_days_not_respected += 1
        
        # Ajouter les compliances pour les jours sans trades
        period_days_respected += all_period_day_compliances_queryset.filter(strategy_respected=True).count()
        period_days_not_respected += all_period_day_compliances_queryset.filter(strategy_respected=False).count()
        
        # Pourcentages par rapport au total de jours
        period_respect_percentage = (period_days_respected / period_total_days * 100) if period_total_days > 0 else 0
        period_not_respect_percentage = (period_days_not_respected / period_total_days * 100) if period_total_days > 0 else 0
        
        # Pour compatibilité
        period_respected = period_with_respect.filter(strategy_respected=True).count()
        period_not_respected = period_with_respect.filter(strategy_respected=False).count()
        period_respected += all_period_day_respected
        period_not_respected += all_period_day_not_respected
        total_period_with_strategy = total_period_strategies_count + all_period_day_compliances_queryset.count()
        
        # 2. Taux de réussite selon respect de la stratégie
        # Taux de réussite si stratégie respectée (trades gagnants quand strategy_respected = True)
        respected_strategies = queryset.filter(strategy_respected=True)
        winning_when_respected = respected_strategies.filter(trade__net_pnl__gt=0).count()
        success_rate_if_respected = (winning_when_respected / respected_strategies.count() * 100) if respected_strategies.count() > 0 else 0
        
        # Taux de réussite si stratégie non respectée (trades gagnants quand strategy_respected = False)
        not_respected_strategies = queryset.filter(strategy_respected=False)
        winning_when_not_respected = not_respected_strategies.filter(trade__net_pnl__gt=0).count()
        success_rate_if_not_respected = (winning_when_not_respected / not_respected_strategies.count() * 100) if not_respected_strategies.count() > 0 else 0
        
        # 3. Répartition des sessions gagnantes selon TP1 et TP2+
        # Les sessions gagnantes sont celles où le trade est gagnant (net_pnl > 0)
        winning_sessions = queryset.filter(trade__net_pnl__gt=0)
        winning_count = winning_sessions.count()
        # TP1 : toutes les sessions où TP1 est atteint (même si TP2+ est aussi atteint)
        tp1_only = winning_sessions.filter(tp1_reached=True).count()
        # TP2+ : toutes les sessions où TP2+ est atteint
        tp2_plus = winning_sessions.filter(tp2_plus_reached=True).count()
        # No TP : sessions gagnantes sans TP1 ni TP2+ atteint
        no_tp = winning_sessions.filter(tp1_reached=False, tp2_plus_reached=False).count()
        
        # 4. Répartition des émotions dominantes
        emotion_counts = defaultdict(int)
        for strategy in queryset:
            if strategy.dominant_emotions:
                for emotion in strategy.dominant_emotions:
                    emotion_counts[emotion] += 1
        
        # Trier par fréquence décroissante
        emotions_data = [
            {'emotion': emotion, 'count': count}
            for emotion, count in sorted(emotion_counts.items(), key=lambda x: x[1], reverse=True)
        ]
        
        # 5. Respect par période (pour graphique temporel)
        # Utiliser tous les trades (pas seulement ceux avec stratégie) pour être cohérent avec les taux de respect
        period_data = []
        if month:
            # Par jour du mois
            current_date = start_date
            while current_date < end_date:
                day_str = current_date.strftime('%Y-%m-%d')
                # Compter tous les trades du jour (pas seulement ceux avec stratégie)
                day_trades_queryset = period_trades_queryset.filter(trade_day=day_str)
                if trading_account_id:
                    day_trades_queryset = day_trades_queryset.filter(trading_account_id=trading_account_id)
                day_total_trades = day_trades_queryset.count()  # Tous les trades
                
                # Compter les trades respectés (ceux avec stratégie respectée)
                day_strategies = queryset.filter(trade__trade_day=day_str)
                day_with_respect = day_strategies.exclude(strategy_respected__isnull=True)
                day_respected = day_with_respect.filter(strategy_respected=True).count()
                day_not_respected = day_with_respect.filter(strategy_respected=False).count()
                
                # Ajouter les compliances pour les jours sans trades (seulement si pas de trades ce jour)
                day_date_obj = timezone.datetime.strptime(day_str, '%Y-%m-%d').date()
                day_compliance = None
                if day_total_trades == 0:  # Seulement si pas de trades ce jour
                    day_compliance_query = period_day_compliances_queryset.filter(date=day_date_obj)
                    if trading_account_id:
                        day_compliance_query = day_compliance_query.filter(trading_account_id=trading_account_id)
                    day_compliance = day_compliance_query.first()
                    if day_compliance and day_compliance.strategy_respected is not None:
                        if day_compliance.strategy_respected:
                            day_respected += 1
                        else:
                            day_not_respected += 1
                
                # Pourcentages par rapport au total (trades + compliances, mais seulement si pas de conflit)
                day_total_with_strategy = day_total_trades + (1 if day_total_trades == 0 and day_compliance and day_compliance.strategy_respected is not None else 0)
                day_respect_percentage = (day_respected / day_total_with_strategy * 100) if day_total_with_strategy > 0 else 0
                day_not_respect_percentage = (day_not_respected / day_total_with_strategy * 100) if day_total_with_strategy > 0 else 0
                period_data.append({
                    'period': current_date.strftime('%d/%m'),
                    'date': day_str,
                    'respect_percentage': round(day_respect_percentage, 2),
                    'not_respect_percentage': round(day_not_respect_percentage, 2),
                    'total': day_total_trades,  # Tous les trades (pour compatibilité)
                    'total_with_strategy': day_total_with_strategy,  # Trades + compliances (pour calculs corrects)
                    'respected_count': day_respected,
                    'not_respected_count': day_not_respected
                })
                current_date += timedelta(days=1)
        else:
            # Par mois de l'année - itérer sur les mois de la période sélectionnée
            current_month_start = timezone.datetime(start_date.year, start_date.month, 1)
            
            while current_month_start < end_date:
                # Calculer la fin du mois
                if current_month_start.month == 12:
                    month_end = timezone.datetime(current_month_start.year + 1, 1, 1)
                else:
                    month_end = timezone.datetime(current_month_start.year, current_month_start.month + 1, 1)
                
                month_start = current_month_start
                
                # S'assurer que month_end ne dépasse pas end_date
                if month_end > end_date:
                    month_end = end_date
                
                # Compter tous les trades du mois (pas seulement ceux avec stratégie)
                month_trades_queryset = period_trades_queryset.filter(
                    trade_day__gte=month_start.strftime('%Y-%m-%d'),
                    trade_day__lt=month_end.strftime('%Y-%m-%d')
                )
                if trading_account_id:
                    month_trades_queryset = month_trades_queryset.filter(trading_account_id=trading_account_id)
                month_total_trades = month_trades_queryset.count()  # Tous les trades
                
                # Compter les trades respectés (ceux avec stratégie respectée)
                month_strategies = queryset.filter(
                    trade__trade_day__gte=month_start.strftime('%Y-%m-%d'),
                    trade__trade_day__lt=month_end.strftime('%Y-%m-%d')
                )
                month_with_respect = month_strategies.exclude(strategy_respected__isnull=True)
                month_respected = month_with_respect.filter(strategy_respected=True).count()
                month_not_respected = month_with_respect.filter(strategy_respected=False).count()
                
                # Ajouter les compliances pour les jours sans trades du mois (exclure les jours avec trades)
                month_day_compliances = period_day_compliances_queryset.filter(
                    date__gte=month_start.date(),
                    date__lt=month_end.date()
                )
                if trading_account_id:
                    month_day_compliances = month_day_compliances.filter(trading_account_id=trading_account_id)
                
                # Exclure les compliances pour les jours qui ont des trades dans ce mois
                month_trades_dates = set(month_trades_queryset.values_list('trade_day', flat=True))
                month_trades_dates = {d for d in month_trades_dates if d is not None}  # Filtrer les None
                if month_trades_dates:
                    # trade_day est déjà un objet date, pas besoin de conversion
                    # Construire le Q object directement avec toutes les dates
                    month_date_filters = Q(date__in=list(month_trades_dates))
                    month_day_compliances = month_day_compliances.exclude(month_date_filters)
                
                month_day_respected = month_day_compliances.filter(strategy_respected=True).count()
                month_day_not_respected = month_day_compliances.filter(strategy_respected=False).count()
                month_respected += month_day_respected
                month_not_respected += month_day_not_respected
                
                # Pourcentages par rapport au total (trades + compliances, sans double comptage)
                month_total_with_strategy = month_total_trades + month_day_compliances.count()
                month_respect_percentage = (month_respected / month_total_with_strategy * 100) if month_total_with_strategy > 0 else 0
                month_not_respect_percentage = (month_not_respected / month_total_with_strategy * 100) if month_total_with_strategy > 0 else 0
                # N'ajouter que les mois avec des données
                if month_total_with_strategy > 0:
                    # Envoyer la date au format ISO pour que le frontend puisse la formater selon la langue
                    period_data.append({
                        'period': month_start.strftime('%Y-%m'),  # Format ISO pour le formatage côté frontend
                        'date': month_start.strftime('%Y-%m'),
                        'respect_percentage': round(month_respect_percentage, 2),
                        'not_respect_percentage': round(month_not_respect_percentage, 2),
                        'total': month_total_trades,  # Tous les trades (pour compatibilité)
                        'total_with_strategy': month_total_with_strategy,  # Trades + compliances (pour calculs corrects)
                        'respected_count': month_respected,
                        'not_respected_count': month_not_respected
                    })
                
                # Passer au mois suivant
                if current_month_start.month == 12:
                    current_month_start = timezone.datetime(current_month_start.year + 1, 1, 1)
                else:
                    current_month_start = timezone.datetime(current_month_start.year, current_month_start.month + 1, 1)
        
        return Response({
            'period': {
                'year': year if year else now.year,
                'month': month,
                'start_date': start_date.strftime('%Y-%m-%d'),
                'end_date': end_date.strftime('%Y-%m-%d'),
            },
            'statistics': {
                'total_trades': total_account_with_strategy,  # Tous les trades du compte + compliances (toutes périodes) - pour compatibilité
                'total_days': account_total_days,  # Nombre de jours uniques avec évaluation
                'total_trades_in_days': account_total_trades_in_days,  # Nombre de trades avec stratégie
                'total_strategies': total_strategies,  # Trades avec stratégie pour la période (pour compatibilité)
                'respect_percentage': round(account_respect_percentage, 2),  # Taux de respect du compte (toutes périodes) - basé sur les jours
                'not_respect_percentage': round(account_not_respect_percentage, 2),
                'respected_count': account_days_respected,  # Jours respectés (pas trades/compliances)
                'not_respected_count': account_days_not_respected,  # Jours non respectés
                # Statistiques pour la période sélectionnée du compte
                'period': {
                    'total_trades': total_account_period_with_strategy,  # Tous les trades du compte + compliances pour la période - pour compatibilité
                    'total_days': account_period_total_days,  # Nombre de jours uniques avec évaluation pour la période
                    'total_trades_in_days': account_period_total_trades_in_days,  # Nombre de trades avec stratégie pour la période
                    'respect_percentage': round(account_period_respect_percentage, 2),
                    'not_respect_percentage': round(account_period_not_respect_percentage, 2),
                    'respected_count': account_period_days_respected,  # Jours respectés pour la période
                    'not_respected_count': account_period_days_not_respected,  # Jours non respectés
                },
                'success_rate_if_respected': round(success_rate_if_respected, 2),
                'success_rate_if_not_respected': round(success_rate_if_not_respected, 2),
                'winning_sessions_distribution': {
                    'tp1_only': tp1_only,
                    'tp2_plus': tp2_plus,
                    'no_tp': no_tp,
                    'total_winning': winning_count
                },
                'emotions_distribution': emotions_data,
                'period_data': period_data,
            },
            'all_time': {
                'total_trades': total_all_time_with_strategy,  # Tous les trades + compliances (toutes périodes, tous comptes) - pour compatibilité
                'total_days': all_time_total_days,  # Nombre de jours uniques avec évaluation (toutes périodes, tous comptes)
                'total_trades_in_days': all_time_total_trades_in_days,  # Nombre de trades avec stratégie (toutes périodes, tous comptes)
                'total_strategies': total_all_time_strategies,  # Trades avec stratégie (pour compatibilité)
                'respect_percentage': round(all_time_respect_percentage, 2),
                'not_respect_percentage': round(all_time_not_respect_percentage, 2),
                'respected_count': all_time_days_respected,  # Jours respectés (toutes périodes, tous comptes)
                'not_respected_count': all_time_days_not_respected,  # Jours non respectés
            },
            'period': {
                'total_trades': total_period_with_strategy,  # Tous les trades + compliances pour la période (tous comptes) - pour compatibilité
                'total_days': period_total_days,  # Nombre de jours uniques avec évaluation pour la période (tous comptes)
                'total_trades_in_days': period_total_trades_in_days,  # Nombre de trades avec stratégie pour la période (tous comptes)
                'respect_percentage': round(period_respect_percentage, 2),
                'not_respect_percentage': round(period_not_respect_percentage, 2),
                'respected_count': period_days_respected,  # Jours respectés pour la période (tous comptes)
                'not_respected_count': period_days_not_respected,  # Jours non respectés
            }
        })
    
    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        """Crée ou met à jour plusieurs stratégies de trades en une fois."""
        strategies_data = request.data.get('strategies', [])
        if not strategies_data:
            return Response({'error': 'Aucune donnée de stratégie fournie'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            created_strategies = []
            for strategy_data in strategies_data:
                trade_id = strategy_data.get('trade_id')
                if not trade_id:
                    continue
                
                # Chercher le trade de l'utilisateur connecté uniquement
                try:
                    trade = TopStepTrade.objects.get(topstep_id=trade_id, user=self.request.user)  # type: ignore
                except TopStepTrade.DoesNotExist:  # type: ignore
                    continue
                
                # Créer ou mettre à jour la stratégie
                strategy, created = TradeStrategy.objects.update_or_create(  # type: ignore
                    user=self.request.user,
                    trade=trade,
                    defaults={
                        'strategy_respected': strategy_data.get('strategy_respected'),
                        'dominant_emotions': strategy_data.get('dominant_emotions', []),
                        'gain_if_strategy_respected': strategy_data.get('gain_if_strategy_respected'),
                        'tp1_reached': strategy_data.get('tp1_reached', False),
                        'tp2_plus_reached': strategy_data.get('tp2_plus_reached', False),
                        'session_rating': strategy_data.get('session_rating'),
                        'emotion_details': strategy_data.get('emotion_details', ''),
                        'possible_improvements': strategy_data.get('possible_improvements', ''),
                        'screenshot_url': strategy_data.get('screenshot_url', ''),
                        'video_url': strategy_data.get('video_url', ''),
                    }
                )
                created_strategies.append(strategy)
            
            serializer = self.get_serializer(created_strategies, many=True)
            return Response(serializer.data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser])
    def upload_screenshot(self, request):
        """
        Upload un screenshot pour un trade.
        Retourne les URLs de l'image originale et de la miniature.
        """
        from rest_framework.parsers import MultiPartParser
        from .serializers import ScreenshotUploadSerializer
        from .image_processor import image_processor
        import logging
        
        logger = logging.getLogger(__name__)
        
        # Valider le fichier
        serializer = ScreenshotUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            file = serializer.validated_data['file']
            user_id = request.user.id
            
            # Traiter l'image (compression + miniature)
            original_url, thumbnail_url = image_processor.process_screenshot(file, user_id)
            
            logger.info(
                f"Screenshot uploadé avec succès pour l'utilisateur {user_id}: "
                f"original={original_url}, thumbnail={thumbnail_url}"
            )
            
            return Response({
                'original_url': original_url,
                'thumbnail_url': thumbnail_url,
                'message': 'Screenshot uploadé avec succès'
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Erreur lors de l'upload du screenshot : {e}")
            return Response({
                'error': 'Erreur lors du traitement de l\'image',
                'detail': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'])
    def delete_screenshot(self, request):
        """
        Supprime un screenshot et sa miniature du serveur.
        Seul le propriétaire peut supprimer ses fichiers.
        """
        from .image_processor import image_processor
        import logging
        
        logger = logging.getLogger(__name__)
        
        screenshot_url = request.data.get('screenshot_url')
        if not screenshot_url:
            return Response({
                'error': 'URL du screenshot requise'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Vérifier que l'URL appartient bien à l'utilisateur
        # En vérifiant que le chemin contient l'ID de l'utilisateur
        user_id = request.user.id
        if f'/screenshots/{user_id}/' not in screenshot_url:
            logger.warning(
                f"Tentative de suppression d'un screenshot non autorisé par l'utilisateur {user_id}: {screenshot_url}"
            )
            return Response({
                'error': 'Vous n\'êtes pas autorisé à supprimer ce fichier'
            }, status=status.HTTP_403_FORBIDDEN)
        
        try:
            # Supprimer le fichier et sa miniature
            success = image_processor.delete_screenshot(screenshot_url)
            
            if success:
                logger.info(f"Screenshot supprimé avec succès par l'utilisateur {user_id}: {screenshot_url}")
                return Response({
                    'message': 'Screenshot supprimé avec succès'
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'error': 'Fichier non trouvé ou déjà supprimé'
                }, status=status.HTTP_404_NOT_FOUND)
                
        except Exception as e:
            logger.error(f"Erreur lors de la suppression du screenshot : {e}")
            return Response({
                'error': 'Erreur lors de la suppression du fichier',
                'detail': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['get'])
    def strategy_compliance_stats(self, request):
        """
        Retourne les statistiques de respect de stratégie avec streaks et badges.
        """
        from collections import defaultdict
        from datetime import timedelta
        
        trading_account_id = request.query_params.get('trading_account')
        # Convertir en int si fourni
        if trading_account_id:
            try:
                trading_account_id = int(trading_account_id)
            except (ValueError, TypeError):
                trading_account_id = None
        
        # Récupérer tous les trades du compte pour vérifier si tous ont une stratégie
        from .models import TopStepTrade
        trades_queryset = TopStepTrade.objects.filter(  # type: ignore
            trading_account__user=self.request.user
        )
        if trading_account_id:
            trades_queryset = trades_queryset.filter(trading_account_id=trading_account_id)
        
        # Récupérer toutes les stratégies de l'utilisateur avec leurs trades
        strategies_queryset = TradeStrategy.objects.filter(  # type: ignore
            user=self.request.user
        ).select_related('trade')
        
        if trading_account_id:
            strategies_queryset = strategies_queryset.filter(trade__trading_account_id=trading_account_id)
        
        # Récupérer toutes les compliances pour les jours sans trades
        day_compliances_queryset = DayStrategyCompliance.objects.filter(  # type: ignore
            user=self.request.user
        )
        
        if trading_account_id:
            day_compliances_queryset = day_compliances_queryset.filter(
                trading_account_id=trading_account_id
            )
        
        # Créer un dictionnaire pour accéder rapidement aux stratégies par trade_id
        strategies_dict = {strategy.trade_id: strategy for strategy in strategies_queryset}
        
        # Créer un dictionnaire pour accéder rapidement aux compliances par date
        day_compliances_dict = {}
        for compliance in day_compliances_queryset:
            date_str = compliance.date.isoformat()
            # Si plusieurs compliances pour la même date, prendre la plus récente
            if date_str not in day_compliances_dict:
                day_compliances_dict[date_str] = compliance
            elif compliance.created_at > day_compliances_dict[date_str].created_at:
                day_compliances_dict[date_str] = compliance
        
        # Agréger par jour de trading
        daily_compliance = defaultdict(lambda: {'total': 0, 'with_strategy': 0, 'respected': 0, 'not_respected': 0, 'has_day_compliance': False})
        all_dates = []
        
        # Traiter les trades
        for trade in trades_queryset:
            if trade.trade_day:
                date_str = trade.trade_day.isoformat()
                daily_compliance[date_str]['total'] += 1
                strategy = strategies_dict.get(trade.id)
                if strategy and strategy.strategy_respected is not None:
                    daily_compliance[date_str]['with_strategy'] += 1
                    if strategy.strategy_respected:
                        daily_compliance[date_str]['respected'] += 1
                    else:
                        daily_compliance[date_str]['not_respected'] += 1
                if date_str not in all_dates:
                    all_dates.append(date_str)
        
        # Traiter les jours sans trades mais avec compliance
        for date_str, compliance in day_compliances_dict.items():
            # Ne traiter que si la date n'a pas de trades (ou si elle en a, on ajoute quand même la compliance)
            if compliance.strategy_respected is not None:
                # Si la date n'existe pas encore, l'ajouter
                if date_str not in all_dates:
                    all_dates.append(date_str)
                
                # Marquer qu'il y a une compliance pour ce jour
                daily_compliance[date_str]['has_day_compliance'] = True
                
                # Si c'est un jour sans trades, compter la compliance comme une stratégie
                if daily_compliance[date_str]['total'] == 0:
                    daily_compliance[date_str]['with_strategy'] += 1
                    if compliance.strategy_respected:
                        daily_compliance[date_str]['respected'] += 1
                    else:
                        daily_compliance[date_str]['not_respected'] += 1
                # Si c'est un jour avec trades, on ne compte pas la compliance séparément
                # car elle est déjà prise en compte via les trades
        
        # Trier les dates (jours avec trades ET jours sans trades mais avec compliance)
        # La consécutivité est basée sur les jours calendaires avec activité (trades ou compliance)
        all_dates.sort()
        
        # Calculer le streak actuel et le meilleur streak
        current_streak = 0
        best_streak = 0
        temp_streak = 0
        streak_start_date = None
        current_streak_start = None
        
        # Calculer le meilleur streak de tous les temps en parcourant toutes les dates dans l'ordre chronologique
        # On compte les jours avec trades ET les jours sans trades mais avec compliance
        # IMPORTANT: La consécutivité est basée sur les jours avec activité (trades ou compliance)
        # Les jours sans activité (sans trades et sans compliance) ne cassent pas le streak
        for date_str in all_dates:
            data = daily_compliance[date_str]
            # Un jour compte comme "respecté" si :
            # 1. Il y a des trades : tous les trades ont une stratégie et tous respectent
            # 2. Il n'y a pas de trades mais il y a une compliance : la compliance indique que la stratégie est respectée
            is_respected = False
            if data['total'] > 0:
                # Jour avec trades : vérifier que tous les trades ont une stratégie et tous respectent
                is_respected = data['with_strategy'] == data['total'] and data['not_respected'] == 0
            elif data['has_day_compliance']:
                # Jour sans trades mais avec compliance : vérifier que la compliance indique le respect
                compliance = day_compliances_dict.get(date_str)
                is_respected = compliance and compliance.strategy_respected is True
            
            if is_respected:
                # Les jours avec activité sont considérés comme consécutifs même s'il y a des jours sans activité entre eux
                temp_streak += 1
                if temp_streak > best_streak:
                    best_streak = temp_streak
            else:
                # Le streak est cassé (jour avec activité mais non respecté)
                temp_streak = 0
        
        # Calculer le streak actuel en parcourant de la plus récente à la plus ancienne
        # IMPORTANT: La consécutivité est basée sur les jours avec activité (trades ou compliance)
        # Les jours sans activité (sans trades et sans compliance) ne cassent pas le streak
        current_streak = 0
        current_streak_start = None
        for date_str in reversed(all_dates):
            data = daily_compliance[date_str]
            # Un jour compte comme "respecté" si :
            # 1. Il y a des trades : tous les trades ont une stratégie et tous respectent
            # 2. Il n'y a pas de trades mais il y a une compliance : la compliance indique que la stratégie est respectée
            is_respected = False
            if data['total'] > 0:
                # Jour avec trades : vérifier que tous les trades ont une stratégie et tous respectent
                is_respected = data['with_strategy'] == data['total'] and data['not_respected'] == 0
            elif data['has_day_compliance']:
                # Jour sans trades mais avec compliance : vérifier que la compliance indique le respect
                # Pour un jour sans trades avec compliance, on a déjà compté la compliance dans 'respected' ou 'not_respected'
                # Donc on peut simplement vérifier que respected > 0 et not_respected == 0
                is_respected = data['respected'] > 0 and data['not_respected'] == 0
                # Double vérification avec l'objet compliance pour plus de sécurité
                compliance = day_compliances_dict.get(date_str)
                if compliance:
                    is_respected = is_respected and compliance.strategy_respected is True
            
            if is_respected:
                # Les jours avec activité sont considérés comme consécutifs même s'il y a des jours sans activité entre eux
                # On vérifie seulement que c'est un jour respecté avec activité
                # current_streak_start doit être la date la plus ancienne du streak (on la met à jour à chaque fois)
                current_streak_start = date_str
                current_streak += 1
            else:
                # Le streak actuel est cassé (jour avec activité mais non respecté), on s'arrête
                break
        
        # Calculer les taux de respect (trades avec stratégie + compliances pour jours sans trades)
        total_trades_with_strategy = sum(d['with_strategy'] for d in daily_compliance.values())
        total_respected = sum(d['respected'] for d in daily_compliance.values())
        total_not_respected = sum(d['not_respected'] for d in daily_compliance.values())
        
        # Le total inclut les trades avec stratégie ET les compliances pour les jours sans trades
        # (les compliances sont déjà comptées dans 'with_strategy', 'respected' et 'not_respected')
        overall_compliance_rate = (total_respected / total_trades_with_strategy * 100) if total_trades_with_strategy > 0 else 0
        
        # Calculer les taux pour différentes périodes
        now = timezone.now().date()
        last_7_days = (now - timedelta(days=7)).isoformat()
        last_30_days = (now - timedelta(days=30)).isoformat()
        last_90_days = (now - timedelta(days=90)).isoformat()
        
        def calculate_period_rate(start_date_str):
            period_trades_with_strategy = 0
            period_respected = 0
            for date_str, data in daily_compliance.items():
                if date_str >= start_date_str:
                    period_trades_with_strategy += data['with_strategy']
                    period_respected += data['respected']
            return (period_respected / period_trades_with_strategy * 100) if period_trades_with_strategy > 0 else 0
        
        compliance_7d = calculate_period_rate(last_7_days)
        compliance_30d = calculate_period_rate(last_30_days)
        compliance_90d = calculate_period_rate(last_90_days)
        
        # Calculer les badges obtenus de manière séquentielle
        # Un badge ne peut être obtenu que si tous les badges précédents sont obtenus
        badges = []
        badge_definitions = [
            {'id': 'beginner', 'name': 'Débutant discipliné', 'days': 3},
            {'id': 'week', 'name': 'Semaine parfaite', 'days': 7},
            {'id': 'two_weeks', 'name': 'Deux semaines exemplaires', 'days': 14},
            {'id': 'month', 'name': 'Mois de discipline', 'days': 30},
            {'id': 'two_months', 'name': 'Maître de la discipline', 'days': 60},
            {'id': 'three_months', 'name': 'Légende de la stratégie', 'days': 90},
            {'id': 'centurion', 'name': 'Centurion', 'days': 100},
            {'id': 'year', 'name': 'Année parfaite', 'days': 365},
        ]
        
        # Utiliser le streak actuel pour déterminer les badges obtenus
        # Les badges doivent être obtenus séquentiellement
        # Pour les badges obtenus, on utilise best_streak (pour garder les badges même si le streak actuel est cassé)
        # Pour la progression vers le prochain badge, on utilise current_streak
        all_previous_earned = True
        for i, badge in enumerate(badge_definitions):
            # Vérifier si tous les badges précédents sont obtenus
            if not all_previous_earned:
                # Si un badge précédent n'est pas obtenu, ce badge ne peut pas être obtenu
                badges.append({
                    'id': badge['id'],
                    'name': badge['name'],
                    'days': badge['days'],
                    'earned': False,
                    'progress': 0,
                    'locked': True  # Badge verrouillé car un badge précédent n'est pas obtenu
                })
            elif best_streak >= badge['days']:
                # Le badge est obtenu si le meilleur streak atteint le nombre de jours requis
                badges.append({
                    'id': badge['id'],
                    'name': badge['name'],
                    'days': badge['days'],
                    'earned': True,
                    'earned_date': None
                })
            else:
                # Le badge n'est pas encore obtenu, mais peut être débloqué
                # Utiliser current_streak pour la progression (streak actuel en cours)
                all_previous_earned = False
                badges.append({
                    'id': badge['id'],
                    'name': badge['name'],
                    'days': badge['days'],
                    'earned': False,
                    'progress': min((current_streak / badge['days']) * 100, 100),
                    'locked': False
                })
        
        # Prochain objectif : le premier badge non obtenu qui n'est pas verrouillé
        next_badge = next((b for b in badges if not b.get('earned', False) and not b.get('locked', False)), None)
        
        # Comparaison de performance (respecté vs non respecté)
        performance_comparison = {
            'respected': {'count': 0, 'total_pnl': Decimal('0'), 'winning_trades': 0},
            'not_respected': {'count': 0, 'total_pnl': Decimal('0'), 'winning_trades': 0}
        }
        
        for strategy in strategies_queryset:
            if strategy.strategy_respected is not None and strategy.trade.net_pnl is not None:
                if strategy.strategy_respected:
                    performance_comparison['respected']['count'] += 1
                    performance_comparison['respected']['total_pnl'] += strategy.trade.net_pnl
                    if strategy.trade.net_pnl > 0:
                        performance_comparison['respected']['winning_trades'] += 1
                else:
                    performance_comparison['not_respected']['count'] += 1
                    performance_comparison['not_respected']['total_pnl'] += strategy.trade.net_pnl
                    if strategy.trade.net_pnl > 0:
                        performance_comparison['not_respected']['winning_trades'] += 1
        
        # Calculer les moyennes et win rates
        respected_avg_pnl = (performance_comparison['respected']['total_pnl'] / 
                            performance_comparison['respected']['count']) if performance_comparison['respected']['count'] > 0 else Decimal('0')
        not_respected_avg_pnl = (performance_comparison['not_respected']['total_pnl'] / 
                                performance_comparison['not_respected']['count']) if performance_comparison['not_respected']['count'] > 0 else Decimal('0')
        
        respected_win_rate = (performance_comparison['respected']['winning_trades'] / 
                            performance_comparison['respected']['count'] * 100) if performance_comparison['respected']['count'] > 0 else 0
        not_respected_win_rate = (performance_comparison['not_respected']['winning_trades'] / 
                                performance_comparison['not_respected']['count'] * 100) if performance_comparison['not_respected']['count'] > 0 else 0
        
        # Log de débogage
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"📊 strategy_compliance_stats - account_id={trading_account_id}, current_streak={current_streak}, current_streak_start={current_streak_start}")
        print(f"📊 [DEBUG] strategy_compliance_stats - account_id={trading_account_id}, current_streak={current_streak}, current_streak_start={current_streak_start}")
        
        return Response({
            'current_streak': current_streak,
            'current_streak_start': current_streak_start,
            'best_streak': best_streak,
            'overall_compliance_rate': round(overall_compliance_rate, 2),
            'compliance_7d': round(compliance_7d, 2),
            'compliance_30d': round(compliance_30d, 2),
            'compliance_90d': round(compliance_90d, 2),
            'total_trades': total_trades_with_strategy,
            'total_respected': total_respected,
            'total_not_respected': total_not_respected,
            'badges': badges,
            'next_badge': next_badge,
            'performance_comparison': {
                'respected': {
                    'count': performance_comparison['respected']['count'],
                    'avg_pnl': str(respected_avg_pnl),
                    'total_pnl': str(performance_comparison['respected']['total_pnl']),
                    'win_rate': round(respected_win_rate, 2),
                    'winning_trades': performance_comparison['respected']['winning_trades']
                },
                'not_respected': {
                    'count': performance_comparison['not_respected']['count'],
                    'avg_pnl': str(not_respected_avg_pnl),
                    'total_pnl': str(performance_comparison['not_respected']['total_pnl']),
                    'win_rate': round(not_respected_win_rate, 2),
                    'winning_trades': performance_comparison['not_respected']['winning_trades']
                }
            },
            'daily_compliance': [
                {
                    'date': date_str,
                    'total': data['total'],
                    'respected': data['respected'],
                    'not_respected': data['not_respected'],
                    'compliance_rate': round((data['respected'] / data['with_strategy'] * 100) if data['with_strategy'] > 0 else 0, 2)
                }
                for date_str, data in sorted(daily_compliance.items())
            ]
        })


class DayStrategyComplianceViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour gérer les données de stratégie pour les jours sans trades.
    """
    serializer_class = DayStrategyComplianceSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Retourne uniquement les compliances de l'utilisateur connecté."""
        if not self.request.user.is_authenticated:
            return DayStrategyCompliance.objects.none()  # type: ignore
        queryset = DayStrategyCompliance.objects.filter(user=self.request.user).select_related('trading_account')  # type: ignore
        
        # Filtres optionnels
        date = self.request.query_params.get('date', None)
        strategy_respected = self.request.query_params.get('strategy_respected', None)
        trading_account_id = self.request.query_params.get('trading_account', None)
        
        if date:
            queryset = queryset.filter(date=date)
        if strategy_respected is not None:
            queryset = queryset.filter(strategy_respected=strategy_respected.lower() == 'true')  # type: ignore
        if trading_account_id:
            queryset = queryset.filter(trading_account_id=trading_account_id)
        
        return queryset.order_by('-date', '-created_at')
    
    def perform_create(self, serializer):
        """Associe automatiquement l'utilisateur connecté à la compliance."""
        serializer.save(user=self.request.user)
    
    @action(detail=False, methods=['get'])
    def by_date(self, request):
        """Récupère la compliance pour une date spécifique."""
        date = request.query_params.get('date')
        if not date:
            return Response({'error': 'Paramètre date requis'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # 🔒 SÉCURITÉ : Filtrer par utilisateur connecté
            queryset = DayStrategyCompliance.objects.filter(  # type: ignore
                user=self.request.user,  # ✅ Filtre par utilisateur
                date=date
            )
            
            # Filtrer par compte de trading si spécifié
            trading_account_id = request.query_params.get('trading_account')
            if trading_account_id:
                queryset = queryset.filter(trading_account_id=trading_account_id)
            
            compliance = queryset.first()
            
            if compliance:
                serializer = self.get_serializer(compliance)
                return Response(serializer.data)
            else:
                # Retourner null au lieu d'un 404 pour éviter les erreurs dans la console
                # quand il n'y a pas encore de compliance (cas normal)
                return Response(None, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser])
    def upload_screenshot(self, request):
        """
        Upload un screenshot pour un jour sans trade.
        Retourne les URLs de l'image originale et de la miniature.
        """
        from rest_framework.parsers import MultiPartParser
        from .serializers import ScreenshotUploadSerializer
        from .image_processor import image_processor
        import logging
        
        logger = logging.getLogger(__name__)
        
        # Valider le fichier
        serializer = ScreenshotUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            file = serializer.validated_data['file']
            user_id = request.user.id
            
            # Traiter l'image (compression + miniature)
            original_url, thumbnail_url = image_processor.process_screenshot(file, user_id)
            
            logger.info(
                f"Screenshot uploadé avec succès pour l'utilisateur {user_id} (jour sans trade): "
                f"original={original_url}, thumbnail={thumbnail_url}"
            )
            
            return Response({
                'original_url': original_url,
                'thumbnail_url': thumbnail_url,
                'message': 'Screenshot uploadé avec succès'
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Erreur lors de l'upload du screenshot (jour sans trade) : {e}")
            return Response({
                'error': 'Erreur lors du traitement de l\'image',
                'detail': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'])
    def delete_screenshot(self, request):
        """
        Supprime un screenshot et sa miniature du serveur.
        Seul le propriétaire peut supprimer ses fichiers.
        """
        from .image_processor import image_processor
        import logging
        
        logger = logging.getLogger(__name__)
        
        screenshot_url = request.data.get('screenshot_url')
        if not screenshot_url:
            return Response({
                'error': 'URL du screenshot requise'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Vérifier que l'URL appartient bien à l'utilisateur
        # En vérifiant que le chemin contient l'ID de l'utilisateur
        user_id = request.user.id
        if f'/screenshots/{user_id}/' not in screenshot_url:
            logger.warning(
                f"Tentative de suppression d'un screenshot non autorisé par l'utilisateur {user_id}: {screenshot_url}"
            )
            return Response({
                'error': 'Vous n\'êtes pas autorisé à supprimer ce fichier'
            }, status=status.HTTP_403_FORBIDDEN)
        
        try:
            # Supprimer le fichier et sa miniature
            success = image_processor.delete_screenshot(screenshot_url)
            
            if success:
                logger.info(f"Screenshot supprimé avec succès par l'utilisateur {user_id} (jour sans trade): {screenshot_url}")
                return Response({
                    'message': 'Screenshot supprimé avec succès'
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'error': 'Fichier non trouvé ou déjà supprimé'
                }, status=status.HTTP_404_NOT_FOUND)
                
        except Exception as e:
            logger.error(f"Erreur lors de la suppression du screenshot : {e}")
            return Response({
                'error': 'Erreur lors de la suppression du fichier',
                'detail': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PositionStrategyViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour gérer les stratégies de position avec versioning.
    """
    serializer_class = PositionStrategySerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Retourne uniquement les stratégies de l'utilisateur connecté."""
        if not self.request.user.is_authenticated:
            return PositionStrategy.objects.none()  # type: ignore
        
        queryset = PositionStrategy.objects.filter(user=self.request.user)  # type: ignore
        
        # Filtres optionnels
        status = self.request.query_params.get('status', None)
        is_current = self.request.query_params.get('is_current', None)
        search = self.request.query_params.get('search', None)
        include_archived = self.request.query_params.get('include_archived', 'false').lower() == 'true'  # type: ignore
        
        # Appliquer le filtre par statut
        if status:
            queryset = queryset.filter(status=status)
        elif not include_archived:
            # Par défaut, exclure les stratégies archivées sauf si explicitement demandé
            print(f"DEBUG: Excluding archived strategies. include_archived={include_archived}")
            queryset = queryset.exclude(status='archived')
        
        if is_current is not None:
            queryset = queryset.filter(is_current=is_current.lower() == 'true')  # type: ignore
        if search:
            queryset = queryset.filter(
                models.Q(title__icontains=search) | 
                models.Q(description__icontains=search)
            )
        
        return queryset.order_by('-created_at')
    
    def get_serializer_class(self):  # type: ignore
        """Retourne le serializer approprié selon l'action."""
        if self.action == 'create':
            return PositionStrategyCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return PositionStrategyUpdateSerializer
        return PositionStrategySerializer
    
    def perform_create(self, serializer):
        """Associe automatiquement l'utilisateur connecté à la stratégie."""
        serializer.save(user=self.request.user)
    
    def perform_update(self, serializer):
        """Gère la mise à jour avec création de nouvelle version si nécessaire."""
        current_strategy = self.get_object()
        create_new_version = serializer.validated_data.pop('create_new_version', True)
        
        # Ne créer une nouvelle version que si :
        # 1. create_new_version est True
        # 2. La stratégie est actuelle
        # 3. La stratégie n'est PAS en brouillon (les brouillons se mettent à jour directement)
        if (create_new_version and 
            current_strategy.is_current and 
            current_strategy.status != 'draft'):
            
            # Créer une nouvelle version
            new_strategy = current_strategy.create_new_version(
                new_content=serializer.validated_data.get('strategy_content', current_strategy.strategy_content),
                version_notes=serializer.validated_data.get('version_notes', '')
            )
            # Mettre à jour les autres champs (sauf is_current qui doit rester True)
            update_fields = []
            for field, value in serializer.validated_data.items():
                if field not in ['strategy_content', 'version_notes', 'is_current']:
                    setattr(new_strategy, field, value)
                    update_fields.append(field)
            
            # Sauvegarder uniquement les champs modifiés, en préservant is_current=True
            if update_fields:
                new_strategy.save(update_fields=update_fields)
            
            # Retourner la nouvelle stratégie au lieu de l'ancienne
            serializer.instance = new_strategy
        else:
            # Mise à jour directe (pour les brouillons ou si create_new_version=False)
            serializer.save()
    
    def destroy(self, request, *args, **kwargs):
        """
        Supprime une stratégie en gérant correctement le versioning.
        Si la stratégie est un parent (parent_strategy est null) et qu'elle a des versions,
        on transfère le parentage à la première version enfant avant de supprimer.
        """
        strategy = self.get_object()
        
        # Si la stratégie est un parent (parent_strategy est null) et qu'elle a des versions enfants
        if strategy.parent_strategy is None and strategy.versions.exists():  # type: ignore
            # Récupérer toutes les versions enfants
            child_versions = strategy.versions.all().order_by('version')  # type: ignore
            
            if child_versions.exists():
                # Prendre la première version enfant comme nouveau parent
                new_parent = child_versions.first()
                
                # Transférer toutes les autres versions enfants vers le nouveau parent
                for child in child_versions:
                    if child.id != new_parent.id:
                        child.parent_strategy = new_parent
                        child.save()
                
                # Le nouveau parent devient le parent racine (parent_strategy = null)
                new_parent.parent_strategy = None
                new_parent.save()
        
        # Supprimer la stratégie (maintenant elle n'a plus de versions enfants ou n'est pas un parent)
        self.perform_destroy(strategy)
        
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    def get_object(self):
        """
        Override get_object pour les actions de modification (update, destroy, retrieve) 
        afin d'inclure les stratégies archivées.
        """
        # Pour les actions de modification et de récupération, utiliser un queryset de base sans filtre d'archivage
        if self.action in ['update', 'partial_update', 'destroy', 'versions', 'restore_version', 'retrieve']:
            queryset = PositionStrategy.objects.filter(user=self.request.user)  # type: ignore
            lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
            filter_kwargs = {self.lookup_field: self.kwargs[lookup_url_kwarg]}
            obj = get_object_or_404(queryset, **filter_kwargs)
            self.check_object_permissions(self.request, obj)
            return obj
        # Pour les autres actions, utiliser le queryset normal avec filtres
        return super().get_object()
    
    def retrieve(self, request, *args, **kwargs):
        """Override retrieve pour gérer les erreurs de sérialisation."""
        try:
            return super().retrieve(request, *args, **kwargs)
        except Http404:
            # Si l'objet n'existe pas, retourner un 404 approprié
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Stratégie {kwargs.get('pk')} non trouvée pour l'utilisateur {request.user.id}")
            raise
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Erreur lors de la récupération de la stratégie {kwargs.get('pk')}: {str(e)}", exc_info=True)
            return Response(
                {
                    'error': 'Erreur lors de la récupération de la stratégie',
                    'detail': str(e) if settings.DEBUG else 'Une erreur est survenue. Veuillez contacter le support.'
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'])
    def versions(self, request, pk=None):
        """Récupère l'historique des versions d'une stratégie."""
        try:
            strategy = self.get_object()
            versions = strategy.get_version_history()
            serializer = PositionStrategyVersionSerializer(versions, many=True)
            return Response(serializer.data)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Erreur lors de la récupération des versions pour la stratégie {pk}: {str(e)}", exc_info=True)
            return Response(
                {
                    'error': 'Erreur lors de la récupération des versions',
                    'detail': str(e) if settings.DEBUG else 'Une erreur est survenue. Veuillez contacter le support.'
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def restore_version(self, request, pk=None):
        """Restaure une version spécifique comme version actuelle."""
        strategy = self.get_object()
        version_id = request.data.get('version_id')
        
        if not version_id:
            return Response({'error': 'version_id requis'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Récupérer toutes les versions du groupe (parent + enfants)
            parent = strategy.parent_strategy or strategy
            all_versions = PositionStrategy.objects.filter(  # type: ignore
                models.Q(id=parent.id) | models.Q(parent_strategy=parent),
                user=request.user
            )
            
            target_version = all_versions.get(id=version_id)
            
            # Trouver l'ancienne version actuelle (s'il y en a une)
            old_current = all_versions.filter(is_current=True).first()
            
            # S'assurer qu'une seule version est marquée comme actuelle
            # D'abord, mettre toutes les versions à is_current=False
            all_versions.update(is_current=False)
            
            # Archiver l'ancienne version actuelle si elle existe et était active
            if old_current and old_current.id != target_version.id and old_current.status == 'active':
                old_current.refresh_from_db()
                old_current.status = 'archived'
                old_current.save(update_fields=['status'])
            
            # Rafraîchir l'objet target_version depuis la base de données
            target_version.refresh_from_db()
            
            # Marquer la version cible comme actuelle et restaurer son statut si elle était archivée
            target_version.is_current = True
            update_fields = ['is_current']
            
            # Si la version était archivée, la remettre en active
            if target_version.status == 'archived':
                target_version.status = 'active'
                update_fields.append('status')
            
            target_version.save(update_fields=update_fields)
            
            serializer = self.get_serializer(target_version)
            return Response(serializer.data)
        except PositionStrategy.DoesNotExist:  # type: ignore
            return Response({'error': 'Version non trouvée'}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['get'])
    def print_view(self, request, pk=None):
        """Retourne la stratégie formatée pour l'impression."""
        strategy = self.get_object()
        
        # Récupérer created_at du parent via parent_strategy_id
        if strategy.parent_strategy_id:
            # Récupérer la date de création du parent via une requête
            parent = PositionStrategy.objects.get(id=strategy.parent_strategy_id)  # type: ignore
            parent_created_at = parent.created_at
            parent_id = strategy.parent_strategy_id
        else:
            # C'est le parent lui-même
            parent_created_at = strategy.created_at
            parent_id = strategy.id
        
        # Récupérer la version active (is_current=True) de cette stratégie
        # Chercher parmi le parent et toutes ses versions enfants
        active_version = PositionStrategy.objects.filter(  # type: ignore
            Q(id=parent_id) | Q(parent_strategy_id=parent_id),
            user=strategy.user,
            is_current=True
        ).first()
        
        # Si une version active existe, l'utiliser, sinon utiliser la stratégie demandée
        strategy_to_print = active_version if active_version else strategy
        
        # Préparer les données pour l'impression
        strategy_data = PositionStrategySerializer(strategy_to_print).data
        
        # Mettre à jour les dates dans les données sérialisées
        # created_at = date du parent (première version)
        # updated_at = date de la version active
        strategy_data['created_at'] = parent_created_at
        strategy_data['updated_at'] = strategy_to_print.updated_at
        
        print_data = {
            'strategy': strategy_data,
            'print_settings': {
                'page_size': 'A4',
                'orientation': 'landscape',
                'margins': '10mm',
                'font_size': '12px',
                'line_height': '1.4'
            }
        }
        
        return Response(print_data)
    
    @action(detail=False, methods=['get'])
    def current_strategies(self, request):
        """Récupère toutes les stratégies actuelles (dernières versions)."""
        queryset = self.get_queryset().filter(is_current=True)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def by_status(self, request):
        """Récupère les stratégies groupées par statut."""
        strategies = self.get_queryset().filter(is_current=True)
        
        grouped = {}
        for strategy in strategies:
            status = strategy.status
            if status not in grouped:
                grouped[status] = []
            grouped[status].append(PositionStrategySerializer(strategy).data)
        
        return Response(grouped)
    
    @action(detail=False, methods=['get'])
    def archives(self, request):
        """Récupère toutes les versions archivées (non actuelles)."""
        # Pour les archives, on veut inclure les stratégies archivées
        queryset = PositionStrategy.objects.filter(user=request.user)  # type: ignore
        
        # Filtres optionnels
        status = request.query_params.get('status', None)
        search = request.query_params.get('search', None)
        
        # Par défaut, montrer seulement les stratégies archivées
        queryset = queryset.filter(status='archived')
        
        if status:
            queryset = queryset.filter(status=status)
        if search:
            queryset = queryset.filter(
                models.Q(title__icontains=search) | 
                models.Q(description__icontains=search)
            )
        
        serializer = self.get_serializer(queryset.order_by('-created_at'), many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        """Duplique une stratégie existante."""
        original = self.get_object()
        
        # Créer une copie avec un nouveau titre
        new_title = f"{original.title} (Copie)"
        new_strategy = PositionStrategy.objects.create(
            user=request.user,
            title=new_title,
            description=original.description,
            strategy_content=original.strategy_content,
            status='draft',
            version_notes='Copie de la stratégie originale'
        )
        
        serializer = self.get_serializer(new_strategy)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['get'])
    def read_mode(self, request, pk=None):
        """Retourne la stratégie formatée pour le mode lecture avec les règles."""
        strategy = self.get_object()
        
        # Formater les données pour le mode lecture
        read_mode_data = {
            'id': strategy.id,
            'title': strategy.title,
            'description': strategy.description,
            'version': strategy.version,
            'status': strategy.status,
            'created_at': strategy.created_at,
            'updated_at': strategy.updated_at,
            'sections': []
        }
        
        # Traiter chaque section
        for section in strategy.strategy_content.get('sections', []):
            section_data = {
                'title': section.get('title', ''),
                'rules': []
            }
            
            # Traiter chaque règle
            for rule in section.get('rules', []):
                rule_data = {
                    'id': rule.get('id', 0),
                    'text': rule.get('text', ''),
                    'checked': False  # Par défaut non cochée
                }
                section_data['rules'].append(rule_data)
            
            read_mode_data['sections'].append(section_data)
        
        return Response(read_mode_data)


class TradingGoalViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour gérer les objectifs de trading.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = TradingGoalSerializer
    
    def get_queryset(self):
        """Retourne uniquement les objectifs de l'utilisateur connecté."""
        if not self.request.user.is_authenticated:
            return TradingGoal.objects.none()  # type: ignore
        queryset = TradingGoal.objects.filter(user=self.request.user)  # type: ignore
        
        # Filtres optionnels
        status = self.request.query_params.get('status', None)
        if status:
            queryset = queryset.filter(status=status)
        
        period_type = self.request.query_params.get('period_type', None)
        if period_type:
            queryset = queryset.filter(period_type=period_type)
        
        trading_account = self.request.query_params.get('trading_account', None)
        if trading_account:
            queryset = queryset.filter(trading_account_id=trading_account)
        
        return queryset.order_by('-priority', '-created_at')
    
    def perform_create(self, serializer):
        """Associe automatiquement l'objectif à l'utilisateur connecté."""
        goal = serializer.save(user=self.request.user)
        # Calculer la progression initiale
        goal.update_progress()
    
    def perform_update(self, serializer):
        """Met à jour l'objectif et recalcule la progression."""
        goal = serializer.save()
        # Ne pas recalculer la progression si le statut est 'cancelled'
        # car cela pourrait écraser le statut que l'utilisateur vient de définir
        if goal.status != 'cancelled':
            goal.update_progress()
    
    @action(detail=True, methods=['get'])
    def progress(self, request, pk=None):
        """
        Retourne les données de progression détaillées d'un objectif.
        """
        goal = self.get_object()
        from .services import GoalProgressCalculator
        
        calculator = GoalProgressCalculator()
        progress_data = calculator.calculate_progress(goal)
        
        # Mettre à jour l'objectif avec les nouvelles valeurs
        goal.current_value = progress_data['current_value']
        if progress_data['status'] != goal.status:
            goal.status = progress_data['status']
        goal.save(update_fields=['current_value', 'status', 'updated_at'])
        
        serializer = TradingGoalProgressSerializer(progress_data)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def update_all_progress(self, request):
        """
        Met à jour la progression de tous les objectifs actifs de l'utilisateur.
        """
        active_goals = self.get_queryset().filter(status='active')
        updated_count = 0
        
        for goal in active_goals:
            goal.update_progress()
            updated_count += 1
        
        return Response({
            'message': f'{updated_count} objectif(s) mis à jour',
            'updated_count': updated_count
        })
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """
        Retourne des statistiques globales sur les objectifs de l'utilisateur.
        """
        goals = self.get_queryset()
        
        total_goals = goals.count()
        active_goals = goals.filter(status='active').count()
        achieved_goals = goals.filter(status='achieved').count()
        failed_goals = goals.filter(status='failed').count()
        cancelled_goals = goals.filter(status='cancelled').count()
        
        # Objectifs par type
        goals_by_type = {}
        for goal_type, label in TradingGoal.GOAL_TYPE_CHOICES:  # type: ignore
            goals_by_type[goal_type] = goals.filter(goal_type=goal_type).count()
        
        # Objectifs par période
        goals_by_period = {}
        for period_type, label in TradingGoal.PERIOD_TYPE_CHOICES:  # type: ignore
            goals_by_period[period_type] = goals.filter(period_type=period_type).count()
        
        return Response({
            'total_goals': total_goals,
            'active_goals': active_goals,
            'achieved_goals': achieved_goals,
            'failed_goals': failed_goals,
            'cancelled_goals': cancelled_goals,
            'goals_by_type': goals_by_type,
            'goals_by_period': goals_by_period,
        })
