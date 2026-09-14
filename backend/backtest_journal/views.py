from __future__ import annotations

import csv
import io
from datetime import datetime
from decimal import Decimal
from typing import Any
from zoneinfo import ZoneInfo

from django.db import transaction
from django.db.models import Count, Max, OuterRef, Prefetch, Subquery
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from billing.permissions import IsPremiumBundleSubscriberOrAdmin
from trades.image_processor import image_processor
from trades.protected_screenshot_urls import (
    normalize_screenshot_url_for_storage,
    resolve_screenshot_url_for_delete,
    transform_screenshot_url_for_response,
)
from trades.serializers import ScreenshotUploadSerializer

from .models import (
    ManualBacktestCampaign,
    ManualBacktestObservation,
    ManualBacktestStrategy,
    ManualBacktestVersion,
)
from .serializers import (
    ManualBacktestCampaignSerializer,
    ManualBacktestObservationSerializer,
    ManualBacktestStrategyListSerializer,
    ManualBacktestStrategySerializer,
    ManualBacktestVersionSerializer,
    next_version_number,
)
from .services.stats import (
    compute_campaign_statistics,
    equity_series,
    group_observations,
    is_primary_stat_row,
    is_theoretical_refused_row,
)

MAX_OBSERVATIONS_PER_CAMPAIGN = 2000


class UserScopedMixin:
    permission_classes = [permissions.IsAuthenticated, IsPremiumBundleSubscriberOrAdmin]
    pagination_class = None

    def get_user(self):
        return self.request.user


class ManualBacktestStrategyViewSet(UserScopedMixin, viewsets.ModelViewSet):
    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return ManualBacktestStrategy.objects.none()
        latest = (
            ManualBacktestVersion.objects.filter(strategy=OuterRef('pk'))
            .order_by('-version')
        )
        return (
            ManualBacktestStrategy.objects.filter(user=user)
            .select_related('position_strategy')
            .annotate(
                campaign_count=Count('versions__campaigns', distinct=True),
                latest_version_id=Subquery(latest.values('id')[:1]),
                latest_version_number=Subquery(latest.values('version')[:1]),
                is_latest_locked=Subquery(latest.values('locked_at')[:1]),
            )
            .prefetch_related(
                Prefetch(
                    'versions',
                    queryset=ManualBacktestVersion.objects.annotate(
                        observation_count=Count('campaigns__observations')
                    ),
                )
            )
        )

    def get_serializer_class(self):
        if self.action == 'list':
            return ManualBacktestStrategyListSerializer
        return ManualBacktestStrategySerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        position_strategy = serializer.validated_data['position_strategy']
        existing = (
            ManualBacktestStrategy.objects.filter(
                user=request.user,
                position_strategy=position_strategy,
            )
            .prefetch_related('versions')
            .first()
        )
        if existing:
            existing = self.get_queryset().filter(pk=existing.pk).first() or existing
            return Response(
                ManualBacktestStrategySerializer(existing, context={'request': request}).data
            )
        self.perform_create(serializer)
        instance = self.get_queryset().get(pk=serializer.instance.pk)
        return Response(
            ManualBacktestStrategySerializer(instance, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    def perform_create(self, serializer):
        strategy = serializer.save(user=self.request.user)
        ManualBacktestVersion.objects.create(
            strategy=strategy,
            version=1,
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.versions.filter(campaigns__isnull=False).exists():
            return Response(
                {
                    'detail': (
                        'Supprimez d’abord les campagnes liées à cette stratégie.'
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def versions(self, request, pk=None):
        strategy = self.get_object()
        payload = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        serializer = ManualBacktestVersionSerializer(
            data=payload, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        version = serializer.save(
            strategy=strategy,
            version=next_version_number(strategy),
        )
        return Response(
            ManualBacktestVersionSerializer(version, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class ManualBacktestVersionViewSet(UserScopedMixin, viewsets.GenericViewSet):
    serializer_class = ManualBacktestVersionSerializer

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return ManualBacktestVersion.objects.none()
        return ManualBacktestVersion.objects.filter(strategy__user=user).annotate(
            observation_count=Count('campaigns__observations')
        )

    def retrieve(self, request, pk=None):
        version = self.get_object()
        return Response(self.get_serializer(version).data)

    def partial_update(self, request, pk=None):
        version = self.get_object()
        serializer = self.get_serializer(version, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        version = self.get_object()
        clone = ManualBacktestVersion.objects.create(
            strategy=version.strategy,
            version=next_version_number(version.strategy),
            context_rules=version.context_rules,
            setup_rules=version.setup_rules,
            entry_rules=version.entry_rules,
            stop_rules=version.stop_rules,
            exit_rules=version.exit_rules,
            invalidation_rules=version.invalidation_rules,
            notes=version.notes,
            locked_at=None,
        )
        return Response(
            ManualBacktestVersionSerializer(clone, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class ManualBacktestCampaignViewSet(UserScopedMixin, viewsets.ModelViewSet):
    serializer_class = ManualBacktestCampaignSerializer

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return ManualBacktestCampaign.objects.none()
        qs = (
            ManualBacktestCampaign.objects.filter(user=user)
            .select_related('strategy_version', 'strategy_version__strategy')
            .annotate(observation_count=Count('observations'))
        )
        strategy_id = self.request.query_params.get('strategy')
        if strategy_id:
            qs = qs.filter(strategy_version__strategy_id=strategy_id)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def _observations(self, campaign: ManualBacktestCampaign):
        return list(
            campaign.observations.all().order_by(
                '-market_datetime', '-id'
            )
        )

    @action(detail=True, methods=['get', 'post'])
    def observations(self, request, pk=None):
        campaign = self.get_object()
        if request.method == 'GET':
            rows = campaign.observations.all().order_by(
                '-market_datetime', '-id'
            )[:MAX_OBSERVATIONS_PER_CAMPAIGN]
            serializer = ManualBacktestObservationSerializer(
                rows, many=True, context={'request': request}
            )
            return Response(serializer.data)

        if campaign.observations.count() >= MAX_OBSERVATIONS_PER_CAMPAIGN:
            return Response(
                {'detail': 'Limite d’observations atteinte pour cette campagne.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        data['campaign'] = campaign.pk
        serializer = ManualBacktestObservationSerializer(
            data=data, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        obs = serializer.save()
        return Response(
            ManualBacktestObservationSerializer(obs, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'], url_path='observations/bulk')
    def observations_bulk(self, request, pk=None):
        campaign = self.get_object()
        items = request.data.get('items')
        if not isinstance(items, list):
            return Response(
                {'items': 'Liste d’observations attendue.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(items) > MAX_OBSERVATIONS_PER_CAMPAIGN:
            return Response(
                {'detail': 'Trop d’observations dans ce lot.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing_ids = {
            item.get('id') for item in items if item.get('id') is not None
        }
        existing_map = {
            obs.pk: obs
            for obs in campaign.observations.filter(pk__in=existing_ids)
        }
        creates = [item for item in items if not item.get('id')]
        if campaign.observations.count() + len(creates) > MAX_OBSERVATIONS_PER_CAMPAIGN:
            return Response(
                {'detail': 'Limite d’observations atteinte pour cette campagne.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        saved = []
        errors = []
        with transaction.atomic():
            max_index = (
                campaign.observations.aggregate(m=Max('sort_index'))['m'] or 0
            )
            for index, item in enumerate(items):
                payload = dict(item)
                payload['campaign'] = campaign.pk
                client_key = payload.pop('client_key', None)
                obs_id = payload.pop('id', None)
                instance = existing_map.get(obs_id) if obs_id else None
                if obs_id and instance is None:
                    errors.append(
                        {'index': index, 'id': obs_id, 'detail': 'Observation introuvable.'}
                    )
                    continue
                if instance is None and payload.get('sort_index') is None:
                    max_index += 1
                    payload['sort_index'] = max_index
                serializer = ManualBacktestObservationSerializer(
                    instance=instance,
                    data=payload,
                    partial=bool(instance),
                    context={'request': request},
                )
                if not serializer.is_valid():
                    errors.append({'index': index, 'errors': serializer.errors})
                    continue
                obs = serializer.save()
                data = ManualBacktestObservationSerializer(
                    obs, context={'request': request}
                ).data
                if client_key:
                    data['client_key'] = client_key
                saved.append(data)
            if errors:
                transaction.set_rollback(True)
                return Response({'errors': errors}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'items': saved})

    @action(detail=True, methods=['get'])
    def statistics(self, request, pk=None):
        campaign = self.get_object()
        stats = compute_campaign_statistics(self._observations(campaign))
        stats['campaign_id'] = campaign.pk
        stats['goal'] = campaign.observation_goal
        return Response(stats)

    @action(detail=True, methods=['get'])
    def equity(self, request, pk=None):
        campaign = self.get_object()
        observations = self._observations(campaign)
        return Response(
            {
                'taken': equity_series(observations, theoretical=False),
                'refused_theoretical': equity_series(observations, theoretical=True),
            }
        )

    @action(detail=True, methods=['get'])
    def analysis(self, request, pk=None):
        campaign = self.get_object()
        observations = self._filter_observations(
            self._observations(campaign), request, campaign
        )
        scope = request.query_params.get('scope', 'taken')
        if scope == 'refused':
            scoped = [obs for obs in observations if is_theoretical_refused_row(obs)]
        elif scope == 'all_with_r':
            scoped = [
                obs
                for obs in observations
                if is_primary_stat_row(obs) or is_theoretical_refused_row(obs)
            ]
        else:
            scoped = [obs for obs in observations if is_primary_stat_row(obs)]

        group_by = request.query_params.get('group_by') or 'direction'
        if group_by not in {
            'direction',
            'weekday',
            'hour',
            'result',
            'trade_taken',
            'all',
        }:
            return Response(
                {'group_by': 'Regroupement non supporté.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        global_metrics = compute_campaign_statistics(self._observations(campaign))
        filtered_metrics = compute_campaign_statistics(observations)
        groups = group_observations(scoped, group_by, campaign.timezone)
        return Response(
            {
                'global': global_metrics,
                'filtered': filtered_metrics,
                'groups': groups,
                'scope': scope,
                'group_by': group_by,
                'sample_size': filtered_metrics.get('sample_size', 0),
                'exclusions': {
                    'open': filtered_metrics.get('excluded_open'),
                    'missing_r': filtered_metrics.get('excluded_missing_r'),
                    'refused': filtered_metrics.get('setups_refused'),
                },
            }
        )

    @action(detail=True, methods=['get'])
    def export(self, request, pk=None):
        campaign = self.get_object()
        observations = self._observations(campaign)
        if request.query_params.get('selection') == '1':
            observations = self._filter_observations(observations, request, campaign)
        content = _build_csv(request.user, campaign, observations)
        filename = f'backtest-{campaign.pk}.csv'
        response = HttpResponse(content, content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    def _filter_observations(
        self,
        observations: list[ManualBacktestObservation],
        request,
        campaign: ManualBacktestCampaign,
    ) -> list[ManualBacktestObservation]:
        params = request.query_params
        direction = params.get('direction')
        if direction:
            if direction not in {'LONG', 'SHORT'}:
                return observations
            observations = [obs for obs in observations if obs.direction == direction]
        trade_taken = params.get('trade_taken')
        if trade_taken in {'true', 'false', '1', '0'}:
            flag = trade_taken in {'true', '1'}
            observations = [obs for obs in observations if obs.trade_taken is flag]
        result = params.get('result')
        if result:
            observations = [obs for obs in observations if obs.result_status == result]
        setup_valid = params.get('setup_valid')
        if setup_valid in {'true', 'false', '1', '0'}:
            flag = setup_valid in {'true', '1'}
            observations = [obs for obs in observations if obs.setup_valid is flag]
        start = params.get('start')
        end = params.get('end')
        if start:
            observations = [
                obs
                for obs in observations
                if obs.market_datetime and obs.market_datetime.isoformat() >= start
            ]
        if end:
            observations = [
                obs
                for obs in observations
                if obs.market_datetime and obs.market_datetime.isoformat() <= end
            ]
        return observations


class ManualBacktestObservationViewSet(UserScopedMixin, viewsets.GenericViewSet):
    serializer_class = ManualBacktestObservationSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return ManualBacktestObservation.objects.none()
        return ManualBacktestObservation.objects.filter(user=user).select_related(
            'campaign', 'campaign__strategy_version'
        )

    def retrieve(self, request, pk=None):
        obs = self.get_object()
        return Response(self.get_serializer(obs).data)

    def partial_update(self, request, pk=None):
        obs = self.get_object()
        serializer = self.get_serializer(obs, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def destroy(self, request, pk=None):
        obs = self.get_object()
        _delete_observation_screenshots(obs)
        obs.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        obs = self.get_object()
        max_index = obs.campaign.observations.aggregate(m=Max('sort_index'))['m'] or 0
        clone = ManualBacktestObservation.objects.create(
            campaign=obs.campaign,
            user=request.user,
            market_datetime=obs.market_datetime,
            exit_datetime=obs.exit_datetime,
            direction=obs.direction,
            setup_valid=obs.setup_valid,
            trade_taken=obs.trade_taken,
            refusal_reason=obs.refusal_reason,
            entry_price=obs.entry_price,
            initial_stop_price=obs.initial_stop_price,
            target_price=obs.target_price,
            quantity=obs.quantity,
            sort_index=max_index + 1,
            result_status='OPEN',
        )
        return Response(
            ManualBacktestObservationSerializer(clone, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    def screenshots(self, request, pk=None):
        obs = self.get_object()
        kind = request.data.get('kind', 'before')
        if kind not in {'before', 'after'}:
            return Response({'kind': 'before ou after.'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = ScreenshotUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        original_url, _thumb = image_processor.process_screenshot(
            serializer.validated_data['file'], request.user.pk
        )
        stored = normalize_screenshot_url_for_storage(original_url, request.user.pk)
        field = 'screenshot_before_url' if kind == 'before' else 'screenshot_after_url'
        old = getattr(obs, field)
        if old:
            canonical = resolve_screenshot_url_for_delete(old, request.user.pk)
            if canonical:
                image_processor.delete_screenshot(canonical)
        setattr(obs, field, stored or '')
        obs.save(update_fields=[field, 'updated_at'])
        display = transform_screenshot_url_for_response(
            stored or '', request.user.pk, request
        )
        return Response({field: display, 'kind': kind})

    @action(detail=True, methods=['delete'], url_path='screenshots/(?P<kind>before|after)')
    def delete_screenshot(self, request, pk=None, kind=None):
        obs = self.get_object()
        field = 'screenshot_before_url' if kind == 'before' else 'screenshot_after_url'
        old = getattr(obs, field)
        if old:
            canonical = resolve_screenshot_url_for_delete(old, request.user.pk)
            if canonical:
                image_processor.delete_screenshot(canonical)
        setattr(obs, field, '')
        obs.save(update_fields=[field, 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)


def _delete_observation_screenshots(obs: ManualBacktestObservation) -> None:
    for field in ('screenshot_before_url', 'screenshot_after_url'):
        url = getattr(obs, field)
        if not url:
            continue
        canonical = resolve_screenshot_url_for_delete(url, obs.user_id)
        if canonical:
            image_processor.delete_screenshot(canonical)


def _user_prefs(user) -> dict[str, str]:
    try:
        prefs = user.preferences
    except Exception:
        prefs = None
    return {
        'date_format': getattr(prefs, 'date_format', None) or 'EU',
        'number_format': getattr(prefs, 'number_format', None) or 'comma',
        'timezone': getattr(prefs, 'timezone', None) or 'Europe/Paris',
    }


def _fmt_dt(value: datetime | None, prefs: dict[str, str]) -> str:
    if not value:
        return ''
    if timezone.is_naive(value):
        value = timezone.make_aware(value, timezone.utc)
    try:
        tz = ZoneInfo(prefs['timezone'])
    except Exception:
        tz = ZoneInfo('UTC')
    local = value.astimezone(tz)
    if prefs['date_format'] == 'US':
        return local.strftime('%m/%d/%Y %H:%M')
    return local.strftime('%d/%m/%Y %H:%M')


def _fmt_number(value: Any, prefs: dict[str, str]) -> str:
    if value is None or value == '':
        return ''
    number = Decimal(str(value))
    text = format(number, 'f')
    if prefs['number_format'] == 'comma':
        if '.' in text:
            whole, frac = text.split('.', 1)
            return f'{whole},{frac}'
        return text
    return text


def _build_csv(user, campaign: ManualBacktestCampaign, observations) -> str:
    prefs = _user_prefs(user)
    delimiter = ';' if prefs['number_format'] == 'comma' else ','
    output = io.StringIO()
    writer = csv.writer(output, delimiter=delimiter)
    headers = [
        'id',
        'market_datetime',
        'exit_datetime',
        'direction',
        'setup_valid',
        'trade_taken',
        'refusal_reason',
        'entry_price',
        'initial_stop_price',
        'target_price',
        'exit_price',
        'result_status',
        'result_r',
        'result_r_source',
        'result_points',
        'result_kind',
        'context',
        'structure',
        'notes',
        'screenshot_before',
        'screenshot_after',
    ]
    writer.writerow(headers)
    for obs in observations:
        kind = 'taken' if obs.trade_taken else 'theoretical_refused'
        writer.writerow(
            [
                obs.pk,
                _fmt_dt(obs.market_datetime, prefs),
                _fmt_dt(obs.exit_datetime, prefs),
                obs.direction,
                obs.setup_valid,
                obs.trade_taken,
                obs.refusal_reason,
                _fmt_number(obs.entry_price, prefs),
                _fmt_number(obs.initial_stop_price, prefs),
                _fmt_number(obs.target_price, prefs),
                _fmt_number(obs.exit_price, prefs),
                obs.result_status,
                _fmt_number(obs.result_r, prefs),
                obs.result_r_source,
                _fmt_number(obs.result_points, prefs),
                kind,
                obs.context,
                obs.structure,
                obs.notes,
                obs.screenshot_before_url or '',
                obs.screenshot_after_url or '',
            ]
        )
    return output.getvalue()
