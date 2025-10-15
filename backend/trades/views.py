from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.db.models import Sum, Count, Avg, Max, Min
from django.utils import timezone
from datetime import timedelta, datetime
import pytz
from decimal import Decimal
from collections import defaultdict

from .models import TopStepTrade, TopStepImportLog, TradeStrategy
from .serializers import (
    TopStepTradeSerializer,
    TopStepTradeListSerializer,
    TopStepImportLogSerializer,
    TradeStatisticsSerializer,
    TradingMetricsSerializer,
    CSVUploadSerializer,
    TradeStrategySerializer
)
from .utils import TopStepCSVImporter


class TopStepTradeViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour gérer les trades TopStep.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return TopStepTradeListSerializer
        return TopStepTradeSerializer
    
    def get_queryset(self):
        """Retourne uniquement les trades de l'utilisateur connecté."""
        if not self.request.user.is_authenticated:
            return TopStepTrade.objects.none()
        queryset = TopStepTrade.objects.filter(user=self.request.user)
        
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
                start_datetime = datetime.strptime(start_date, '%Y-%m-%d')
                # Ajouter le timezone Europe/Paris pour la date de début (00:00:00)
                paris_tz = pytz.timezone('Europe/Paris')
                start_datetime = paris_tz.localize(start_datetime)
                queryset = queryset.filter(entered_at__gte=start_datetime)
            except ValueError:
                pass  # Ignorer les dates mal formatées
        
        if end_date:
            # Convertir la date de fin en datetime timezone-aware
            try:
                end_datetime = datetime.strptime(end_date, '%Y-%m-%d')
                # Ajouter le timezone Europe/Paris pour la date de fin (23:59:59)
                paris_tz = pytz.timezone('Europe/Paris')
                end_datetime = paris_tz.localize(end_datetime.replace(hour=23, minute=59, second=59))
                queryset = queryset.filter(entered_at__lte=end_datetime)
            except ValueError:
                pass  # Ignorer les dates mal formatées
        if profitable is not None:
            if profitable.lower() == 'true':
                queryset = queryset.filter(net_pnl__gt=0)
            elif profitable.lower() == 'false':
                queryset = queryset.filter(net_pnl__lt=0)
        
        if trade_day:
            # Filtrer par date de trade spécifique
            try:
                from datetime import date
                trade_date = date.fromisoformat(trade_day)
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
        total_strategies = TradeStrategy.objects.filter(user=request.user).count()
        
        # Supprimer seulement les données de l'utilisateur connecté
        TopStepTrade.objects.filter(user=request.user).delete()
        TopStepImportLog.objects.filter(user=request.user).delete()
        
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
            trades_to_delete = TopStepTrade.objects.filter(trade_day=trade_date, user=request.user)
            
            # Compter les stratégies associées
            strategy_count = TradeStrategy.objects.filter(trade__in=trades_to_delete).count()
            
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
            best_trade=Max('net_pnl'),
            worst_trade=Min('net_pnl'),
            total_fees=Sum('fees'),
            total_volume=Sum('size')
        )
        
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
        if aggregates['worst_trade'] and aggregates['best_trade']:
            if aggregates['worst_trade'] != 0:
                recovery_ratio = abs(aggregates['best_trade'] / aggregates['worst_trade'])
        
        # 5. Ratio P/L par Trade
        pnl_per_trade = 0
        if total_trades > 0:
            pnl_per_trade = aggregates['total_pnl'] / total_trades
        
        # 6. Ratio de Frais
        fees_ratio = 0
        if aggregates['total_pnl'] and aggregates['total_pnl'] != 0:
            fees_ratio = abs(aggregates['total_fees'] / aggregates['total_pnl'])
        
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
            'win_rate': round(win_rate, 2),
            'total_pnl': aggregates['total_pnl'] or Decimal('0'),
            'total_gains': total_gains,
            'total_losses': total_losses,
            'average_pnl': aggregates['average_pnl'] or Decimal('0'),
            'best_trade': aggregates['best_trade'] or Decimal('0'),
            'worst_trade': aggregates['worst_trade'] or Decimal('0'),
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
        
        csv_file = serializer.validated_data['file']
        logger.info(f"Fichier validé: {csv_file.name} ({csv_file.size} bytes)")
        
        try:
            # Lire le contenu du fichier et supprimer le BOM si présent
            content = csv_file.read().decode('utf-8-sig')  # utf-8-sig supprime automatiquement le BOM
            logger.info(f"Contenu lu: {len(content)} caractères")
            logger.info(f"Premières lignes:\n{content[:500]}")
            
            # Utiliser l'utilisateur connecté
            user = request.user
            logger.info(f"Utilisateur: {user.username}")
            
            # Importer via l'utilitaire
            importer = TopStepCSVImporter(user)
            result = importer.import_from_string(content, csv_file.name)
            
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
                
                return Response({
                    'success': True,
                    'message': final_message,
                    'total_rows': result['total_rows'],
                    'success_count': result['success_count'],
                    'error_count': result['error_count'],
                    'skipped_count': result.get('skipped_count', 0),
                    'errors': result.get('errors', [])
                }, status=status.HTTP_201_CREATED)
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
        
        # Agréger par jour
        daily_data = defaultdict(lambda: {'pnl': 0.0, 'trade_count': 0})
        for trade in month_trades:
            day = trade.entered_at.day
            daily_data[day]['pnl'] += float(trade.net_pnl)
            daily_data[day]['trade_count'] += 1
        
        # Convertir en format pour le frontend
        daily_result = []
        for day in range(1, 32):  # Maximum 31 jours dans un mois
            if day in daily_data:
                daily_result.append({
                    'date': str(day),
                    'pnl': daily_data[day]['pnl'],
                    'trade_count': daily_data[day]['trade_count']
                })
            else:
                daily_result.append({
                    'date': str(day),
                    'pnl': 0.0,
                    'trade_count': 0
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
        daily_data = defaultdict(lambda: {'pnl': 0.0, 'trade_count': 0, 'trades': []})
        for trade in trades:
            day_key = trade.entered_at.date()
            daily_data[day_key]['pnl'] += float(trade.net_pnl)
            daily_data[day_key]['trade_count'] += 1
            daily_data[day_key]['trades'].append(trade)

        # Calculer les statistiques quotidiennes
        daily_pnls = [data['pnl'] for data in daily_data.values()]
        daily_gains = [pnl for pnl in daily_pnls if pnl > 0]
        daily_losses = [pnl for pnl in daily_pnls if pnl < 0]
        daily_trade_counts = [data['trade_count'] for data in daily_data.values()]

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
            trades_list.sort(key=lambda t: t.entered_at)
            
            current_consecutive_wins = 0
            current_consecutive_losses = 0
            max_day_wins = 0
            max_day_losses = 0
            
            for trade in trades_list:
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
                'avg_gain_per_day': sum(daily_gains) / len(daily_gains) if daily_gains else 0.0,
                'median_gain_per_day': calculate_median(daily_gains),
                'avg_loss_per_day': sum(daily_losses) / len(daily_losses) if daily_losses else 0.0,
                'median_loss_per_day': calculate_median(daily_losses),
                'max_gain_per_day': max(daily_pnls) if daily_pnls else 0.0,
                'max_loss_per_day': min(daily_pnls) if daily_pnls else 0.0,
                'avg_trades_per_day': sum(daily_trade_counts) / len(daily_trade_counts) if daily_trade_counts else 0.0,
                'median_trades_per_day': calculate_median(daily_trade_counts),
            },
            'trade_stats': {
                'max_gain_per_trade': max(all_trade_pnls) if all_trade_pnls else 0.0,
                'max_loss_per_trade': min(all_trade_pnls) if all_trade_pnls else 0.0,
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
        trades = TopStepTrade.objects.filter(user=request.user).order_by('entered_at')
        
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
            return TopStepImportLog.objects.none()
        return TopStepImportLog.objects.filter(user=self.request.user).order_by('-imported_at')


class TradeStrategyViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour gérer les données de stratégie liées aux trades.
    """
    serializer_class = TradeStrategySerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Retourne uniquement les stratégies de l'utilisateur connecté."""
        if not self.request.user.is_authenticated:
            return TradeStrategy.objects.none()
        queryset = TradeStrategy.objects.filter(user=self.request.user).select_related('trade')
        
        # Filtres optionnels
        trade_id = self.request.query_params.get('trade_id', None)
        strategy_respected = self.request.query_params.get('strategy_respected', None)
        contract_name = self.request.query_params.get('contract_name', None)
        
        if trade_id:
            queryset = queryset.filter(trade__topstep_id=trade_id)
        if strategy_respected is not None:
            queryset = queryset.filter(strategy_respected=strategy_respected.lower() == 'true')
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
            strategy = TradeStrategy.objects.filter(trade__topstep_id=trade_id).first()
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
            strategies = TradeStrategy.objects.filter(
                trade__trade_day=date
            ).select_related('trade')
            serializer = self.get_serializer(strategies, many=True)
            return Response(serializer.data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
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
                    trade = TopStepTrade.objects.get(topstep_id=trade_id, user=self.request.user)
                except TopStepTrade.DoesNotExist:
                    continue
                
                # Créer ou mettre à jour la stratégie
                strategy, created = TradeStrategy.objects.update_or_create(
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
