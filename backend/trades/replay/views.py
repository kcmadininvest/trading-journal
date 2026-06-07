"""API REST replay de session TopStep."""
from __future__ import annotations

from datetime import date

import pytz
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from billing.permissions import IsPremiumBundleSubscriberOrAdmin
from daily_journal.models import DailyJournalEntry
from trades.models import TopStepTrade, TradingAccount, TradingSession

from .serializers import (
    SessionBuildRequestSerializer,
    SessionEventSerializer,
    SessionInsightSerializer,
    SessionJournalDraftSerializer,
    TradingSessionSerializer,
)
from integrations.topstepx_auth import get_topstepx_integration, get_valid_session_token
from integrations.topstepx_client import TopStepXApiClient, TopStepXApiError

from .journal_generator import journal_draft_content_for_session
from .market_data_fetcher import refresh_session_market_data
from .session_builder import SessionReplayBuilder


def _user_timezone_name(request) -> str:
    user_timezone = getattr(getattr(request.user, 'preferences', None), 'timezone', None)
    if user_timezone:
        try:
            pytz.timezone(user_timezone)
            return str(user_timezone)
        except pytz.exceptions.UnknownTimeZoneError:
            pass
    return 'Europe/Paris'


class TradingSessionReplayViewSet(viewsets.ReadOnlyModelViewSet):
    """Sessions de replay reconstruites."""

    permission_classes = [permissions.IsAuthenticated, IsPremiumBundleSubscriberOrAdmin]
    serializer_class = TradingSessionSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['user_timezone'] = _user_timezone_name(self.request)
        return context

    def get_queryset(self):
        qs = TradingSession.objects.filter(user=self.request.user).select_related(
            'trading_account',
            'journal_draft',
        )
        account_id = self.request.query_params.get('trading_account')
        if account_id:
            qs = qs.filter(trading_account_id=account_id)
        date_from = self.request.query_params.get('date_from')
        if date_from:
            qs = qs.filter(session_date__gte=date_from)
        date_to = self.request.query_params.get('date_to')
        if date_to:
            qs = qs.filter(session_date__lte=date_to)
        return qs.order_by('-session_date')

    @action(detail=False, methods=['get'], url_path='active-dates')
    def active_dates(self, request):
        """Dates (YYYY-MM-DD) avec au moins un trade sur le compte sélectionné."""
        account_id = request.query_params.get('trading_account')
        if not account_id:
            return Response(
                {'detail': 'Le paramètre trading_account est requis.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        account = get_object_or_404(
            TradingAccount,
            pk=account_id,
            user=request.user,
        )
        trade_days = (
            TopStepTrade.objects.filter(
                user=request.user,
                trading_account=account,
                trade_day__isnull=False,
            )
            .values_list('trade_day', flat=True)
            .distinct()
            .order_by('trade_day')
        )
        dates = [d.isoformat() for d in trade_days if d]
        return Response({'dates': dates})

    @action(detail=False, methods=['post'], url_path='build')
    def build(self, request):
        ser = SessionBuildRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        account = get_object_or_404(
            TradingAccount,
            pk=ser.validated_data['trading_account'],
            user=request.user,
        )
        session_date: date = ser.validated_data['session_date']
        tz_name = _user_timezone_name(request)
        try:
            result = SessionReplayBuilder().build(
                request.user,
                account,
                session_date,
                tz_name=tz_name,
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        payload = TradingSessionSerializer(result.session).data
        if result.preserved:
            payload['preserved'] = True
            payload['preserve_reason'] = result.preserve_reason
        return Response(payload, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='timeline')
    def timeline(self, request, pk=None):
        session = self.get_object()
        events = session.events.select_related('trade').order_by('sequence')
        return Response(SessionEventSerializer(events, many=True).data)

    @action(detail=True, methods=['get'], url_path='insights')
    def insights(self, request, pk=None):
        session = self.get_object()
        items = session.insights.order_by('occurred_at', 'id')
        return Response(SessionInsightSerializer(items, many=True).data)

    @action(detail=True, methods=['post'], url_path='apply-journal')
    def apply_journal(self, request, pk=None):
        session = self.get_object()
        draft = getattr(session, 'journal_draft', None)
        if draft is None:
            return Response(
                {'detail': 'Aucun brouillon de journal pour cette session.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        overwrite = request.data.get('overwrite', False)
        content = journal_draft_content_for_session(
            session,
            tz_name=_user_timezone_name(request),
        )
        entry, created = DailyJournalEntry.objects.get_or_create(
            user=request.user,
            trading_account=session.trading_account,
            date=session.session_date,
            defaults={'content': content},
        )
        if not created and entry.content.strip() and not overwrite:
            return Response(
                {
                    'detail': 'Une entrée de journal existe déjà. Envoyez overwrite=true pour remplacer.',
                    'entry_id': entry.id,
                },
                status=status.HTTP_409_CONFLICT,
            )
        if not created:
            entry.content = content
            entry.save(update_fields=['content', 'updated_at'])

        draft.applied_entry = entry
        draft.applied_at = timezone.now()
        draft.save(update_fields=['applied_entry', 'applied_at', 'updated_at'])

        return Response(
            {
                'entry_id': entry.id,
                'created': created,
                'content': entry.content,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['get'], url_path='journal-draft')
    def journal_draft(self, request, pk=None):
        session = self.get_object()
        draft = getattr(session, 'journal_draft', None)
        if draft is None:
            return Response({'content': ''})
        return Response(SessionJournalDraftSerializer(draft).data)

    @action(detail=True, methods=['post'], url_path='refresh-market-data')
    def refresh_market_data(self, request, pk=None):
        session = self.get_object()
        if session.trading_account.account_type != 'topstep':
            return Response(
                {'detail': 'Le replay marché est réservé aux comptes TopStep.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        integration = get_topstepx_integration(request.user)
        if integration is None or not integration.secrets_encrypted:
            return Response(
                {'detail': 'Configurez l\'intégration TopStepX dans les paramètres.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = get_valid_session_token(integration)
            market_data = refresh_session_market_data(
                session,
                TopStepXApiClient(),
                token,
            )
        except TopStepXApiError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        payload = TradingSessionSerializer(session).data
        payload['market_data'] = market_data
        return Response(payload, status=status.HTTP_200_OK)
