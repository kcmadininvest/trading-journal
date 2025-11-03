from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.db.models import Sum, Count, Avg, Max, Min
from django.db import models
from django.utils import timezone
from datetime import timedelta, datetime
import pytz
from decimal import Decimal
from collections import defaultdict

from .models import TopStepTrade, TopStepImportLog, TradeStrategy, PositionStrategy, TradingAccount, Currency
from .serializers import (
    TopStepTradeSerializer,
    TopStepTradeListSerializer,
    TopStepImportLogSerializer,
    TradeStatisticsSerializer,
    TradingMetricsSerializer,
    CSVUploadSerializer,
    TradeStrategySerializer,
    PositionStrategySerializer,
    PositionStrategyCreateSerializer,
    PositionStrategyUpdateSerializer,
    PositionStrategyVersionSerializer,
    TradingAccountSerializer,
    TradingAccountListSerializer,
    CurrencySerializer,
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
        serializer.save(user=self.request.user)
    
    @action(detail=False, methods=['get'])
    def default(self, request):
        """
        Retourne le compte par défaut de l'utilisateur.
        """
        try:
            default_account = self.get_queryset().filter(is_default=True).first()
            if not default_account:
                return Response(
                    {'error': 'Aucun compte par défaut trouvé'}, 
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


class CurrencyViewSet(viewsets.ReadOnlyModelViewSet):
    """Liste des devises disponibles."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CurrencySerializer  # type: ignore

    def get_queryset(self):
        return Currency.objects.all()

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
                'duration_ratio': 0
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
        profit_factor = 0
        if total_losses != 0:
            profit_factor = abs(total_gains / abs(total_losses))
        
        # 2. Ratio Win/Loss
        win_loss_ratio = 0
        if losing_trades > 0:
            win_loss_ratio = winning_trades / losing_trades
        
        # 3. Ratio de Consistance (taux de réussite)
        consistency_ratio = win_rate
        
        # 4. Ratio de Récupération
        recovery_ratio = 0
        if worst_trade and best_trade:
            if worst_trade != 0:
                recovery_ratio = abs(best_trade / worst_trade)
        
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
            'duration_ratio': round(duration_ratio, 2)
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
                
                # Calculer le drawdown actuel
                if peak_capital > 0:
                    current_dd = ((peak_capital - cumulative_capital) / peak_capital) * 100
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
            
            # Si aucun trade pour ce jour, pas de statut
            if total_trades == 0:
                return None
            
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
                daily_result.append({
                    'date': str(day),
                    'pnl': 0.0,
                    'trade_count': 0,
                    'strategy_compliance_status': None
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
                weekly_data[week_key]['pnl'] += float(trade.net_pnl)
                weekly_data[week_key]['trade_count'] += 1
                if weekly_data[week_key]['saturday_date'] is None:
                    weekly_data[week_key]['saturday_date'] = saturday_date.isoformat()
        
        # Convertir en format pour le frontend
        weekly_result = []
        for week_key in sorted(weekly_data.keys()):
            saturday_date = weekly_data[week_key]['saturday_date']
            # Ne garder que les semaines de l'année en cours
            if saturday_date and datetime.strptime(saturday_date, '%Y-%m-%d').year == year:
                weekly_result.append({
                    'saturday_date': saturday_date,
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
                },
                'trade_stats': {
                    'max_gain_per_trade': 0.0,
                    'max_loss_per_trade': 0.0,
                    'avg_winning_trade': 0.0,
                    'median_winning_trade': 0.0,
                    'avg_losing_trade': 0.0,
                    'median_losing_trade': 0.0,
                },
                'consecutive_stats': {
                    'max_consecutive_wins_per_day': 0,
                    'max_consecutive_losses_per_day': 0,
                    'max_consecutive_wins': 0,
                    'max_consecutive_losses': 0,
                }
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

        # Calculer les séquences consécutives par jour
        max_consecutive_wins_per_day = 0
        max_consecutive_losses_per_day = 0
        
        for day_data in daily_data.values():
            trades_list = day_data['trades']
            if not trades_list:
                continue
                
            # Trier les trades par heure d'entrée
            trades_list.sort(key=lambda t: t.entered_at)  # type: ignore
            
            current_consecutive_wins = 0
            current_consecutive_losses = 0
            max_day_wins = 0
            max_day_losses = 0
            
            for trade in trades_list:  # type: ignore
                if trade.net_pnl > 0:
                    # Trade gagnant
                    current_consecutive_wins += 1
                    current_consecutive_losses = 0
                    max_day_wins = max(max_day_wins, current_consecutive_wins)
                elif trade.net_pnl < 0:
                    # Trade perdant
                    current_consecutive_losses += 1
                    current_consecutive_wins = 0
                    max_day_losses = max(max_day_losses, current_consecutive_losses)
                else:
                    # Trade break-even (P/L = 0) - interrompt les séquences
                    current_consecutive_wins = 0
                    current_consecutive_losses = 0
            
            max_consecutive_wins_per_day = max(max_consecutive_wins_per_day, max_day_wins)
            max_consecutive_losses_per_day = max(max_consecutive_losses_per_day, max_day_losses)

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
            },
            'trade_stats': {
                'max_gain_per_trade': max(winning_trades) if winning_trades else 0.0,
                'max_loss_per_trade': min(losing_trades) if losing_trades else 0.0,
                'avg_winning_trade': sum(winning_trades) / len(winning_trades) if winning_trades else 0.0,
                'median_winning_trade': calculate_median(winning_trades),
                'avg_losing_trade': sum(losing_trades) / len(losing_trades) if losing_trades else 0.0,
                'median_losing_trade': calculate_median(losing_trades),
            },
            'consecutive_stats': {
                'max_consecutive_wins_per_day': max_consecutive_wins_per_day,
                'max_consecutive_losses_per_day': max_consecutive_losses_per_day,
                'max_consecutive_wins': max_consecutive_wins,
                'max_consecutive_losses': max_consecutive_losses,
            }
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
        year = request.query_params.get('year')
        month = request.query_params.get('month')
        trading_account_id = request.query_params.get('trading_account')
        
        # Déterminer la période
        if year:
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
        all_time_queryset = TradeStrategy.objects.filter(user=self.request.user)  # type: ignore
        
        # Calculs
        total_strategies = queryset.count()
        total_all_time = all_time_queryset.count()
        
        # 1. Respect de la stratégie en %
        # Calculer par rapport au nombre total de trades
        strategies_with_respect = queryset.exclude(strategy_respected__isnull=True)
        respected_count = strategies_with_respect.filter(strategy_respected=True).count()
        not_respected_count = strategies_with_respect.filter(strategy_respected=False).count()
        # Pourcentages par rapport au total des trades
        respect_percentage = (respected_count / total_strategies * 100) if total_strategies > 0 else 0
        not_respect_percentage = (not_respected_count / total_strategies * 100) if total_strategies > 0 else 0
        
        # Respect total toutes périodes
        all_time_with_respect = all_time_queryset.exclude(strategy_respected__isnull=True)
        all_time_respected = all_time_with_respect.filter(strategy_respected=True).count()
        all_time_not_respected = all_time_with_respect.filter(strategy_respected=False).count()
        all_time_respect_percentage = (all_time_respected / total_all_time * 100) if total_all_time > 0 else 0
        all_time_not_respect_percentage = (all_time_not_respected / total_all_time * 100) if total_all_time > 0 else 0
        
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
        tp1_only = winning_sessions.filter(tp1_reached=True, tp2_plus_reached=False).count()
        tp2_plus = winning_sessions.filter(tp2_plus_reached=True).count()
        no_tp = winning_count - tp1_only - tp2_plus
        
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
        period_data = []
        if month:
            # Par jour du mois
            current_date = start_date
            while current_date < end_date:
                day_str = current_date.strftime('%Y-%m-%d')
                day_strategies = queryset.filter(trade__trade_day=day_str)
                day_total = day_strategies.count()
                day_with_respect = day_strategies.exclude(strategy_respected__isnull=True)
                day_respected = day_with_respect.filter(strategy_respected=True).count()
                day_not_respected = day_with_respect.filter(strategy_respected=False).count()
                day_respect_percentage = (day_respected / day_total * 100) if day_total > 0 else 0
                day_not_respect_percentage = (day_not_respected / day_total * 100) if day_total > 0 else 0
                period_data.append({
                    'period': current_date.strftime('%d/%m'),
                    'date': day_str,
                    'respect_percentage': round(day_respect_percentage, 2),
                    'not_respect_percentage': round(day_not_respect_percentage, 2),
                    'total': day_total
                })
                current_date += timedelta(days=1)
        else:
            # Par mois de l'année
            target_year = year if year else now.year
            for m in range(1, 13):
                month_start = timezone.datetime(target_year, m, 1)
                if m == 12:
                    month_end = timezone.datetime(target_year + 1, 1, 1)
                else:
                    month_end = timezone.datetime(target_year, m + 1, 1)
                
                # Vérifier que le mois est dans la période
                if month_start < end_date and month_end > start_date:
                    month_strategies = queryset.filter(
                        trade__trade_day__gte=month_start.strftime('%Y-%m-%d'),
                        trade__trade_day__lt=month_end.strftime('%Y-%m-%d')
                    )
                    month_total = month_strategies.count()
                    month_with_respect = month_strategies.exclude(strategy_respected__isnull=True)
                    month_respected = month_with_respect.filter(strategy_respected=True).count()
                    month_not_respected = month_with_respect.filter(strategy_respected=False).count()
                    month_respect_percentage = (month_respected / month_total * 100) if month_total > 0 else 0
                    month_not_respect_percentage = (month_not_respected / month_total * 100) if month_total > 0 else 0
                    period_data.append({
                        'period': month_start.strftime('%B %Y'),
                        'date': month_start.strftime('%Y-%m'),
                        'respect_percentage': round(month_respect_percentage, 2),
                        'not_respect_percentage': round(month_not_respect_percentage, 2),
                        'total': month_total
                    })
        
        return Response({
            'period': {
                'year': year if year else now.year,
                'month': month,
                'start_date': start_date.strftime('%Y-%m-%d'),
                'end_date': end_date.strftime('%Y-%m-%d'),
            },
            'statistics': {
                'total_strategies': total_strategies,
                'respect_percentage': round(respect_percentage, 2),
                'not_respect_percentage': round(not_respect_percentage, 2),
                'respected_count': respected_count,
                'not_respected_count': not_respected_count,
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
                'total_strategies': total_all_time,
                'respect_percentage': round(all_time_respect_percentage, 2),
                'not_respect_percentage': round(all_time_not_respect_percentage, 2),
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
            # Mettre à jour les autres champs
            for field, value in serializer.validated_data.items():
                if field not in ['strategy_content', 'version_notes']:
                    setattr(new_strategy, field, value)
            new_strategy.save()
            
            # Retourner la nouvelle stratégie au lieu de l'ancienne
            serializer.instance = new_strategy
        else:
            # Mise à jour directe (pour les brouillons ou si create_new_version=False)
            serializer.save()
    
    @action(detail=True, methods=['get'])
    def versions(self, request, pk=None):
        """Récupère l'historique des versions d'une stratégie."""
        strategy = self.get_object()
        versions = strategy.get_version_history()
        serializer = PositionStrategyVersionSerializer(versions, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def restore_version(self, request, pk=None):
        """Restaure une version spécifique comme version actuelle."""
        strategy = self.get_object()
        version_id = request.data.get('version_id')
        
        if not version_id:
            return Response({'error': 'version_id requis'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            target_version = strategy.get_version_history().get(id=version_id)
            if target_version.user != request.user:
                return Response({'error': 'Accès non autorisé'}, status=status.HTTP_403_FORBIDDEN)
            
            # Créer une nouvelle version basée sur la version cible
            new_strategy = strategy.create_new_version(
                new_content=target_version.strategy_content,
                version_notes=f"Restauration de la version {target_version.version}"
            )
            
            serializer = self.get_serializer(new_strategy)
            return Response(serializer.data)
        except PositionStrategy.DoesNotExist:
            return Response({'error': 'Version non trouvée'}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['get'])
    def print_view(self, request, pk=None):
        """Retourne la stratégie formatée pour l'impression."""
        strategy = self.get_object()
        
        # Préparer les données pour l'impression
        print_data = {
            'strategy': PositionStrategySerializer(strategy).data,
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
