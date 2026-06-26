from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.db.models import Sum, Count, Avg, Max, Min, F, Value, CharField, Q, Case, When, DecimalField, ExpressionWrapper
from django.db.models.functions import TruncDate, Cast, Coalesce
from django.db import models
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.http import Http404
from django.conf import settings
from datetime import timedelta, datetime
import pytz
from decimal import Decimal
from collections import defaultdict
from typing import cast, Any, Dict, List
import logging

logger: logging.Logger = logging.getLogger(__name__)

TRADE_DRIVEN_GOAL_TYPES = (
    'pnl_total',
    'max_consecutive_losses',
    'daily_loss_limit_breaches',
    'expectancy',
    'avg_rr_actual',
    'journal_completion_rate',
    'win_rate',
    'trades_count',
    'profit_factor',
    'max_drawdown',
    'strategy_respect',
    'winning_days',
)

STRATEGY_DRIVEN_GOAL_TYPES = (
    'strategy_respect',
    'journal_completion_rate',
)


def refresh_goals_for_user(user, goal_types):
    """
    Recalcule les objectifs actifs/non annulés d'un utilisateur pour les types fournis.
    """
    goals_qs = TradingGoal.objects.filter(  # type: ignore
        user=user,
        goal_type__in=goal_types,
    ).exclude(status='cancelled')

    for goal in goals_qs:
        goal.update_progress()


def parse_contract_query_params(query_params) -> list[str]:
    """Extrait les noms de contrats depuis les query params (répétables ou CSV)."""
    raw = query_params.getlist('contract')
    if not raw:
        single = query_params.get('contract')
        if single:
            raw = [single]
    names: list[str] = []
    for item in raw:
        if not item:
            continue
        names.extend(part.strip() for part in str(item).split(',') if part.strip())
    return names


def get_user_timezone(request):
    """
    Récupère le timezone de l'utilisateur depuis ses préférences.
    Retourne un objet pytz.timezone.
    Fallback sur Europe/Paris si non défini ou invalide.
    """
    user_timezone = getattr(getattr(request.user, 'preferences', None), 'timezone', None)
    try:
        return pytz.timezone(user_timezone) if user_timezone else pytz.timezone('Europe/Paris')
    except pytz.exceptions.UnknownTimeZoneError:
        logger.warning(f"Timezone inconnue: {user_timezone}, utilisation de Europe/Paris par défaut")
        return pytz.timezone('Europe/Paris')
    except Exception as e:
        logger.error(f"Erreur lors de la configuration de la timezone: {str(e)}")
        return pytz.timezone('Europe/Paris')


from .models import TopStepTrade, TopStepImportLog, TradeStrategy, DayStrategyCompliance, PositionStrategy, TradingAccount, Currency, TradingGoal, AccountTransaction, AccountDailyMetrics
from .pnl_basis import (
    get_trade_pnl_field,
    get_trade_pnl_field_for_request,
    get_trade_join_pnl_field,
    get_trade_join_pnl_field_for_request,
    trade_pnl_as_float,
    trade_pnl_as_decimal,
)
from .services.behavior_discipline import (
    compute_behavior_discipline,
    empty_behavior_discipline,
)
from .services.post_loss_sizing import compute_post_loss_sizing, empty_post_loss_sizing
from .services.post_win_sizing import compute_post_win_sizing, empty_post_win_sizing
from .fx_conversion import (
    aggregate_monetary_from_trades,
    combined_initial_capital_in_base,
    make_pnl_getters,
    resolve_fx_pnl_resolver,
    sum_converted_pnl_for_queryset,
)


class PnlPreferenceMixin:
    """Fournit get_pnl_field() aligné sur UserPreferences.pnl_display."""

    def get_pnl_field(self) -> str:
        return get_trade_pnl_field(self.request.user)
from .account_balance import (
    build_dashboard_balance_context,
    compute_trading_account_balance,
    resolve_account_balance,
    resolve_peak_balance_only,
    resolve_topstep_consistency,
)
from .pagination import AccountTransactionPagination
from daily_journal.models import DailyJournalEntry
from .market_holidays import MarketHolidaysService
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
from .statistics_temporal import (
    compute_avg_daily_exposure_time,
    compute_avg_time_between_trades,
)
from .risk_metrics import (
    compute_sharpe_annualized_from_trades,
    compute_sharpe_per_trade,
)
from .compliance_streaks import (
    compute_dashboard_next_badge,
    compute_strategy_compliance_context,
    get_position_strategy_family_ids,
)
from billing.permissions import IsPremiumBundleSubscriberOrAdmin




class TradingAccountViewSet(PnlPreferenceMixin, viewsets.ModelViewSet):
    """
    ViewSet pour gérer les comptes de trading.
    """
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None  # Désactiver la pagination - un utilisateur a rarement plus de 10-20 comptes
    
    def get_serializer_class(self):  # type: ignore
        if self.action == 'list':
            return TradingAccountListSerializer
        return TradingAccountSerializer
    
    def get_queryset(self):
        """Retourne uniquement les comptes de l'utilisateur connecté."""
        if not self.request.user.is_authenticated:
            return TradingAccount.objects.none()  # type: ignore
        
        queryset = TradingAccount.objects.filter(user=self.request.user).select_related(  # type: ignore
            'copy_imports_from',
        ).prefetch_related('accounts_that_copy_me')
        
        # Pour les opérations de détail (retrieve, update, delete), inclure les archivés
        # Pour la liste, exclure les archivés sauf si explicitement demandé
        if self.action == 'list':
            include_archived = self.request.query_params.get('include_archived', 'false').lower() == 'true'
            if not include_archived:
                queryset = queryset.exclude(status='archived')
        
        return queryset
    
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

    @action(detail=True, methods=['post'], url_path='sync')
    def sync(self, request, pk=None):
        """Synchronise les trades fermés TopStepX (insert-only, sans écrasement)."""
        from trades.sync.topstepx_sync import TopStepXSyncService
        from trades.throttling import TradeSyncThrottle

        throttle = TradeSyncThrottle()
        if not throttle.allow_request(request, self):
            return Response(
                {'error': 'Trop de synchronisations. Réessayez dans une minute.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        account = self.get_object()
        full_resync = bool(request.data.get('full_resync', False))
        try:
            result = TopStepXSyncService().sync_account(
                request.user,
                account,
                full_resync=full_resync,
            )
            status_payload = TopStepXSyncService().get_sync_status(account)
            payload = {
                'message': 'Synchronisation terminée.',
                'created': result.created,
                'skipped': result.skipped,
                'total_fetched': result.total_fetched,
                'last_sync_at': result.last_sync_at.isoformat(),
                'errors': result.errors,
                'status': status_payload,
            }
            if result.replay is not None:
                payload['replay'] = {
                    'built': result.replay.built,
                    'failed': result.replay.failed,
                    'skipped_cap': result.replay.skipped_cap,
                    'built_dates': result.replay.built_dates,
                    'failed_dates': result.replay.failed_dates,
                }
            return Response(payload)
        except ValueError as exc:
            payload: dict = {'error': str(exc)}
            error_code = getattr(exc, 'error_code', None)
            if error_code:
                payload['error_code'] = error_code
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            logger.exception('Erreur sync TopStepX compte %s', pk)
            return Response(
                {'error': 'Erreur lors de la synchronisation.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=['get'], url_path='sync-status')
    def sync_status(self, request, pk=None):
        from trades.sync.topstepx_sync import TopStepXSyncService

        account = self.get_object()
        return Response(TopStepXSyncService().get_sync_status(account))

    @action(detail=False, methods=['post'], url_path='repair-topstep-broker-ids')
    def repair_topstep_broker_ids(self, request):
        """Aligne broker_account_id sur le nom TopStepX (API Account/search)."""
        from integrations.topstepx_auth import get_topstepx_integration, get_valid_session_token
        from integrations.topstepx_accounts import repair_topstep_broker_account_ids
        from integrations.topstepx_client import TopStepXApiClient, TopStepXApiError

        integration = get_topstepx_integration(request.user)
        if integration is None or not integration.secrets_encrypted:
            return Response(
                {'error': 'Configurez l\'intégration TopStepX dans les paramètres.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = get_valid_session_token(integration)
        except TopStepXApiError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        accounts = list(
            self.get_queryset().filter(account_type='topstep', status='active')
        )
        try:
            repaired = repair_topstep_broker_account_ids(
                TopStepXApiClient(),
                token,
                accounts,
            )
        except TopStepXApiError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'repaired_count': len(repaired),
            'repaired': repaired,
        })
    
    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        """
        Archive un compte de trading.
        Un compte archivé ne peut plus être le compte par défaut.
        """
        try:
            account = self.get_object()
            
            # Si c'était le compte par défaut, en sélectionner un autre
            if account.is_default:
                # Trouver un autre compte actif pour le définir par défaut
                next_default = TradingAccount.objects.filter(  # type: ignore
                    user=request.user,
                    status='active'
                ).exclude(pk=account.pk).order_by('created_at').first()
                
                if next_default:
                    next_default.is_default = True
                    next_default.save(update_fields=['is_default'])
            
            # Archiver le compte
            account.status = 'archived'
            account.is_default = False
            account.save(update_fields=['status', 'is_default'])
            
            serializer = self.get_serializer(account)
            return Response(serializer.data)
        except Exception as e:
            return Response(
                {'error': f'Erreur lors de l\'archivage du compte: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def unarchive(self, request, pk=None):
        """
        Désarchive un compte de trading (le repasse en actif).
        """
        try:
            account = self.get_object()
            account.status = 'active'
            account.save(update_fields=['status'])
            
            serializer = self.get_serializer(account)
            return Response(serializer.data)
        except Exception as e:
            return Response(
                {'error': f'Erreur lors de la désarchivage du compte: {str(e)}'}, 
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
            
            pf = self.get_pnl_field()
            # Calcul des statistiques de base
            total_trades = trades.count()
            winning_trades = trades.filter(**{f'{pf}__gt': 0}).count()
            losing_trades = trades.filter(**{f'{pf}__lt': 0}).count()
            win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0
            
            total_pnl = trades.aggregate(total=Sum(pf))['total'] or Decimal('0')
            total_gains = trades.filter(**{f'{pf}__gt': 0}).aggregate(total=Sum(pf))['total'] or Decimal('0')
            total_losses = trades.filter(**{f'{pf}__lt': 0}).aggregate(total=Sum(pf))['total'] or Decimal('0')
            
            # Meilleur trade : le plus gros gain parmi les trades gagnants uniquement
            # Si aucun trade gagnant, best_trade = 0 (ne pas afficher)
            best_trade = trades.filter(**{f'{pf}__gt': 0}).aggregate(best=Max(pf))['best']
            if best_trade is None:
                best_trade = Decimal('0')
            
            # Pire trade : le plus gros loss parmi les trades perdants uniquement
            # Si aucun trade perdant, worst_trade = 0 (ne pas afficher)
            worst_trade = trades.filter(**{f'{pf}__lt': 0}).aggregate(worst=Min(pf))['worst']
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
    pagination_class = AccountTransactionPagination

    def _filtered_account_transactions(self, *, apply_transaction_type: bool) -> Any:
        """Queryset filtré (sans tri ni select_related) pour list ou agrégations stats."""
        if not self.request.user.is_authenticated:
            return AccountTransaction.objects.none()  # type: ignore

        queryset = AccountTransaction.objects.filter(user=self.request.user)  # type: ignore

        trading_account_id = self.request.query_params.get('trading_account', None)
        if trading_account_id:
            queryset = queryset.filter(trading_account_id=trading_account_id)

        if apply_transaction_type:
            transaction_type = self.request.query_params.get('transaction_type', None)
            if transaction_type:
                queryset = queryset.filter(transaction_type=transaction_type)

        user_tz = get_user_timezone(self.request)
        tz_override = (self.request.query_params.get('timezone') or '').strip()
        if tz_override:
            try:
                user_tz = pytz.timezone(tz_override)
            except pytz.exceptions.UnknownTimeZoneError:
                pass

        start_date = self.request.query_params.get('start_date', None)
        if start_date and isinstance(start_date, str):
            start_date_str: str = start_date
            try:
                start_dt_naive = datetime.strptime(start_date_str, '%Y-%m-%d')
                start_dt = user_tz.localize(start_dt_naive)
                queryset = queryset.filter(transaction_date__gte=start_dt)
            except ValueError:
                pass

        end_date = self.request.query_params.get('end_date', None)
        if end_date and isinstance(end_date, str):
            end_date_str: str = end_date
            try:
                end_dt_naive = datetime.strptime(end_date_str, '%Y-%m-%d')
                end_dt = user_tz.localize(end_dt_naive.replace(hour=23, minute=59, second=59))
                queryset = queryset.filter(transaction_date__lte=end_dt)
            except ValueError:
                pass

        q = (self.request.query_params.get('q') or '').strip()
        if q:
            queryset = queryset.filter(
                Q(description__icontains=q) | Q(trading_account__name__icontains=q)
            )

        return queryset

    def get_queryset(self):
        """Retourne uniquement les transactions de l'utilisateur connecté."""
        return (
            self._filtered_account_transactions(apply_transaction_type=True)
            .select_related('trading_account', 'user')
            .order_by('-transaction_date', '-created_at')
        )

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        """
        Totaux et comptages sur les filtres compte / dates / recherche (sans filtre type),
        pour badges et cartes KPI lorsque la liste est paginée.
        """
        qs = self._filtered_account_transactions(apply_transaction_type=False)
        agg = qs.aggregate(
            total=Count('id'),
            deposits_count=Count('id', filter=Q(transaction_type='deposit')),
            withdrawals_count=Count('id', filter=Q(transaction_type='withdrawal')),
        )
        dep_sum = qs.filter(transaction_type='deposit').aggregate(s=Sum('amount'))['s']
        wit_sum = qs.filter(transaction_type='withdrawal').aggregate(s=Sum('amount'))['s']
        dep_dec = dep_sum if dep_sum is not None else Decimal('0')
        wit_dec = wit_sum if wit_sum is not None else Decimal('0')
        net_flow = dep_dec - wit_dec
        return Response(
            {
                'total': agg['total'] or 0,
                'deposits_count': agg['deposits_count'] or 0,
                'withdrawals_count': agg['withdrawals_count'] or 0,
                'total_deposits': str(dep_dec),
                'total_withdrawals': str(wit_dec),
                'net_flow': str(net_flow),
            }
        )
    
    def perform_create(self, serializer):
        """Associe automatiquement la transaction à l'utilisateur connecté."""
        transaction = serializer.save(user=self.request.user)
        self._refresh_withdrawal_goals(
            user=self.request.user,
            trading_account_id=transaction.trading_account_id
        )

    def perform_update(self, serializer):
        """
        Met à jour une transaction puis recalcule les objectifs de retraits impactés.
        """
        previous = self.get_object()
        previous_account_id = previous.trading_account_id

        transaction = serializer.save()
        updated_account_id = transaction.trading_account_id

        impacted_account_ids = {previous_account_id, updated_account_id}
        for account_id in impacted_account_ids:
            if account_id is None:
                continue
            self._refresh_withdrawal_goals(
                user=self.request.user,
                trading_account_id=account_id
            )

    def perform_destroy(self, instance):
        """
        Supprime une transaction puis recalcule les objectifs de retraits impactés.
        """
        trading_account_id = instance.trading_account_id
        instance.delete()
        self._refresh_withdrawal_goals(
            user=self.request.user,
            trading_account_id=trading_account_id
        )

    def _refresh_withdrawal_goals(self, user, trading_account_id=None):
        """
        Recalcule les objectifs de retraits non annulés:
        - objectifs globaux (sans compte),
        - objectifs liés au compte impacté.
        """
        goals_qs = TradingGoal.objects.filter(  # type: ignore
            user=user,
            goal_type='withdrawal_amount'
        ).exclude(status='cancelled')

        if trading_account_id is not None:
            goals_qs = goals_qs.filter(
                Q(trading_account__isnull=True) | Q(trading_account_id=trading_account_id)
            )

        for goal in goals_qs:
            goal.update_progress()
    
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
        
        include_peak_param = request.query_params.get('include_peak', 'true')
        include_peak = str(include_peak_param).lower() not in ('0', 'false', 'no')

        bal = resolve_account_balance(account, include_peak=include_peak)
        initial_capital = bal['initial_capital']
        total_pnl = bal['total_pnl']
        total_pnl_gross = bal['total_pnl_gross']
        trading_equity = bal['trading_equity']
        trading_equity_gross = bal['trading_equity_gross']
        total_deposits = bal['total_deposits']
        total_withdrawals = bal['total_withdrawals']
        net_transactions = bal['net_transactions']
        current_balance = bal['current_balance']
        current_balance_gross = bal['current_balance_gross']

        response_data = {
            'trading_account_id': account.id,
            'trading_account_name': account.name,
            'initial_capital': str(initial_capital),
            'total_pnl': str(total_pnl),
            'total_pnl_gross': str(total_pnl_gross),
            'trading_equity': str(trading_equity),
            'trading_equity_gross': str(trading_equity_gross),
            'total_deposits': str(total_deposits),
            'total_withdrawals': str(total_withdrawals),
            'net_transactions': str(net_transactions),
            'current_balance': str(current_balance),
            'current_balance_gross': str(current_balance_gross),
            'currency': account.currency,
        }
        if include_peak:
            response_data['peak_balance'] = str(bal['peak_balance'])
            response_data['peak_balance_gross'] = str(bal['peak_balance_gross'])

        return Response(response_data)

    @action(detail=False, methods=['get'], url_path='balance/peak')
    def balance_peak(self, request):
        """Retourne uniquement le pic de solde (sans recalculer les agrégats de solde actuel)."""
        trading_account_id = request.query_params.get('trading_account', None)
        if not trading_account_id:
            return Response(
                {'error': 'Le paramètre trading_account est requis'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            account = TradingAccount.objects.get(id=trading_account_id, user=request.user)  # type: ignore
        except TradingAccount.DoesNotExist:  # type: ignore
            return Response(
                {'error': 'Compte de trading non trouvé'},
                status=status.HTTP_404_NOT_FOUND,
            )

        peaks = resolve_peak_balance_only(account)
        return Response({
            'trading_account_id': account.id,
            'peak_balance': str(peaks['peak_balance']),
            'peak_balance_gross': str(peaks['peak_balance_gross']),
        })

    @action(detail=False, methods=['get'], url_path='balance/consistency')
    def balance_consistency(self, request):
        """Meilleur jour all-time TopStep pour le consistency target."""
        trading_account_id = request.query_params.get('trading_account', None)
        if not trading_account_id:
            return Response(
                {'error': 'Le paramètre trading_account est requis'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            account = TradingAccount.objects.get(id=trading_account_id, user=request.user)  # type: ignore
        except TradingAccount.DoesNotExist:  # type: ignore
            return Response(
                {'error': 'Compte de trading non trouvé'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if account.account_type != 'topstep':
            return Response({'consistency': None})

        data = resolve_topstep_consistency(account)
        if not data:
            return Response({'consistency': None})

        best_day = data['best_day']
        return Response({
            'consistency': {
                'best_day': best_day.isoformat() if hasattr(best_day, 'isoformat') else str(best_day),
                'best_day_pnl_net': str(data['best_day_pnl_net']),
                'best_day_pnl_gross': str(data['best_day_pnl_gross']),
            },
        })


class TopStepTradeViewSet(PnlPreferenceMixin, viewsets.ModelViewSet):
    """
    ViewSet pour gérer les trades TopStep.
    """
    permission_classes = [permissions.IsAuthenticated]
    premium_restricted_actions = {'statistics', 'analytics'}

    def get_permissions(self):
        base_permissions = [permissions.IsAuthenticated()]
        if self.action in self.premium_restricted_actions:
            base_permissions.append(IsPremiumBundleSubscriberOrAdmin())
        return base_permissions
    
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
            .select_related('trading_account', 'user', 'position_strategy')
            .order_by('-entered_at')
        )
        
        # Filtre par compte de trading (uniquement si fourni)
        trading_account_id = self.request.query_params.get('trading_account', None)
        if trading_account_id:
            queryset = queryset.filter(trading_account_id=trading_account_id)
        
        # Filtres optionnels
        contracts = parse_contract_query_params(self.request.query_params)
        trade_type = self.request.query_params.get('type', None)
        start_date = self.request.query_params.get('start_date', None)
        end_date = self.request.query_params.get('end_date', None)
        profitable = self.request.query_params.get('profitable', None)
        trade_day = self.request.query_params.get('trade_day', None)
        has_strategy = self.request.query_params.get('has_strategy', None)
        position_strategy_id = self.request.query_params.get('position_strategy', None)
        
        if contracts:
            queryset = queryset.filter(contract_name__in=contracts)
        if trade_type:
            queryset = queryset.filter(trade_type=trade_type)
        if has_strategy is not None:
            if has_strategy.lower() == 'true':  # type: ignore
                queryset = queryset.filter(position_strategy__isnull=False)
            elif has_strategy.lower() == 'false':  # type: ignore
                queryset = queryset.filter(position_strategy__isnull=True)
        if position_strategy_id:
            try:
                position_strategy_id = int(position_strategy_id)
                family_ids = get_position_strategy_family_ids(self.request.user, position_strategy_id)
                queryset = queryset.filter(position_strategy_id__in=family_ids)
            except (ValueError, TypeError):
                pass  # Ignorer les IDs invalides
        if start_date:
            # Convertir la date de début en datetime timezone-aware
            try:
                start_datetime = datetime.strptime(start_date, '%Y-%m-%d')  # type: ignore
                # Utiliser le timezone de l'utilisateur
                user_tz = get_user_timezone(self.request)
                start_datetime = user_tz.localize(start_datetime)
                queryset = queryset.filter(entered_at__gte=start_datetime)
            except ValueError:
                pass  # Ignorer les dates mal formatées
        
        if end_date:
            # Convertir la date de fin en datetime timezone-aware
            try:
                end_datetime = datetime.strptime(end_date, '%Y-%m-%d')  # type: ignore
                # Utiliser le timezone de l'utilisateur pour la date de fin (23:59:59)
                user_tz = get_user_timezone(self.request)
                end_datetime = user_tz.localize(end_datetime.replace(hour=23, minute=59, second=59))
                queryset = queryset.filter(entered_at__lte=end_datetime)
            except ValueError:
                pass  # Ignorer les dates mal formatées
        if profitable is not None:
            pf = self.get_pnl_field()
            if profitable.lower() == 'true':  # type: ignore
                queryset = queryset.filter(**{f'{pf}__gt': 0})
            elif profitable.lower() == 'false':  # type: ignore
                queryset = queryset.filter(**{f'{pf}__lt': 0})
        
        if trade_day:
            # Filtrer par date de trade spécifique
            try:
                from datetime import date
                trade_date = date.fromisoformat(trade_day)  # type: ignore
                queryset = queryset.filter(trade_day=trade_date)
            except ValueError:
                pass  # Ignorer les dates mal formatées
        
        return queryset.order_by('-entered_at')

    def perform_create(self, serializer):
        """Crée un trade puis recalcule les objectifs dépendants des trades."""
        serializer.save()
        refresh_goals_for_user(self.request.user, TRADE_DRIVEN_GOAL_TYPES)

    def perform_update(self, serializer):
        """Met à jour un trade puis recalcule les objectifs dépendants des trades."""
        serializer.save()
        refresh_goals_for_user(self.request.user, TRADE_DRIVEN_GOAL_TYPES)

    def perform_destroy(self, instance):
        """Supprime un trade puis recalcule les objectifs dépendants des trades."""
        instance.delete()
        refresh_goals_for_user(self.request.user, TRADE_DRIVEN_GOAL_TYPES)
    
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
        refresh_goals_for_user(request.user, TRADE_DRIVEN_GOAL_TYPES)
        
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
        from .stats_response_cache import (
            extract_viewset_cache_params,
            get_cached_stats_response,
            set_cached_stats_response,
        )

        cache_params = extract_viewset_cache_params(request)
        cached = get_cached_stats_response(request.user.id, 'statistics', cache_params)
        if cached is not None:
            return Response(cached)

        from .services.statistics_calculator import (
            EMPTY_STATISTICS_PAYLOAD,
            compute_statistics_payload,
        )

        trades = self.get_queryset()
        pf = self.get_pnl_field()
        if not trades.exists():
            empty_payload = EMPTY_STATISTICS_PAYLOAD.copy()
            set_cached_stats_response(request.user.id, 'statistics', cache_params, empty_payload)
            return Response(empty_payload)

        payload = compute_statistics_payload(request, trades, pf)
        set_cached_stats_response(request.user.id, 'statistics', cache_params, payload)
        return Response(payload)

    @action(detail=False, methods=['get'], url_path='statistics-legacy-inline')
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
        trading_account_id = request.query_params.get('trading_account')
        trades = TopStepTrade.objects.filter(user=request.user)  # type: ignore
        if trading_account_id:
            try:
                trades = trades.filter(trading_account_id=int(trading_account_id))
            except (ValueError, TypeError):
                pass
        instruments = (
            trades
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
        
        pf = self.get_pnl_field()
        # Séparer les trades gagnants et perdants
        winning_trades = trades.filter(**{f'{pf}__gt': 0})
        losing_trades = trades.filter(**{f'{pf}__lt': 0})
        
        # Calcul du Risk Reward Ratio
        risk_reward_ratio = 0.0
        if winning_trades.exists() and losing_trades.exists():
            avg_win = winning_trades.aggregate(avg=Avg(pf))['avg']
            avg_loss = abs(losing_trades.aggregate(avg=Avg(pf))['avg'])
            if avg_loss > 0:
                risk_reward_ratio = float(avg_win / avg_loss)
        
        # Calcul du Profit Factor
        profit_factor = 0.0
        total_profits = winning_trades.aggregate(total=Sum(pf))['total'] or Decimal('0')
        total_losses = abs(losing_trades.aggregate(total=Sum(pf))['total'] or Decimal('0'))
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
                cumulative_capital += trade_pnl_as_decimal(trade, pf)
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
            total_pnl = trades.aggregate(total=Sum(pf))['total'] or Decimal('0')
            # Calculer le drawdown en valeur absolue (pas en pourcentage)
            if trades.exists():
                trades_ordered = trades.order_by('entered_at')
                cumulative_capital = Decimal('0')
                peak_capital = Decimal('0')
                max_dd_absolute = Decimal('0')
                
                for trade in trades_ordered:
                    cumulative_capital += trade_pnl_as_decimal(trade, pf)
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
            total_pnl = trades.aggregate(total=Sum(pf))['total'] or Decimal('0')
            expectancy = float(total_pnl / total_trades)
        
        # Calcul du Sharpe Ratio (simplifié)
        sharpe_ratio = 0.0
        if total_trades > 1:
            # Calculer la volatilité des rendements
            pnl_values = list(trades.values_list(pf, flat=True))
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
        
        # Journalisation minimale (évite données sensibles / PII dans les logs)
        logger.info(
            "upload_csv: début (nb_fichiers=%s, nb_champs_formulaire=%s)",
            len(request.FILES),
            len(request.data),
        )
        
        serializer = CSVUploadSerializer(data=request.data)
        
        if not serializer.is_valid():
            logger.error(f"Validation serializer échouée: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        csv_file = serializer.validated_data.get('file')  # type: ignore
        if not csv_file:
            return Response({'error': 'Fichier CSV requis'}, status=status.HTTP_400_BAD_REQUEST)
        logger.info("upload_csv: fichier validé (%s octets)", getattr(csv_file, 'size', 0))
        
        try:
            # Lire le contenu du fichier et supprimer le BOM si présent
            content = csv_file.read().decode('utf-8-sig')  # utf-8-sig supprime automatiquement le BOM
            logger.info("upload_csv: contenu décodé (%d caractères)", len(content))
            
            # Utiliser l'utilisateur connecté
            user = request.user
            logger.info("upload_csv: utilisateur id=%s", user.pk)
            
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
            duplicate_to_copy = request.data.get('duplicate_to_copy_accounts', 'true')
            duplicate_to_copy = str(duplicate_to_copy).lower() not in ('false', '0', 'no')

            target_accounts = [trading_account]
            if duplicate_to_copy:
                followers = (
                    TradingAccount.objects.filter(  # type: ignore
                        user=user,
                        copy_imports_from=trading_account,
                        status='active',
                    )
                    .exclude(pk=trading_account.pk)
                    .order_by('name')
                )
                target_accounts = [trading_account] + list(followers)

            # Importer via l'utilitaire (plusieurs comptes si copieurs configurés)
            importer = TopStepCSVImporter(user, target_accounts=target_accounts)
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
                if not dry_run and result.get('success_count', 0) > 0:
                    refresh_goals_for_user(request.user, TRADE_DRIVEN_GOAL_TYPES)

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
                if 'copy_accounts_count' in result:
                    response_data['copy_accounts_count'] = result['copy_accounts_count']
                
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

    @action(detail=False, methods=['post'])
    def bulk_assign_strategy(self, request):
        """
        Assigne une stratégie de position à plusieurs trades en une seule requête.
        """
        trade_ids = request.data.get('trade_ids', [])
        position_strategy_id = request.data.get('position_strategy_id')
        
        if not isinstance(trade_ids, list) or len(trade_ids) == 0:
            return Response({
                'error': 'Le paramètre trade_ids doit être une liste non vide'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Vérifier que la stratégie existe et appartient à l'utilisateur (si fournie)
        position_strategy = None
        if position_strategy_id is not None:
            try:
                position_strategy = PositionStrategy.objects.get(  # type: ignore
                    id=position_strategy_id,
                    user=request.user
                )
            except PositionStrategy.DoesNotExist:  # type: ignore
                return Response({
                    'error': 'Stratégie invalide ou non trouvée'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        # Récupérer les trades de l'utilisateur avec les IDs fournis
        trades = TopStepTrade.objects.filter(  # type: ignore
            id__in=trade_ids,
            user=request.user
        )
        
        if not trades.exists():
            return Response({
                'error': 'Aucun trade trouvé avec les IDs fournis'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Mettre à jour les trades
        updated_count = trades.update(position_strategy=position_strategy)
        
        return Response({
            'success': True,
            'updated_count': updated_count,
            'message': f'{updated_count} trade(s) mis à jour'
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def capital_evolution(self, request):
        """
        Retourne les données pour le graphique d'évolution du capital par jour.
        """
        trades = self.get_queryset()
        
        if not trades.exists():
            return Response([])
        
        pf = self.get_pnl_field()
        # Utiliser le timezone de l'utilisateur
        user_tz = get_user_timezone(request)
        # Agréger les PnL par jour
        pnl_by_day = defaultdict(float)
        for trade in trades:
            date = trade.entered_at.astimezone(user_tz).date()
            pnl_by_day[date] += trade_pnl_as_float(trade, pf)
        
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
        
        pf = self.get_pnl_field()
        # Agréger les données par jour de la semaine
        weekday_stats = defaultdict(lambda: {
            'total_pnl': 0.0,
            'trade_count': 0,
            'winning_trades': 0
        })
        
        for trade in trades:
            weekday = trade.entered_at.strftime('%A')
            pnl = trade_pnl_as_float(trade, pf)
            
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
        pf = get_trade_pnl_field_for_request(request.user, request)

        # Récupérer les paramètres de date
        year = request.query_params.get('year')
        month = request.query_params.get('month')

        # Utiliser le timezone de l'utilisateur
        user_tz = get_user_timezone(request)

        if not year or not month:
            # Utiliser le mois courant par défaut dans le timezone utilisateur
            now = timezone.now().astimezone(user_tz)
            year = now.year
            month = now.month
        else:
            year = int(year)
            month = int(month)

        # Filtrer les trades du mois spécifié dans le timezone utilisateur
        start_date = user_tz.localize(datetime(year, month, 1))
        if month == 12:
            end_date = user_tz.localize(datetime(year + 1, 1, 1))
        else:
            end_date = user_tz.localize(datetime(year, month + 1, 1))
        
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
                trading_account_id = None

        # Récupérer les entrées de journal pour le mois
        journal_entries = DailyJournalEntry.objects.filter(
            user=request.user,
            date__gte=start_date.date(),
            date__lt=end_date.date()
        )
        if trading_account_id:
            journal_entries = journal_entries.filter(trading_account_id=trading_account_id)
        journal_entries_by_day = {entry.date.day: entry.id for entry in journal_entries}

        month_transactions = AccountTransaction.objects.filter(
            user=request.user,
            transaction_date__gte=start_date,
            transaction_date__lt=end_date,
        )
        if trading_account_id:
            month_transactions = month_transactions.filter(trading_account_id=trading_account_id)

        transactions_by_day = defaultdict(
            lambda: {
                'deposit_count': 0,
                'withdrawal_count': 0,
                'deposit_total': Decimal('0'),
                'withdrawal_total': Decimal('0'),
            }
        )
        for tx in month_transactions:
            day = tx.transaction_date.astimezone(user_tz).day
            bucket = transactions_by_day[day]
            if tx.transaction_type == 'deposit':
                bucket['deposit_count'] += 1
                bucket['deposit_total'] += tx.amount
            elif tx.transaction_type == 'withdrawal':
                bucket['withdrawal_count'] += 1
                bucket['withdrawal_total'] += tx.amount

        def _tx_fields_for_day(day: int) -> dict:
            tx_day = transactions_by_day.get(day, {})
            dep_count = tx_day.get('deposit_count', 0)
            wit_count = tx_day.get('withdrawal_count', 0)
            dep_total = tx_day.get('deposit_total', Decimal('0'))
            wit_total = tx_day.get('withdrawal_total', Decimal('0'))
            return {
                'has_deposit': dep_count > 0,
                'has_withdrawal': wit_count > 0,
                'deposit_count': dep_count,
                'withdrawal_count': wit_count,
                'deposit_total': str(dep_total),
                'withdrawal_total': str(wit_total),
            }
        
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
                daily_data[day]['pnl'] += trade_pnl_as_float(trade, pf)
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
                    'strategy_compliance_status': compliance_status,
                    'has_journal_entry': day in journal_entries_by_day,
                    'journal_entry_id': journal_entries_by_day.get(day),
                    **_tx_fields_for_day(day),
                })
            else:
                # Jour sans trade - vérifier s'il y a une compliance
                compliance_status = compliances_by_day.get(day, None)
                daily_result.append({
                    'date': str(day),
                    'pnl': 0.0,
                    'trade_count': 0,
                    'strategy_compliance_status': compliance_status,
                    'has_journal_entry': day in journal_entries_by_day,
                    'journal_entry_id': journal_entries_by_day.get(day),
                    **_tx_fields_for_day(day),
                })
        
        # Agréger par semaine (vraies semaines du calendrier - dimanche à samedi)
        weekly_data = defaultdict(lambda: {'pnl': 0.0, 'trade_count': 0})
        
        # Calculer le premier jour du mois et son jour de la semaine
        first_day = start_date.astimezone(user_tz).date()
        first_weekday = first_day.weekday()  # 0 = Lundi, 6 = Dimanche
        
        for trade in month_trades:
            # Convertir au timezone utilisateur avant d'extraire la date
            trade_date = trade.entered_at.astimezone(user_tz).date()
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
            
            weekly_data[week_number]['pnl'] += trade_pnl_as_float(trade, pf)
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
        monthly_total = sum(trade_pnl_as_float(trade, pf) for trade in month_trades)
        
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
        pf = get_trade_pnl_field_for_request(request.user, request)
        
        if not trades.exists():
            return Response({
                'monthly_data': [],
                'yearly_total': 0
            })
        
        # Récupérer le paramètre d'année
        year = request.query_params.get('year')
        
        # Utiliser le timezone de l'utilisateur
        user_tz = get_user_timezone(request)
        
        if not year:
            # Utiliser l'année courante par défaut dans le timezone utilisateur
            now = timezone.now().astimezone(user_tz)
            year = now.year
        else:
            year = int(year)
        
        # Filtrer les trades de l'année spécifiée dans le timezone utilisateur
        start_date = user_tz.localize(datetime(year, 1, 1))
        end_date = user_tz.localize(datetime(year + 1, 1, 1))
        
        year_trades = trades.filter(
            entered_at__gte=start_date,
            entered_at__lt=end_date
        )
        
        # Agréger par mois
        monthly_data = defaultdict(lambda: {'pnl': 0.0, 'trade_count': 0})
        for trade in year_trades:
            # Convertir au timezone utilisateur avant d'extraire le mois
            month = trade.entered_at.astimezone(user_tz).month
            monthly_data[month]['pnl'] += trade_pnl_as_float(trade, pf)
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
        yearly_total = sum(trade_pnl_as_float(trade, pf) for trade in year_trades)
        
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
        pf = get_trade_pnl_field_for_request(request.user, request)
        
        if not trades.exists():
            return Response({
                'weekly_data': [],
                'yearly_total': 0
            })
        
        # Récupérer le paramètre d'année
        year = request.query_params.get('year')
        
        # Utiliser le timezone de l'utilisateur
        user_tz = get_user_timezone(request)
        
        if not year:
            # Utiliser l'année courante par défaut dans le timezone utilisateur
            now = timezone.now().astimezone(user_tz)
            year = now.year
        else:
            year = int(year)
        
        # Filtrer les trades de l'année spécifiée dans le timezone utilisateur
        start_date = user_tz.localize(datetime(year, 1, 1))
        end_date = user_tz.localize(datetime(year + 1, 1, 1))
        
        year_trades = trades.filter(
            entered_at__gte=start_date,
            entered_at__lt=end_date
        )
        
        # Agréger par semaine (samedi de chaque semaine)
        weekly_data = defaultdict(lambda: {'pnl': 0.0, 'trade_count': 0, 'saturday_date': None})
        
        # Trouver le premier dimanche de l'année (ou le 1er janvier s'il est dimanche)
        first_day = start_date.astimezone(user_tz).date()
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
            # Convertir au timezone utilisateur avant d'extraire la date
            trade_date = trade.entered_at.astimezone(user_tz).date()
            
            # Calculer le samedi de la semaine pour ce trade
            days_from_first_sunday = (trade_date - first_sunday).days
            week_number = days_from_first_sunday // 7
            saturday_date = first_sunday + timedelta(days=week_number * 7 + 6)
            
            # S'assurer que le samedi est dans l'année en cours
            if saturday_date.year == year or saturday_date.year == year + 1:
                week_key = saturday_date.isoformat()
                raw_pnl = getattr(trade, pf, None)
                if raw_pnl is None and pf == 'pnl':
                    raw_pnl = trade.net_pnl
                if raw_pnl is not None:
                    current_pnl = weekly_data[week_key]['pnl']
                    if current_pnl is None:
                        current_pnl = 0.0
                    weekly_data[week_key]['pnl'] = current_pnl + float(raw_pnl)
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
        yearly_total = sum(trade_pnl_as_float(trade, pf) for trade in year_trades)
        
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
        
        user_tz = get_user_timezone(request)

        if start_date:
            try:
                start_datetime = datetime.strptime(start_date, '%Y-%m-%d')
                start_datetime = user_tz.localize(start_datetime)
                queryset = queryset.filter(entered_at__gte=start_datetime)
            except ValueError:
                pass

        if end_date:
            try:
                end_datetime = datetime.strptime(end_date, '%Y-%m-%d')
                end_datetime = end_datetime.replace(hour=23, minute=59, second=59)
                end_datetime = user_tz.localize(end_datetime)
                queryset = queryset.filter(entered_at__lte=end_datetime)
            except ValueError:
                pass
        
        pf = get_trade_pnl_field(request.user)
        # Agréger par jour en utilisant SQL GROUP BY (beaucoup plus rapide)
        # Utiliser trade_day si disponible, sinon utiliser la date de entered_at
        from django.db.models import Q
        from django.db.models.functions import Coalesce
        
        # Utiliser trade_day si disponible, sinon extraire la date de entered_at
        # trade_day est un DateField, donc on peut l'utiliser directement
        # Alias day_pnl : évite collision si pf=='pnl' (Count FILTER + Q(pnl__gt) → SQL invalide)
        daily_aggregates = queryset.annotate(
            date=Coalesce(
                'trade_day',
                TruncDate('entered_at')
            )
        ).values('date').annotate(
            day_pnl=Sum(pf),
            trade_count=Count('id'),
            winning_count=Count('id', filter=Q(**{f'{pf}__gt': 0})),
            losing_count=Count('id', filter=Q(**{f'{pf}__lt': 0})),
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
                    'pnl': float(item['day_pnl'] or 0),
                    'trade_count': item['trade_count'],
                    'winning_count': item['winning_count'],
                    'losing_count': item['losing_count'],
                })
        
        return Response({
            'results': result,
            'count': len(result)
        })

    @action(detail=False, methods=['get'])
    def monte_carlo_inputs(self, request):
        """
        Exposition historique (médiane size × point_value) pour ajuster μ/σ Monte Carlo.
        All-time sur le compte sélectionné, sans filtre période.
        """
        from trades.services.monte_carlo_inputs import compute_monte_carlo_exposure_inputs

        trading_account_id = request.query_params.get('trading_account', None)
        queryset = TopStepTrade.objects.filter(user=request.user)  # type: ignore

        if trading_account_id:
            queryset = queryset.filter(trading_account_id=trading_account_id)

        payload = compute_monte_carlo_exposure_inputs(queryset)
        return Response(payload)

    @action(detail=False, methods=['get'])
    def analytics(self, request):
        """
        Retourne les analyses détaillées avec toutes les métriques avancées.
        """
        from .stats_response_cache import (
            extract_viewset_cache_params,
            get_cached_stats_response,
            set_cached_stats_response,
        )

        cache_params = extract_viewset_cache_params(request)
        cached = get_cached_stats_response(request.user.id, 'analytics', cache_params)
        if cached is not None:
            return Response(cached)

        from .services.analytics_calculator import (
            EMPTY_ANALYTICS_PAYLOAD,
            compute_analytics_payload,
        )

        trades = self.get_queryset()
        pf = self.get_pnl_field()
        if not trades.exists():
            import copy
            empty_payload = copy.deepcopy(EMPTY_ANALYTICS_PAYLOAD)
            set_cached_stats_response(request.user.id, 'analytics', cache_params, empty_payload)
            return Response(empty_payload)

        payload = compute_analytics_payload(request, trades, pf)
        set_cached_stats_response(request.user.id, 'analytics', cache_params, payload)
        return Response(payload)

    def hourly_performance(self, request):
        """
        Retourne les performances par tranche de 30 minutes de la journée.
        """
        trades = self.get_queryset()
        
        if not trades.exists():
            return Response({
                'hourly_data': [{'hour': i/2, 'pnl': 0.0, 'trade_count': 0} for i in range(48)]
            })

        pf = self.get_pnl_field()
        # Agréger par tranche de 30 minutes
        hourly_data = defaultdict(lambda: {'pnl': 0.0, 'trade_count': 0})
        
        for trade in trades:
            # Calculer la tranche de 30 minutes en heure locale
            local_time = trade.entered_at.astimezone()
            hour = local_time.hour
            minute = local_time.minute
            time_slot = hour + (0.5 if minute >= 30 else 0.0)
            
            hourly_data[time_slot]['pnl'] += trade_pnl_as_float(trade, pf)
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

        pf = self.get_pnl_field()
        # Agréger par jour
        # Utiliser le timezone de l'utilisateur
        user_tz = get_user_timezone(request)
        daily_data = defaultdict(lambda: {'pnl': 0.0, 'trade_count': 0})
        
        for trade in trades:
            date = trade.entered_at.astimezone(user_tz).date()
            daily_data[date]['pnl'] += trade_pnl_as_float(trade, pf)
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
        
        pf = get_trade_pnl_field(request.user)
        # Calculer le P/L cumulé et le drawdown
        cumulative_pnl = 0
        peak_pnl = 0
        drawdown_data = []
        
        # Utiliser le timezone de l'utilisateur
        user_tz = get_user_timezone(request)
        # Grouper par date
        daily_data = {}
        for trade in trades:
            date_str = trade.entered_at.astimezone(user_tz).date().isoformat()
            if date_str not in daily_data:
                daily_data[date_str] = {'pnl': 0, 'trades': 0}
            daily_data[date_str]['pnl'] += trade_pnl_as_float(trade, pf)
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


class TradeStrategyViewSet(PnlPreferenceMixin, viewsets.ModelViewSet):
    """
    ViewSet pour gérer les données de stratégie liées aux trades.
    """
    serializer_class = TradeStrategySerializer
    permission_classes = [permissions.IsAuthenticated, IsPremiumBundleSubscriberOrAdmin]
    
    
    def get_queryset(self):
        """Retourne uniquement les stratégies de l'utilisateur connecté."""
        if not self.request.user.is_authenticated:
            return TradeStrategy.objects.none()  # type: ignore
        
        # Optimisation des requêtes DB avec select_related/prefetch_related
        queryset = TradeStrategy.objects.filter(user=self.request.user)\
            .select_related('trade', 'trade__trading_account', 'trade__trading_account__currency')\
            .prefetch_related('dominant_emotions')\
            .only(
                'id', 'strategy_respected', 'tp1_reached', 'tp2_plus_reached',
                'session_rating', 'created_at', 'updated_at', 'emotion_details',
                'possible_improvements', 'gain_if_strategy_respected',
                'trade__id', 'trade__topstep_id', 'trade__contract_name', 'trade__trade_type',
                'trade__pnl', 'trade__net_pnl', 'trade__entered_at', 'trade__exited_at', 'trade__trade_day',
                'trade__trading_account__id', 'trade__trading_account__name',
                'trade__trading_account__currency__code', 'trade__trading_account__currency__symbol'
            )  # type: ignore
        
        # Filtres optionnels
        trade_id = self.request.query_params.get('trade_id', None)
        strategy_respected = self.request.query_params.get('strategy_respected', None)
        contract_name = self.request.query_params.get('contract_name', None)
        
        if trade_id:
            queryset = queryset.filter(trade__topstep_id=trade_id)
            ta_f = self.request.query_params.get('trading_account')
            if ta_f:
                queryset = queryset.filter(trade__trading_account_id=ta_f)
        if strategy_respected is not None:
            queryset = queryset.filter(strategy_respected=strategy_respected.lower() == 'true')  # type: ignore
        if contract_name:
            queryset = queryset.filter(trade__contract_name__icontains=contract_name)
        
        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        """Crée une stratégie puis recalcule les objectifs dépendants des stratégies."""
        serializer.save(user=self.request.user)
        refresh_goals_for_user(self.request.user, STRATEGY_DRIVEN_GOAL_TYPES)

    def perform_update(self, serializer):
        """Met à jour une stratégie puis recalcule les objectifs dépendants des stratégies."""
        serializer.save()
        refresh_goals_for_user(self.request.user, STRATEGY_DRIVEN_GOAL_TYPES)

    def perform_destroy(self, instance):
        """Supprime une stratégie puis recalcule les objectifs dépendants des stratégies."""
        instance.delete()
        refresh_goals_for_user(self.request.user, STRATEGY_DRIVEN_GOAL_TYPES)
    
    @action(detail=False, methods=['get'])
    def by_trade(self, request):
        """Récupère la stratégie pour un trade spécifique."""
        trade_id = request.query_params.get('trade_id')
        if not trade_id:
            return Response({'error': 'Paramètre trade_id requis'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # 🔒 SÉCURITÉ : Filtrer par utilisateur connecté
            strategy_qs = TradeStrategy.objects.filter(  # type: ignore
                user=self.request.user,
                trade__topstep_id=trade_id,
            )
            ta = request.query_params.get('trading_account')
            if ta:
                strategy_qs = strategy_qs.filter(trade__trading_account_id=ta)
            strategy = strategy_qs.order_by('-trade__id').first()
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
            ).select_related('trade', 'trade__trading_account')
            
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
            pf = get_trade_pnl_field(request.user)
            
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
                        'net_pnl': str(strategy.trade.net_pnl) if strategy.trade.net_pnl else '0',
                        'display_pnl': str(trade_pnl_as_decimal(strategy.trade, pf)),
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
    
    @staticmethod
    def _count_respected_days(strategies_qs, trades_qs, strategy_dates):
        """
        Compte les jours respectés/non respectés via agrégation SQL.
        Vérifie que tous les trades du jour ont une stratégie ET que tous sont respectés.
        
        Returns: (days_respected, days_not_respected)
        """
        if not strategy_dates:
            return 0, 0
        
        from django.db.models import Count, Q
        
        # 1 requête : compter trades par jour (tous les trades)
        trades_by_day = dict(
            trades_qs.filter(trade_day__in=list(strategy_dates))
            .values('trade_day')
            .annotate(total=Count('id'))
            .values_list('trade_day', 'total')
        )
        
        # 1 requête : compter stratégies par jour avec le nombre de non-respectées
        strategies_by_day = {
            row['trade__trade_day']: {
                'total': row['total'],
                'not_respected': row['not_respected'],
            }
            for row in strategies_qs.filter(trade__trade_day__in=list(strategy_dates))
            .values('trade__trade_day')
            .annotate(
                total=Count('id'),
                not_respected=Count('id', filter=Q(strategy_respected=False)),
            )
        }
        
        days_respected = 0
        days_not_respected = 0
        for trade_date in strategy_dates:
            trade_count = trades_by_day.get(trade_date, 0)
            strat_info = strategies_by_day.get(trade_date)
            if not strat_info:
                continue
            # Tous les trades ont une stratégie ?
            if trade_count == strat_info['total']:
                if strat_info['not_respected'] == 0:
                    days_respected += 1
                else:
                    days_not_respected += 1
        
        return days_respected, days_not_respected

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
        position_strategy_id = request.query_params.get('position_strategy')
        # Convertir en int si fourni
        if trading_account_id:
            try:
                trading_account_id = int(trading_account_id)
            except (ValueError, TypeError):
                trading_account_id = None
        if position_strategy_id:
            try:
                position_strategy_id = int(position_strategy_id)
            except (ValueError, TypeError):
                position_strategy_id = None
        
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
        
        tjf = get_trade_join_pnl_field_for_request(request.user, request)
        # Base queryset : stratégies de l'utilisateur dans la période
        queryset = TradeStrategy.objects.filter(  # type: ignore
            user=self.request.user,
            trade__trade_day__gte=start_date.strftime('%Y-%m-%d'),
            trade__trade_day__lt=end_date.strftime('%Y-%m-%d')
        ).select_related('trade')
        
        # Filtrer par compte si spécifié
        if trading_account_id:
            queryset = queryset.filter(trade__trading_account_id=trading_account_id)
        else:
            # Exclure les comptes archivés des stats globales
            queryset = queryset.exclude(trade__trading_account__status='archived')
        
        # Filtrer par stratégie de position si spécifié
        # Récupérer la famille de stratégies (toutes les versions)
        strategy_family_ids = None
        if position_strategy_id:
            strategy_family_ids = get_position_strategy_family_ids(self.request.user, position_strategy_id)
            queryset = queryset.filter(trade__position_strategy_id__in=strategy_family_ids)
        
        # Statistiques globales (toutes périodes et tous comptes)
        # Pour all_time : compter TOUS les trades de l'utilisateur (pas seulement ceux avec stratégie)
        # IMPORTANT: Toujours exclure les comptes archivés des stats all_time (tous comptes)
        all_time_trades_queryset = TopStepTrade.objects.filter(user=self.request.user).exclude(trading_account__status='archived')  # type: ignore
        all_time_strategies_queryset = TradeStrategy.objects.filter(user=self.request.user).exclude(trade__trading_account__status='archived')  # type: ignore
        
        # Appliquer le filtre position_strategy à tous les querysets
        if strategy_family_ids:
            all_time_trades_queryset = all_time_trades_queryset.filter(position_strategy_id__in=strategy_family_ids)
            all_time_strategies_queryset = all_time_strategies_queryset.filter(trade__position_strategy_id__in=strategy_family_ids)
        
        # Pour la période sélectionnée (tous comptes) : compter TOUS les trades de l'utilisateur pour la période
        # IMPORTANT: Toujours exclure les comptes archivés des stats period (tous comptes)
        period_trades_queryset = TopStepTrade.objects.filter(  # type: ignore
            user=self.request.user,
            trade_day__gte=start_date.strftime('%Y-%m-%d'),
            trade_day__lt=end_date.strftime('%Y-%m-%d')
        ).exclude(trading_account__status='archived')
        period_strategies_queryset = TradeStrategy.objects.filter(  # type: ignore
            user=self.request.user,
            trade__trade_day__gte=start_date.strftime('%Y-%m-%d'),
            trade__trade_day__lt=end_date.strftime('%Y-%m-%d')
        ).exclude(trade__trading_account__status='archived')
        
        if strategy_family_ids:
            period_trades_queryset = period_trades_queryset.filter(position_strategy_id__in=strategy_family_ids)
            period_strategies_queryset = period_strategies_queryset.filter(trade__position_strategy_id__in=strategy_family_ids)
        
        # Pour le compte : compter TOUS les trades du compte (toutes périodes, pas seulement la période sélectionnée)
        account_trades_queryset = TopStepTrade.objects.filter(user=self.request.user)  # type: ignore
        account_strategies_queryset = TradeStrategy.objects.filter(user=self.request.user)  # type: ignore
        if trading_account_id:
            account_trades_queryset = account_trades_queryset.filter(trading_account_id=trading_account_id)
            account_strategies_queryset = account_strategies_queryset.filter(trade__trading_account_id=trading_account_id)
        else:
            # Exclure les comptes archivés des stats globales
            account_trades_queryset = account_trades_queryset.exclude(trading_account__status='archived')
            account_strategies_queryset = account_strategies_queryset.exclude(trade__trading_account__status='archived')
        
        if strategy_family_ids:
            account_trades_queryset = account_trades_queryset.filter(position_strategy_id__in=strategy_family_ids)
            account_strategies_queryset = account_strategies_queryset.filter(trade__position_strategy_id__in=strategy_family_ids)
        
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
        else:
            # Exclure les comptes archivés des stats globales
            account_period_trades_queryset = account_period_trades_queryset.exclude(trading_account__status='archived')
            account_period_strategies_queryset = account_period_strategies_queryset.exclude(trade__trading_account__status='archived')
        
        if strategy_family_ids:
            account_period_trades_queryset = account_period_trades_queryset.filter(position_strategy_id__in=strategy_family_ids)
            account_period_strategies_queryset = account_period_strategies_queryset.filter(trade__position_strategy_id__in=strategy_family_ids)
        
        # Récupérer les compliances pour les jours sans trades
        # IMPORTANT: Exclure les compliances pour les jours qui ont des trades (pour éviter le double comptage)
        # Pour toutes périodes
        all_time_day_compliances_queryset = DayStrategyCompliance.objects.filter(  # type: ignore
            user=self.request.user
        ).exclude(strategy_respected__isnull=True)
        if trading_account_id:
            all_time_day_compliances_queryset = all_time_day_compliances_queryset.filter(trading_account_id=trading_account_id)
        else:
            # Exclure les comptes archivés des stats globales
            all_time_day_compliances_queryset = all_time_day_compliances_queryset.exclude(trading_account__status='archived')
        
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
        else:
            # Exclure les comptes archivés des stats globales
            period_day_compliances_queryset = period_day_compliances_queryset.exclude(trading_account__status='archived')
        
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
        # IMPORTANT: Toujours exclure les comptes archivés des stats all_time (tous comptes)
        all_time_all_day_compliances_queryset = DayStrategyCompliance.objects.filter(  # type: ignore
            user=self.request.user
        ).exclude(strategy_respected__isnull=True).exclude(trading_account__status='archived')
        
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
        
        # Compter les jours respectés via agrégation SQL
        account_days_respected, account_days_not_respected = self._count_respected_days(
            account_strategies_with_respect, account_trades_queryset, account_strategies_dates
        )
        
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
        
        # Compter les jours respectés pour la période du compte via agrégation SQL
        account_period_days_respected, account_period_days_not_respected = self._count_respected_days(
            account_period_with_respect, account_period_trades_queryset, account_period_strategies_dates
        )
        
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
        # IMPORTANT: Toujours exclure les comptes archivés des stats period (tous comptes)
        all_period_day_compliances_queryset = DayStrategyCompliance.objects.filter(  # type: ignore
            user=self.request.user,
            date__gte=start_date.date(),
            date__lt=end_date.date()
        ).exclude(strategy_respected__isnull=True).exclude(trading_account__status='archived')
        
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
        
        # Compter les jours respectés (toutes périodes, tous comptes) via agrégation SQL
        all_time_days_respected, all_time_days_not_respected = self._count_respected_days(
            all_time_with_respect, all_time_trades_queryset, all_time_strategies_dates
        )
        
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
        
        # Compter les jours respectés pour la période (tous comptes) via agrégation SQL
        period_days_respected, period_days_not_respected = self._count_respected_days(
            period_with_respect, period_trades_queryset, period_strategies_dates
        )
        
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
        winning_when_respected = respected_strategies.filter(**{f'{tjf}__gt': 0}).count()
        success_rate_if_respected = (winning_when_respected / respected_strategies.count() * 100) if respected_strategies.count() > 0 else 0
        
        # Taux de réussite si stratégie non respectée (trades gagnants quand strategy_respected = False)
        not_respected_strategies = queryset.filter(strategy_respected=False)
        winning_when_not_respected = not_respected_strategies.filter(**{f'{tjf}__gt': 0}).count()
        success_rate_if_not_respected = (winning_when_not_respected / not_respected_strategies.count() * 100) if not_respected_strategies.count() > 0 else 0
        
        # 3. Répartition des sessions gagnantes selon TP1 et TP2+
        # Les sessions gagnantes sont celles où le trade est gagnant (PnL préférence utilisateur > 0)
        winning_sessions = queryset.filter(**{f'{tjf}__gt': 0})
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
        # Agrégations SQL bulk pour les données par période
        from django.db.models import Count, Q as DQ
        from django.db.models.functions import TruncMonth, TruncDay
        
        period_data = []
        
        # Pré-charger les compliances par date (1 requête au lieu de N)
        compliances_by_date = {}
        for c in period_day_compliances_queryset:
            compliances_by_date[c.date] = c
        
        if month:
            # Par jour du mois — 2 requêtes SQL au lieu de ~30*5
            # 1) Trades par jour
            trades_per_day_qs = period_trades_queryset
            if trading_account_id:
                trades_per_day_qs = trades_per_day_qs.filter(trading_account_id=trading_account_id)
            trades_per_day = dict(
                trades_per_day_qs.values('trade_day')
                .annotate(total=Count('id'))
                .values_list('trade_day', 'total')
            )
            
            # 2) Stratégies respectées/non par jour
            strats_per_day = {
                row['trade__trade_day']: {
                    'respected': row['respected'],
                    'not_respected': row['not_respected'],
                }
                for row in queryset.exclude(strategy_respected__isnull=True)
                .values('trade__trade_day')
                .annotate(
                    respected=Count('id', filter=DQ(strategy_respected=True)),
                    not_respected=Count('id', filter=DQ(strategy_respected=False)),
                )
            }
            
            current_date = start_date
            while current_date < end_date:
                day_str = current_date.strftime('%Y-%m-%d')
                day_date_obj = current_date.date() if hasattr(current_date, 'date') else current_date
                
                day_total_trades = trades_per_day.get(day_date_obj, 0)
                strat_info = strats_per_day.get(day_date_obj, {'respected': 0, 'not_respected': 0})
                day_respected = strat_info['respected']
                day_not_respected = strat_info['not_respected']
                
                # Compliances pour jours sans trades
                day_compliance = None
                if day_total_trades == 0:
                    day_compliance = compliances_by_date.get(day_date_obj)
                    if day_compliance and day_compliance.strategy_respected is not None:
                        if day_compliance.strategy_respected:
                            day_respected += 1
                        else:
                            day_not_respected += 1
                
                day_total_with_strategy = day_total_trades + (1 if day_total_trades == 0 and day_compliance and day_compliance.strategy_respected is not None else 0)
                day_respect_percentage = (day_respected / day_total_with_strategy * 100) if day_total_with_strategy > 0 else 0
                day_not_respect_percentage = (day_not_respected / day_total_with_strategy * 100) if day_total_with_strategy > 0 else 0
                period_data.append({
                    'period': current_date.strftime('%d/%m'),
                    'date': day_str,
                    'respect_percentage': round(day_respect_percentage, 2),
                    'not_respect_percentage': round(day_not_respect_percentage, 2),
                    'total': day_total_trades,
                    'total_with_strategy': day_total_with_strategy,
                    'respected_count': day_respected,
                    'not_respected_count': day_not_respected
                })
                current_date += timedelta(days=1)
        else:
            # Par mois — 2 requêtes SQL au lieu de ~12*5
            # 1) Trades par mois
            trades_per_month_qs = period_trades_queryset
            if trading_account_id:
                trades_per_month_qs = trades_per_month_qs.filter(trading_account_id=trading_account_id)
            trades_per_month = {
                row['month']: row['total']
                for row in trades_per_month_qs.annotate(month=TruncMonth('trade_day'))
                .values('month')
                .annotate(total=Count('id'))
            }
            
            # 2) Stratégies respectées/non par mois
            strats_per_month = {
                row['month']: {
                    'respected': row['respected'],
                    'not_respected': row['not_respected'],
                }
                for row in queryset.exclude(strategy_respected__isnull=True)
                .annotate(month=TruncMonth('trade__trade_day'))
                .values('month')
                .annotate(
                    respected=Count('id', filter=DQ(strategy_respected=True)),
                    not_respected=Count('id', filter=DQ(strategy_respected=False)),
                )
            }
            
            # 3) Pré-charger les dates de trades pour exclure les compliances (1 requête)
            all_trade_dates_in_period = set(
                d for d in trades_per_month_qs.values_list('trade_day', flat=True) if d is not None
            )
            
            current_month_start = timezone.datetime(start_date.year, start_date.month, 1)
            
            while current_month_start < end_date:
                if current_month_start.month == 12:
                    month_end = timezone.datetime(current_month_start.year + 1, 1, 1)
                else:
                    month_end = timezone.datetime(current_month_start.year, current_month_start.month + 1, 1)
                
                month_start = current_month_start
                if month_end > end_date:
                    month_end = end_date
                
                month_key = month_start.date().replace(day=1)
                month_total_trades = trades_per_month.get(month_key, 0)
                strat_info = strats_per_month.get(month_key, {'respected': 0, 'not_respected': 0})
                month_respected = strat_info['respected']
                month_not_respected = strat_info['not_respected']
                
                # Compliances pour jours sans trades dans ce mois (itération en mémoire, pas de requête)
                month_day_compliance_count = 0
                month_day_respected_count = 0
                month_day_not_respected_count = 0
                for c_date, c_obj in compliances_by_date.items():
                    if month_start.date() <= c_date < month_end.date():
                        if c_date not in all_trade_dates_in_period:
                            if c_obj.strategy_respected is not None:
                                month_day_compliance_count += 1
                                if c_obj.strategy_respected:
                                    month_day_respected_count += 1
                                else:
                                    month_day_not_respected_count += 1
                
                month_respected += month_day_respected_count
                month_not_respected += month_day_not_respected_count
                
                month_total_with_strategy = month_total_trades + month_day_compliance_count
                month_respect_percentage = (month_respected / month_total_with_strategy * 100) if month_total_with_strategy > 0 else 0
                month_not_respect_percentage = (month_not_respected / month_total_with_strategy * 100) if month_total_with_strategy > 0 else 0
                if month_total_with_strategy > 0:
                    period_data.append({
                        'period': month_start.strftime('%Y-%m'),
                        'date': month_start.strftime('%Y-%m'),
                        'respect_percentage': round(month_respect_percentage, 2),
                        'not_respect_percentage': round(month_not_respect_percentage, 2),
                        'total': month_total_trades,
                        'total_with_strategy': month_total_with_strategy,
                        'respected_count': month_respected,
                        'not_respected_count': month_not_respected
                    })
                
                if current_month_start.month == 12:
                    current_month_start = timezone.datetime(current_month_start.year + 1, 1, 1)
                else:
                    current_month_start = timezone.datetime(current_month_start.year, current_month_start.month + 1, 1)
        
        # Construire la réponse et la mettre en cache
        response_data = {
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
        }
        
        return Response(response_data)
    
    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        """Crée ou met à jour plusieurs stratégies de trades en une fois."""
        from .protected_screenshot_urls import normalize_screenshot_url_for_storage

        strategies_data = request.data.get('strategies', [])
        if not strategies_data:
            return Response({'error': 'Aucune donnée de stratégie fournie'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            created_strategies = []
            user_id = request.user.id
            for strategy_data in strategies_data:
                trade_id = strategy_data.get('trade_id')
                if not trade_id:
                    continue
                
                # Résoudre le trade (topstep_id peut exister sur plusieurs comptes)
                trade_qs = TopStepTrade.objects.filter(topstep_id=trade_id, user=self.request.user)  # type: ignore
                ta_id = strategy_data.get('trading_account_id')
                if ta_id is not None:
                    trade_qs = trade_qs.filter(trading_account_id=ta_id)
                trade = trade_qs.order_by('-id').first()
                if not trade:
                    continue
                
                # Créer ou mettre à jour la stratégie
                strategy, created = TradeStrategy.objects.update_or_create(  # type: ignore
                    user=self.request.user,
                    trade=trade,
                    defaults={
                        'strategy_respected': strategy_data.get('strategy_respected'),
                        'dominant_emotions': strategy_data.get('dominant_emotions') or [],
                        'gain_if_strategy_respected': strategy_data.get('gain_if_strategy_respected'),
                        'tp1_reached': strategy_data.get('tp1_reached', False),
                        'tp2_plus_reached': strategy_data.get('tp2_plus_reached', False),
                        'session_rating': strategy_data.get('session_rating'),
                        'emotion_details': strategy_data.get('emotion_details', ''),
                        'possible_improvements': strategy_data.get('possible_improvements', ''),
                        'screenshot_url': normalize_screenshot_url_for_storage(
                            strategy_data.get('screenshot_url', ''),
                            user_id,
                        ),
                        'video_url': strategy_data.get('video_url', ''),
                    }
                )
                created_strategies.append(strategy)
            
            serializer = self.get_serializer(created_strategies, many=True, context={'request': request})
            if created_strategies:
                refresh_goals_for_user(self.request.user, STRATEGY_DRIVEN_GOAL_TYPES)
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
        from .protected_screenshot_urls import resolve_screenshot_url_for_delete
        canonical_url = resolve_screenshot_url_for_delete(screenshot_url, user_id)
        if not canonical_url or f'/screenshots/{user_id}/' not in canonical_url:
            logger.warning(
                f"Tentative de suppression d'un screenshot non autorisé par l'utilisateur {user_id}: {screenshot_url}"
            )
            return Response({
                'error': 'Vous n\'êtes pas autorisé à supprimer ce fichier'
            }, status=status.HTTP_403_FORBIDDEN)
        
        try:
            # Supprimer le fichier et sa miniature
            success = image_processor.delete_screenshot(canonical_url)
            
            if success:
                logger.info(f"Screenshot supprimé avec succès par l'utilisateur {user_id}: {canonical_url}")
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
        from datetime import timedelta
        
        trading_account_id = request.query_params.get('trading_account')
        position_strategy_id = request.query_params.get('position_strategy')
        # Convertir en int si fourni
        if trading_account_id:
            try:
                trading_account_id = int(trading_account_id)
            except (ValueError, TypeError):
                trading_account_id = None
        if position_strategy_id:
            try:
                position_strategy_id = int(position_strategy_id)
            except (ValueError, TypeError):
                position_strategy_id = None
        
        # Récupérer les paramètres de période
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        year = request.query_params.get('year')
        month = request.query_params.get('month')
        
        ctx = compute_strategy_compliance_context(
            self.request.user,
            trading_account_id=trading_account_id,
            position_strategy_id=position_strategy_id,
            start_date=start_date,
            end_date=end_date,
            year=year,
            month=month,
        )
        daily_compliance = ctx['daily_compliance']
        current_streak = ctx['current_streak']
        best_streak = ctx['best_streak']
        current_streak_start = ctx['current_streak_start']
        current_streak_trades = ctx['current_streak_trades']
        best_streak_trades = ctx['best_streak_trades']
        best_not_respect_streak = ctx['best_not_respect_streak']
        best_not_respect_streak_trades = ctx['best_not_respect_streak_trades']
        total_trades_with_strategy = ctx['total_trades_with_strategy']
        total_respected = ctx['total_respected']
        total_not_respected = ctx['total_not_respected']
        strategies_queryset = ctx['strategies_queryset']
        tjf = get_trade_join_pnl_field_for_request(request.user, request)
        
        # Le total inclut les trades avec stratégie ET les compliances pour les jours sans trades
        # (les compliances sont déjà comptées dans 'with_strategy', 'respected' et 'not_respected')
        overall_compliance_rate = (total_respected / total_trades_with_strategy * 100) if total_trades_with_strategy > 0 else 0
        
        # Calculer les taux pour différentes périodes dans le timezone utilisateur
        user_tz = get_user_timezone(request)
        now = timezone.now().astimezone(user_tz).date()
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
        
        # Comparaison de performance via agrégation SQL (champ PnL selon préférences)
        perf_qs = strategies_queryset.exclude(
            strategy_respected__isnull=True
        ).exclude(**{f'{tjf}__isnull': True})

        _dec_out = DecimalField(max_digits=24, decimal_places=4)
        perf_stats = perf_qs.values('strategy_respected').annotate(
            count=Count('id'),
            total_pnl=Sum(tjf),
            winning_trades=Count('id', filter=Q(**{f'{tjf}__gt': 0})),
            gross_wins=Coalesce(
                Sum(Case(
                    When(**{f'{tjf}__gt': 0}, then=F(tjf)),
                    default=Value(Decimal('0')),
                    output_field=_dec_out,
                )),
                Value(Decimal('0')),
                output_field=_dec_out,
            ),
            gross_losses=Coalesce(
                Sum(Case(
                    When(**{f'{tjf}__lt': 0}, then=F(tjf)),
                    default=Value(Decimal('0')),
                    output_field=_dec_out,
                )),
                Value(Decimal('0')),
                output_field=_dec_out,
            ),
        )
        
        performance_comparison = {
            'respected': {
                'count': 0,
                'total_pnl': Decimal('0'),
                'winning_trades': 0,
                'gross_wins': Decimal('0'),
                'gross_losses': Decimal('0'),
            },
            'not_respected': {
                'count': 0,
                'total_pnl': Decimal('0'),
                'winning_trades': 0,
                'gross_wins': Decimal('0'),
                'gross_losses': Decimal('0'),
            },
        }
        def _as_decimal(v):
            if v is None:
                return Decimal('0')
            if isinstance(v, Decimal):
                return v
            return Decimal(str(v))

        for row in perf_stats:
            key = 'respected' if row['strategy_respected'] else 'not_respected'
            gw = _as_decimal(row.get('gross_wins'))
            gl = _as_decimal(row.get('gross_losses'))
            performance_comparison[key] = {
                'count': row['count'],
                'total_pnl': row['total_pnl'] or Decimal('0'),
                'winning_trades': row['winning_trades'],
                'gross_wins': gw,
                'gross_losses': gl,
            }
        
        # Calculer les moyennes et win rates
        respected_avg_pnl = (performance_comparison['respected']['total_pnl'] / 
                            performance_comparison['respected']['count']) if performance_comparison['respected']['count'] > 0 else Decimal('0')
        not_respected_avg_pnl = (performance_comparison['not_respected']['total_pnl'] / 
                                performance_comparison['not_respected']['count']) if performance_comparison['not_respected']['count'] > 0 else Decimal('0')
        
        respected_win_rate = (performance_comparison['respected']['winning_trades'] / 
                            performance_comparison['respected']['count'] * 100) if performance_comparison['respected']['count'] > 0 else 0
        not_respected_win_rate = (performance_comparison['not_respected']['winning_trades'] / 
                                performance_comparison['not_respected']['count'] * 100) if performance_comparison['not_respected']['count'] > 0 else 0

        def _profit_factor_fields(gw: Decimal, gl: Decimal) -> dict:
            gw = gw or Decimal('0')
            gl = gl or Decimal('0')
            if gl < 0:
                return {
                    'profit_factor': round(float(gw / abs(gl)), 2),
                    'profit_factor_infinite': False,
                }
            if gw > 0:
                return {'profit_factor': None, 'profit_factor_infinite': True}
            return {'profit_factor': None, 'profit_factor_infinite': False}

        pf_respected = _profit_factor_fields(
            performance_comparison['respected']['gross_wins'],
            performance_comparison['respected']['gross_losses'],
        )
        pf_not_respected = _profit_factor_fields(
            performance_comparison['not_respected']['gross_wins'],
            performance_comparison['not_respected']['gross_losses'],
        )
        
        # Construire la réponse
        response_data = {
            'current_streak': current_streak,
            'current_streak_start': current_streak_start,
            'current_streak_trades': current_streak_trades,
            'best_streak': best_streak,
            'best_streak_trades': best_streak_trades,
            'best_not_respect_streak': best_not_respect_streak,
            'best_not_respect_streak_trades': best_not_respect_streak_trades,
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
                    'winning_trades': performance_comparison['respected']['winning_trades'],
                    'gross_wins': str(performance_comparison['respected']['gross_wins']),
                    'gross_losses': str(performance_comparison['respected']['gross_losses']),
                    'profit_factor': pf_respected['profit_factor'],
                    'profit_factor_infinite': pf_respected['profit_factor_infinite'],
                },
                'not_respected': {
                    'count': performance_comparison['not_respected']['count'],
                    'avg_pnl': str(not_respected_avg_pnl),
                    'total_pnl': str(performance_comparison['not_respected']['total_pnl']),
                    'win_rate': round(not_respected_win_rate, 2),
                    'winning_trades': performance_comparison['not_respected']['winning_trades'],
                    'gross_wins': str(performance_comparison['not_respected']['gross_wins']),
                    'gross_losses': str(performance_comparison['not_respected']['gross_losses']),
                    'profit_factor': pf_not_respected['profit_factor'],
                    'profit_factor_infinite': pf_not_respected['profit_factor_infinite'],
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
        }
        
        return Response(response_data)


class DayStrategyComplianceViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour gérer les données de stratégie pour les jours sans trades.
    """
    serializer_class = DayStrategyComplianceSerializer
    permission_classes = [permissions.IsAuthenticated, IsPremiumBundleSubscriberOrAdmin]
    
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
        else:
            # Exclure les comptes archivés des stats globales
            queryset = queryset.exclude(trading_account__status='archived')
        
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
        from .protected_screenshot_urls import resolve_screenshot_url_for_delete
        canonical_url = resolve_screenshot_url_for_delete(screenshot_url, user_id)
        if not canonical_url or f'/screenshots/{user_id}/' not in canonical_url:
            logger.warning(
                f"Tentative de suppression d'un screenshot non autorisé par l'utilisateur {user_id}: {screenshot_url}"
            )
            return Response({
                'error': 'Vous n\'êtes pas autorisé à supprimer ce fichier'
            }, status=status.HTTP_403_FORBIDDEN)
        
        try:
            # Supprimer le fichier et sa miniature
            success = image_processor.delete_screenshot(canonical_url)
            
            if success:
                logger.info(f"Screenshot supprimé avec succès par l'utilisateur {user_id} (jour sans trade): {canonical_url}")
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
    permission_classes = [permissions.IsAuthenticated, IsPremiumBundleSubscriberOrAdmin]
    
    def get_queryset(self):
        """Retourne uniquement les stratégies de l'utilisateur connecté avec optimisations."""
        if not self.request.user.is_authenticated:
            return PositionStrategy.objects.none()  # type: ignore
        
        # Optimisation: select_related pour éviter les N+1 queries
        queryset = PositionStrategy.objects.filter(user=self.request.user)\
            .select_related('user', 'parent_strategy')  # type: ignore
        
        # Optimisation: Annoter avec version_count pour éviter les requêtes supplémentaires
        # Compter les versions enfants + 1 pour inclure la stratégie elle-même
        queryset = queryset.annotate(
            annotated_version_count=models.Count('versions', distinct=True) + 1
        )
        
        # Optimisation: Annoter parent_created_at pour éviter N+1 queries dans get_created_at()
        # Si parent_strategy existe, utiliser sa created_at, sinon utiliser la sienne
        queryset = queryset.annotate(
            parent_created_at=models.Case(
                models.When(parent_strategy__isnull=False, then=models.F('parent_strategy__created_at')),
                default=models.F('created_at'),
                output_field=models.DateTimeField()
            )
        )
        
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
    
    def update(self, request, *args, **kwargs):
        """Override update pour utiliser le bon serializer pour la réponse."""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        if getattr(instance, '_prefetched_objects_cache', None):
            instance._prefetched_objects_cache = {}
        
        # Utiliser PositionStrategySerializer pour la réponse
        response_serializer = PositionStrategySerializer(
            serializer.instance,
            context={'request': request},
        )
        return Response(response_serializer.data)
    
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
            
            # Mettre à jour les champs de la stratégie actuelle AVANT de créer la nouvelle version
            # pour que create_new_version() copie les bonnes valeurs
            for field, value in serializer.validated_data.items():
                if field not in ['strategy_content', 'version_notes', 'is_current', 'create_new_version']:
                    setattr(current_strategy, field, value)
            
            # Créer une nouvelle version (qui copiera les champs mis à jour)
            new_strategy = current_strategy.create_new_version(
                new_content=serializer.validated_data.get('strategy_content', current_strategy.strategy_content),
                version_notes=serializer.validated_data.get('version_notes', '')
            )
            
            # Mettre à jour explicitement les champs example_screenshot sur la nouvelle version
            # car create_new_version() copie depuis self qui n'a pas été sauvegardé
            if 'example_screenshot' in serializer.validated_data:
                new_strategy.example_screenshot = serializer.validated_data['example_screenshot']
            if 'example_screenshot_thumbnail' in serializer.validated_data:
                new_strategy.example_screenshot_thumbnail = serializer.validated_data['example_screenshot_thumbnail']
            
            # Sauvegarder les champs mis à jour
            if 'example_screenshot' in serializer.validated_data or 'example_screenshot_thumbnail' in serializer.validated_data:
                update_fields = []
                if 'example_screenshot' in serializer.validated_data:
                    update_fields.append('example_screenshot')
                if 'example_screenshot_thumbnail' in serializer.validated_data:
                    update_fields.append('example_screenshot_thumbnail')
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
    
    @action(detail=False, methods=['get'])
    def counts(self, request):
        """Retourne les compteurs par statut de manière optimisée."""
        # Pour active et draft : compter uniquement les versions actuelles (is_current=True)
        # Pour archived : compter toutes les versions car elles peuvent avoir is_current=False
        queryset_current = PositionStrategy.objects.filter(
            user=request.user,
            is_current=True
        )  # type: ignore
        
        queryset_all = PositionStrategy.objects.filter(
            user=request.user
        )  # type: ignore
        
        # Compter active et draft parmi les versions actuelles
        active_count = queryset_current.filter(status='active').count()
        draft_count = queryset_current.filter(status='draft').count()
        
        # Compter archived parmi toutes les versions (car is_current peut être False)
        archived_count = queryset_all.filter(status='archived').count()
        
        counts = {
            'total': active_count + draft_count + archived_count,
            'active': active_count,
            'draft': draft_count,
            'archived': archived_count
        }
        
        return Response(counts)
    
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
    
    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser])
    def upload_screenshot(self, request):
        """
        Upload un screenshot d'exemple pour une stratégie.
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
                f"Screenshot de stratégie uploadé avec succès pour l'utilisateur {user_id}: "
                f"original={original_url}, thumbnail={thumbnail_url}"
            )
            
            return Response({
                'original_url': original_url,
                'thumbnail_url': thumbnail_url,
                'message': 'Screenshot uploadé avec succès'
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Erreur lors de l'upload du screenshot de stratégie : {e}")
            return Response({
                'error': 'Erreur lors du traitement de l\'image',
                'detail': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'])
    def delete_screenshot(self, request):
        """
        Supprime un screenshot d'exemple et sa miniature du serveur.
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
        from .protected_screenshot_urls import resolve_screenshot_url_for_delete
        canonical_url = resolve_screenshot_url_for_delete(screenshot_url, user_id)
        if not canonical_url or f'/screenshots/{user_id}/' not in canonical_url:
            logger.warning(
                f"Tentative de suppression d'un screenshot de stratégie non autorisé par l'utilisateur {user_id}: {screenshot_url}"
            )
            return Response({
                'error': 'Vous n\'êtes pas autorisé à supprimer ce fichier'
            }, status=status.HTTP_403_FORBIDDEN)
        
        try:
            # Supprimer le fichier et sa miniature
            success = image_processor.delete_screenshot(canonical_url)
            
            if success:
                logger.info(f"Screenshot de stratégie supprimé avec succès par l'utilisateur {user_id}: {canonical_url}")
                return Response({
                    'message': 'Screenshot supprimé avec succès'
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'error': 'Fichier non trouvé ou déjà supprimé'
                }, status=status.HTTP_404_NOT_FOUND)
                
        except Exception as e:
            logger.error(f"Erreur lors de la suppression du screenshot de stratégie : {e}")
            return Response({
                'error': 'Erreur lors de la suppression du fichier',
                'detail': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TradingGoalViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour gérer les objectifs de trading.
    """
    permission_classes = [permissions.IsAuthenticated, IsPremiumBundleSubscriberOrAdmin]
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


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def dashboard_summary(request):
    """
    Consolidated dashboard endpoint that returns all necessary data in a single request.
    Reduces multiple API calls to 1-2 calls for optimal performance.
    """
    from .stats_response_cache import (
        extract_dashboard_cache_params,
        get_cached_stats_response,
        set_cached_stats_response,
    )
    from .services.dashboard_summary_service import compute_dashboard_summary_payload

    cache_params = extract_dashboard_cache_params(request)
    cached = get_cached_stats_response(request.user.id, 'dashboard_summary', cache_params)
    if cached is not None:
        return Response(cached)

    response_data = compute_dashboard_summary_payload(request)
    set_cached_stats_response(request.user.id, 'dashboard_summary', cache_params, response_data)
    return Response(response_data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, IsPremiumBundleSubscriberOrAdmin])
def stats_bundle(request):
    """
    Bundle statistics + analytics + dashboard_slice en une seule requête.
    """
    from .stats_response_cache import (
        extract_viewset_cache_params,
        get_cached_stats_response,
        set_cached_stats_response,
    )
    from .services.stats_bundle_service import compute_stats_bundle_payload

    cache_params = extract_viewset_cache_params(request)
    cached = get_cached_stats_response(request.user.id, 'stats-bundle', cache_params)
    if cached is not None:
        return Response(cached)

    response_data = compute_stats_bundle_payload(request)
    set_cached_stats_response(request.user.id, 'stats-bundle', cache_params, response_data)
    return Response(response_data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def dashboard_activity_summary(request):
    """
    Lightweight dashboard endpoint for activity counters only.
    Returns total positions and active days without loading heavy payloads.
    """
    from django.db.models.functions import Coalesce

    trading_account_id = request.GET.get('trading_account')
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    position_strategy_id = request.GET.get('position_strategy')
    start_date_obj = None
    end_date_obj = None

    trades_queryset = TopStepTrade.objects.filter(user=request.user)  # type: ignore

    if trading_account_id:
        trades_queryset = trades_queryset.filter(trading_account_id=trading_account_id)
    else:
        active_accounts = TradingAccount.objects.filter(  # type: ignore
            user=request.user
        ).exclude(status='archived').values_list('id', flat=True)
        trades_queryset = trades_queryset.filter(trading_account_id__in=active_accounts)

    if position_strategy_id:
        try:
            position_strategy_id = int(position_strategy_id)
            family_ids = get_position_strategy_family_ids(request.user, position_strategy_id)
            trades_queryset = trades_queryset.filter(position_strategy_id__in=family_ids)
        except (ValueError, TypeError):
            pass

    user_timezone = getattr(getattr(request.user, 'preferences', None), 'timezone', None)
    try:
        user_tz = pytz.timezone(user_timezone) if user_timezone else pytz.timezone('Europe/Paris')
    except pytz.exceptions.UnknownTimeZoneError:
        logger.warning(f"Timezone inconnue: {user_timezone}, utilisation de Europe/Paris par défaut")
        user_tz = pytz.timezone('Europe/Paris')
    except Exception as e:
        logger.error(f"Erreur lors de la configuration de la timezone: {str(e)}")
        user_tz = pytz.timezone('Europe/Paris')

    if start_date:
        try:
            start_datetime = datetime.strptime(start_date, '%Y-%m-%d')
            start_date_obj = start_datetime.date()
            start_datetime = user_tz.localize(start_datetime)
            trades_queryset = trades_queryset.filter(entered_at__gte=start_datetime)
        except ValueError:
            start_date_obj = None

    if end_date:
        try:
            end_datetime = datetime.strptime(end_date, '%Y-%m-%d')
            end_date_obj = end_datetime.date()
            end_datetime = end_datetime.replace(hour=23, minute=59, second=59)
            end_datetime = user_tz.localize(end_datetime)
            trades_queryset = trades_queryset.filter(entered_at__lte=end_datetime)
        except ValueError:
            end_date_obj = None

    # Total positions = number of trades in filtered scope
    total_positions = trades_queryset.count()

    # Active days = union of trade days and compliance days
    trade_dates = set()
    for d in trades_queryset.annotate(
        date=Coalesce('trade_day', TruncDate('entered_at'))
    ).values_list('date', flat=True).distinct():
        if d:
            trade_dates.add(d.isoformat())

    day_compliance_filter = DayStrategyCompliance.objects.filter(  # type: ignore
        user=request.user,
        strategy_respected__isnull=False,
    )
    if trading_account_id:
        day_compliance_filter = day_compliance_filter.filter(trading_account_id=trading_account_id)
    else:
        day_compliance_filter = day_compliance_filter.filter(trading_account_id__in=active_accounts)

    if start_date_obj:
        day_compliance_filter = day_compliance_filter.filter(date__gte=start_date_obj)
    if end_date_obj:
        day_compliance_filter = day_compliance_filter.filter(date__lte=end_date_obj)

    compliance_dates = set(
        d.isoformat()
        for d in day_compliance_filter.values_list('date', flat=True).distinct()
        if d
    )
    active_days_count = len(trade_dates.union(compliance_dates))

    return Response({
        'total_positions': total_positions,
        'active_days': active_days_count,
    })


def _parse_market_holidays_markets(request, default: str = 'XNYS,XPAR,XLON,XTKS') -> List[str]:
    markets_param = request.GET.get('markets', default)
    return [m.strip() for m in markets_param.split(',') if m.strip()]


def _compute_market_holidays_today_payload(markets: List[str]) -> Dict[str, Any]:
    out = {}
    for market_code in markets:
        info = MarketHolidaysService.get_local_today_market_info(market_code)
        out[market_code] = {
            'date': info['date'],
            'is_full_day_holiday': info['is_full_day_holiday'],
            'is_early_close_day': info['is_early_close_day'],
            'regular_session_close_local': info['regular_session_close_local'],
        }
    return {'markets': out}


def _market_holidays_today_response(request):
    """Réponse JSON pour le statut jour férié « journée entière » (date locale par marché)."""
    from .market_holidays_cache import (
        extract_today_cache_params,
        get_cached_market_holidays_response,
        market_holidays_json_response,
        set_cached_market_holidays_response,
    )

    markets = _parse_market_holidays_markets(request)
    cache_params = extract_today_cache_params(markets)
    cached = get_cached_market_holidays_response('today', cache_params)
    if cached is not None:
        return market_holidays_json_response(cached)

    payload = _compute_market_holidays_today_payload(markets)
    set_cached_market_holidays_response('today', cache_params, payload)
    return market_holidays_json_response(payload)


def _parse_market_holidays_count(request) -> int:
    raw = request.GET.get('count', '1')
    try:
        count = int(raw)
        if count < 1 or count > 10:
            return 1
        return count
    except (ValueError, TypeError):
        return 1


def _compute_market_holidays_bundle_payload(markets: List[str], count: int) -> Dict[str, Any]:
    today_payload = _compute_market_holidays_today_payload(markets)
    upcoming = MarketHolidaysService.get_next_holidays(count=count, markets=markets)
    return {
        'markets': today_payload['markets'],
        'upcoming': upcoming,
        'count': len(upcoming),
    }


def _market_holidays_bundle_response(request):
    """
    Une seule requête : statut « aujourd’hui » par marché + prochains jours fériés.
    Évite deux allers-retours HTTP et réutilise les calendriers mis en cache côté serveur.
    """
    from .market_holidays_cache import (
        extract_bundle_cache_params,
        get_cached_market_holidays_response,
        market_holidays_json_response,
        set_cached_market_holidays_response,
    )

    markets = _parse_market_holidays_markets(request)
    count = _parse_market_holidays_count(request)
    cache_params = extract_bundle_cache_params(markets, count)
    cached = get_cached_market_holidays_response('bundle', cache_params)
    if cached is not None:
        return market_holidays_json_response(cached)

    payload = _compute_market_holidays_bundle_payload(markets, count)
    set_cached_market_holidays_response('bundle', cache_params, payload)
    return market_holidays_json_response(payload)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
@throttle_classes([])
def market_holidays(request):
    """
    Retourne les prochains jours fériés et demi-journées des marchés boursiers (NYSE et Euronext).
    Endpoint public (pas besoin d'authentification).
    Utiliser ?today=1 pour le même format que market_holidays_today (léger, même URL de base).
    Utiliser ?bundle=1 pour combiner today + upcoming en une seule réponse (recommandé dashboard).
    """
    today_flag = (request.GET.get('today') or '').strip().lower()
    if today_flag in ('1', 'true', 'yes'):
        return _market_holidays_today_response(request)

    bundle_flag = (request.GET.get('bundle') or '').strip().lower()
    if bundle_flag in ('1', 'true', 'yes'):
        return _market_holidays_bundle_response(request)

    from .market_holidays_cache import (
        extract_upcoming_cache_params,
        get_cached_market_holidays_response,
        market_holidays_json_response,
        set_cached_market_holidays_response,
    )

    count = _parse_market_holidays_count(request)
    markets = _parse_market_holidays_markets(request, default='XNYS,XPAR')
    cache_params = extract_upcoming_cache_params(markets, count)
    cached = get_cached_market_holidays_response('upcoming', cache_params)
    if cached is not None:
        return market_holidays_json_response(cached)

    upcoming = MarketHolidaysService.get_next_holidays(count=count, markets=markets)
    payload = {
        'upcoming': upcoming,
        'count': len(upcoming),
    }
    set_cached_market_holidays_response('upcoming', cache_params, payload)
    return market_holidays_json_response(payload)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
@throttle_classes([])
def market_holidays_today(request):
    """
    Pour chaque marché : date locale « aujourd'hui » et jour férié fermé toute la journée (calcul léger).
    Endpoint public (pas besoin d'authentification).
    Équivalent à GET market-holidays/?today=1
    """
    return _market_holidays_today_response(request)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def market_quotes(request):
    """
    Snapshot des cours temps réel (cache Redis alimenté par run_market_quotes_hub).
    """
    from integrations.market_quotes_activation import bootstrap_market_quotes_for_user
    from integrations.market_quotes_service import load_snapshot

    bootstrap_market_quotes_for_user(request.user)
    return Response(load_snapshot(request.user.id))


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def fx_rates(request):
    """
    Taux de change récents (Frankfurter) pour normaliser les montants multi-comptes.
    Query: base=USD&symbols=EUR,GBP
    """
    from integrations.fx_rates_service import fetch_latest_rates

    base = (request.query_params.get('base') or 'USD').strip().upper()
    symbols_param = request.query_params.get('symbols') or ''
    symbol_list = [s.strip().upper() for s in symbols_param.split(',') if s.strip()]
    symbol_list = [s for s in symbol_list if s != base]

    if not symbol_list:
        return Response(
            {
                'available': True,
                'base_currency': base,
                'rates': {},
                'fx_conversion_applied': False,
            }
        )

    rates = fetch_latest_rates(base, symbol_list)
    if rates is None:
        return Response(
            {
                'available': False,
                'base_currency': base,
                'rates': {},
                'fx_conversion_applied': False,
            }
        )

    return Response(
        {
            'available': True,
            'base_currency': base,
            'rates': rates,
            'fx_conversion_applied': True,
        }
    )
