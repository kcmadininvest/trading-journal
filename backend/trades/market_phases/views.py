"""API REST observatoire phases de marché."""
from __future__ import annotations

from datetime import date, timedelta

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import models
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from trades.models import TopStepTrade, TradingAccount

from .analytics import (
    build_asset_market_profile,
    build_period_profile,
    build_ranking,
    filter_trades_for_instrument,
)
from .capture_service import bulk_upsert_capture
from trades.contract_utils.market_quote_mapping import (
    instruments_from_contract_names,
    market_quote_instrument_label,
    resolve_market_quote_instrument_key,
)
from .models import (
    MarketPhaseDefinition,
    MarketPhaseEventDefinition,
    MarketPhaseSlotConfig,
    SessionMarketPhaseBlock,
    SessionMarketPhaseEvent,
)
from .period_projection import parse_period_key, periods_from_captured_blocks, periods_from_config
from .serializers import (
    CaptureBulkSerializer,
    MarketPhaseDefinitionCreateSerializer,
    MarketPhaseDefinitionSerializer,
    MarketPhaseEventDefinitionSerializer,
    MarketPhaseSlotConfigSerializer,
    SessionMarketPhaseBlockSerializer,
    SessionMarketPhaseEventSerializer,
)


def _user_timezone(request) -> str:
    prefs = getattr(request.user, 'preferences', None)
    return getattr(prefs, 'timezone', None) or 'Europe/Paris'


def _user_pnl_mode(request) -> str:
    prefs = getattr(request.user, 'preferences', None)
    return getattr(prefs, 'pnl_display_mode', None) or 'net'


def _parse_date_range(request) -> tuple[date, date]:
    today = timezone.localdate()
    date_to_s = request.query_params.get('date_to')
    date_from_s = request.query_params.get('date_from')
    date_to = date.fromisoformat(date_to_s) if date_to_s else today
    date_from = date.fromisoformat(date_from_s) if date_from_s else (date_to - timedelta(days=180))
    return date_from, date_to


class MarketPhaseDefinitionViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MarketPhaseDefinitionSerializer

    def get_queryset(self):
        return MarketPhaseDefinition.objects.filter(
            models.Q(user=self.request.user) | models.Q(user__isnull=True, is_system=True),
            is_active=True,
        ).order_by('sort_order', 'code')

    def get_serializer_class(self):
        if self.action == 'create':
            return MarketPhaseDefinitionCreateSerializer
        return MarketPhaseDefinitionSerializer

    def perform_destroy(self, instance):
        if instance.is_system:
            instance.is_active = False
            instance.save(update_fields=['is_active'])
        else:
            instance.delete()


class MarketPhaseEventDefinitionViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MarketPhaseEventDefinitionSerializer

    def get_queryset(self):
        return MarketPhaseEventDefinition.objects.filter(
            models.Q(user=self.request.user) | models.Q(user__isnull=True, is_system=True),
            is_active=True,
        ).order_by('sort_order', 'code')


class MarketPhaseSlotConfigView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        config, _ = MarketPhaseSlotConfig.objects.get_or_create(user=request.user)
        return Response(MarketPhaseSlotConfigSerializer(config).data)

    def patch(self, request):
        config, _ = MarketPhaseSlotConfig.objects.get_or_create(user=request.user)
        ser = MarketPhaseSlotConfigSerializer(config, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


class MarketPhaseCaptureView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        session_date_s = request.query_params.get('session_date')
        account_id = request.query_params.get('trading_account')
        instrument_key = request.query_params.get('instrument_key')
        if not session_date_s or not account_id or not instrument_key:
            return Response(
                {'detail': 'session_date, trading_account et instrument_key sont requis.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        session_date = date.fromisoformat(session_date_s)
        account = get_object_or_404(TradingAccount, pk=account_id, user=request.user)
        blocks = SessionMarketPhaseBlock.objects.filter(
            user=request.user,
            trading_account=account,
            session_date=session_date,
            instrument_key=instrument_key,
        ).select_related('phase').prefetch_related('events__event_type')
        orphan_events = SessionMarketPhaseEvent.objects.filter(
            user=request.user,
            trading_account=account,
            session_date=session_date,
            instrument_key=instrument_key,
            parent_block__isnull=True,
        ).select_related('event_type')
        return Response({
            'session_date': session_date.isoformat(),
            'trading_account': account.id,
            'instrument_key': instrument_key,
            'blocks': SessionMarketPhaseBlockSerializer(blocks, many=True).data,
            'orphan_events': SessionMarketPhaseEventSerializer(orphan_events, many=True).data,
        })

    def put(self, request):
        ser = CaptureBulkSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        account = get_object_or_404(
            TradingAccount,
            pk=data['trading_account'],
            user=request.user,
        )
        try:
            blocks, events = bulk_upsert_capture(
                user=request.user,
                trading_account=account,
                session_date=data['session_date'],
                instrument_key=data['instrument_key'],
                blocks_data=data['blocks'],
                events_data=data['events'],
                source=data.get('source', 'live'),
                trading_session_id=data.get('trading_session'),
            )
        except DjangoValidationError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        blocks_qs = SessionMarketPhaseBlock.objects.filter(
            id__in=[b.id for b in blocks]
        ).select_related('phase').prefetch_related('events__event_type')
        return Response({
            'blocks': SessionMarketPhaseBlockSerializer(blocks_qs, many=True).data,
            'events_count': len(events),
        })


class MarketPhaseAnalyticsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _base_querysets(self, request, instrument_key: str, date_from: date, date_to: date):
        blocks_qs = SessionMarketPhaseBlock.objects.filter(
            user=request.user,
            instrument_key=instrument_key,
            session_date__gte=date_from,
            session_date__lte=date_to,
        )
        events_qs = SessionMarketPhaseEvent.objects.filter(
            user=request.user,
            instrument_key=instrument_key,
            session_date__gte=date_from,
            session_date__lte=date_to,
        )
        account_id = request.query_params.get('trading_account')
        if account_id:
            blocks_qs = blocks_qs.filter(trading_account_id=account_id)
            events_qs = events_qs.filter(trading_account_id=account_id)
        trades_qs = TopStepTrade.objects.filter(
            user=request.user,
            trade_day__gte=date_from,
            trade_day__lte=date_to,
        )
        if account_id:
            trades_qs = trades_qs.filter(trading_account_id=account_id)
        trades_qs = filter_trades_for_instrument(trades_qs, instrument_key)
        return blocks_qs, events_qs, trades_qs

    def get(self, request, analysis_type: str):
        instrument_key = request.query_params.get('instrument_key')
        if not instrument_key:
            return Response({'detail': 'instrument_key requis.'}, status=400)
        date_from, date_to = _parse_date_range(request)
        blocks_qs, events_qs, trades_qs = self._base_querysets(
            request, instrument_key, date_from, date_to
        )
        config, _ = MarketPhaseSlotConfig.objects.get_or_create(user=request.user)
        periods = periods_from_captured_blocks(blocks_qs)
        if not periods:
            periods = periods_from_config(
                config.custom_analytical_periods if config.mode == 'custom' else None,
                config.mode,
                duration_minutes=config.duration_minutes,
                anchor=config.anchor,
                market_code=config.market_code,
            )

        if analysis_type == 'asset-profile':
            period_key = request.query_params.get('period_key')
            if period_key:
                period = parse_period_key(period_key)
                if not period:
                    return Response({'detail': 'period_key invalide.'}, status=400)
                profile = build_asset_market_profile(
                    blocks_qs=blocks_qs,
                    events_qs=events_qs,
                    period=period,
                    instrument_key=instrument_key,
                )
                return Response(profile)
            profiles = []
            for p in periods:
                profile = build_asset_market_profile(
                    blocks_qs=blocks_qs,
                    events_qs=events_qs,
                    period=p,
                    instrument_key=instrument_key,
                )
                if profile['sample_sessions'] > 0:
                    profiles.append(profile)
            return Response({'profiles': profiles, 'date_from': date_from, 'date_to': date_to})

        if analysis_type == 'period-profile':
            period_key = request.query_params.get('period_key')
            if not period_key:
                return Response({'detail': 'period_key requis.'}, status=400)
            period = parse_period_key(period_key)
            if not period:
                return Response({'detail': 'period_key invalide.'}, status=400)
            asset = build_asset_market_profile(
                blocks_qs=blocks_qs,
                events_qs=events_qs,
                period=period,
                instrument_key=instrument_key,
            )
            profile = build_period_profile(
                asset_profile=asset,
                trades_qs=trades_qs,
                blocks_qs=blocks_qs,
                period=period,
                tz_name=_user_timezone(request),
                pnl_mode=_user_pnl_mode(request),
            )
            return Response(profile)

        if analysis_type == 'ranking':
            ranking = build_ranking(
                blocks_qs=blocks_qs,
                events_qs=events_qs,
                trades_qs=trades_qs,
                periods=periods,
                instrument_key=instrument_key,
                tz_name=_user_timezone(request),
                pnl_mode=_user_pnl_mode(request),
                sort_by=request.query_params.get('sort_by', 'win_rate'),
            )
            return Response({
                'ranking': ranking,
                'instrument_key': instrument_key,
                'date_from': date_from,
                'date_to': date_to,
            })

        return Response({'detail': 'Type analytics inconnu.'}, status=404)


class MarketPhaseInstrumentsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        trading_account_id = request.query_params.get('trading_account')
        trades = TopStepTrade.objects.filter(user=request.user)
        if trading_account_id:
            try:
                trades = trades.filter(trading_account_id=int(trading_account_id))
            except (ValueError, TypeError):
                pass
        contract_names = list(
            trades.values_list('contract_name', flat=True).distinct().order_by('contract_name')
        )
        instruments = instruments_from_contract_names(contract_names)
        return Response({
            'instruments': instruments,
            'valid_keys': [item['key'] for item in instruments],
        })
