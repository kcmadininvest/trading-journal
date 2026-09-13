from __future__ import annotations

from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.db.models import Max
from django.utils import timezone
from rest_framework import serializers

from trades.models import PositionStrategy
from trades.protected_screenshot_urls import (
    normalize_screenshot_url_for_storage,
    transform_screenshot_url_for_response,
)

from .models import (
    ManualBacktestCampaign,
    ManualBacktestObservation,
    ManualBacktestStrategy,
    ManualBacktestVersion,
)
from .services.calculations import compute_result_fields

LOCKED_VERSION_FIELDS = {
    'context_rules',
    'setup_rules',
    'entry_rules',
    'stop_rules',
    'exit_rules',
    'invalidation_rules',
    'notes',
}


def _validate_timezone(value: str) -> str:
    if not value:
        return 'America/New_York'
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, Exception) as exc:
        raise serializers.ValidationError('Fuseau horaire inconnu.') from exc
    return value


class ManualBacktestVersionSerializer(serializers.ModelSerializer):
    is_locked = serializers.BooleanField(read_only=True)
    observation_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = ManualBacktestVersion
        fields = [
            'id',
            'strategy',
            'version',
            'context_rules',
            'setup_rules',
            'entry_rules',
            'stop_rules',
            'exit_rules',
            'invalidation_rules',
            'notes',
            'locked_at',
            'is_locked',
            'observation_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'strategy',
            'version',
            'locked_at',
            'created_at',
            'updated_at',
        ]

    def validate(self, attrs):
        instance = self.instance
        if not instance or not instance.is_locked:
            return attrs
        for field in LOCKED_VERSION_FIELDS:
            if field not in attrs:
                continue
            if attrs[field] != getattr(instance, field):
                raise serializers.ValidationError(
                    {
                        field: (
                            'Version verrouillée. Dupliquez-la pour modifier les règles.'
                        )
                    }
                )
        return attrs


class ManualBacktestStrategySerializer(serializers.ModelSerializer):
    versions = ManualBacktestVersionSerializer(many=True, read_only=True)
    latest_version = serializers.SerializerMethodField()
    campaign_count = serializers.IntegerField(read_only=True, required=False)
    position_strategy = serializers.PrimaryKeyRelatedField(
        queryset=PositionStrategy.objects.all(),
        required=False,
    )
    position_strategy_title = serializers.SerializerMethodField()
    position_strategy_content = serializers.SerializerMethodField()

    class Meta:
        model = ManualBacktestStrategy
        fields = [
            'id',
            'name',
            'description',
            'default_instrument',
            'status',
            'position_strategy',
            'position_strategy_title',
            'position_strategy_content',
            'versions',
            'latest_version',
            'campaign_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'name',
            'description',
            'created_at',
            'updated_at',
        ]

    def validate_position_strategy(self, value: PositionStrategy) -> PositionStrategy:
        request = self.context.get('request')
        if not request or value.user_id != request.user.id:
            raise serializers.ValidationError('Stratégie introuvable.')
        if self.instance:
            return value
        if not value.is_current:
            raise serializers.ValidationError(
                'Choisissez la version actuelle de la stratégie de position.'
            )
        return value

    def validate(self, attrs):
        if not self.instance and not attrs.get('position_strategy'):
            raise serializers.ValidationError(
                {'position_strategy': 'Choisissez une stratégie de position.'}
            )
        return attrs

    def create(self, validated_data):
        position_strategy = validated_data['position_strategy']
        validated_data['name'] = position_strategy.title
        validated_data['description'] = position_strategy.description or ''
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop('position_strategy', None)
        return super().update(instance, validated_data)

    def get_position_strategy_title(self, obj) -> str:
        if obj.position_strategy_id and obj.position_strategy:
            return obj.position_strategy.title
        return obj.name

    def get_position_strategy_content(self, obj):
        if obj.position_strategy_id and obj.position_strategy:
            return obj.position_strategy.strategy_content or {'sections': []}
        return {'sections': []}

    def get_latest_version(self, obj):
        versions = list(obj.versions.all())
        if not versions:
            return None
        latest = max(versions, key=lambda item: item.version)
        return ManualBacktestVersionSerializer(latest, context=self.context).data


class ManualBacktestStrategyListSerializer(serializers.ModelSerializer):
    latest_version_id = serializers.IntegerField(read_only=True, required=False)
    latest_version_number = serializers.IntegerField(read_only=True, required=False)
    campaign_count = serializers.IntegerField(read_only=True, required=False)
    is_latest_locked = serializers.SerializerMethodField()

    def get_is_latest_locked(self, obj) -> bool:
        return bool(getattr(obj, 'is_latest_locked', None))

    class Meta:
        model = ManualBacktestStrategy
        fields = [
            'id',
            'name',
            'description',
            'default_instrument',
            'status',
            'position_strategy',
            'latest_version_id',
            'latest_version_number',
            'is_latest_locked',
            'campaign_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields


class ManualBacktestCampaignSerializer(serializers.ModelSerializer):
    strategy_id = serializers.IntegerField(source='strategy_version.strategy_id', read_only=True)
    strategy_name = serializers.CharField(source='strategy_version.strategy.name', read_only=True)
    version_number = serializers.IntegerField(source='strategy_version.version', read_only=True)
    observation_count = serializers.IntegerField(read_only=True, required=False)
    is_version_locked = serializers.BooleanField(
        source='strategy_version.is_locked', read_only=True
    )

    class Meta:
        model = ManualBacktestCampaign
        fields = [
            'id',
            'strategy_version',
            'strategy_id',
            'strategy_name',
            'version_number',
            'name',
            'instrument',
            'period_start',
            'period_end',
            'session_start',
            'session_end',
            'timezone',
            'observation_goal',
            'commission',
            'slippage',
            'require_refusal_reason',
            'notes',
            'status',
            'observation_count',
            'is_version_locked',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'instrument': {'allow_blank': True},
        }

    def validate_timezone(self, value):
        return _validate_timezone(value)

    def validate(self, attrs):
        period_start = attrs.get('period_start') or getattr(self.instance, 'period_start', None)
        period_end = attrs.get('period_end') or getattr(self.instance, 'period_end', None)
        if period_start and period_end and period_end < period_start:
            raise serializers.ValidationError(
                {'period_end': 'La fin doit être postérieure au début.'}
            )

        strategy_version = attrs.get('strategy_version') or getattr(
            self.instance, 'strategy_version', None
        )
        request = self.context.get('request')
        if strategy_version and request:
            if strategy_version.strategy.user_id != request.user.id:
                raise serializers.ValidationError(
                    {'strategy_version': 'Version introuvable.'}
                )

        if self.instance and 'strategy_version' in attrs:
            if self.instance.observations.exists() and (
                attrs['strategy_version'].pk != self.instance.strategy_version_id
            ):
                raise serializers.ValidationError(
                    {
                        'strategy_version': (
                            'Impossible de changer de version après la première observation.'
                        )
                    }
                )
        return attrs


class ManualBacktestObservationSerializer(serializers.ModelSerializer):
    warnings = serializers.SerializerMethodField()
    screenshot_before_url = serializers.CharField(allow_blank=True, required=False)
    screenshot_after_url = serializers.CharField(allow_blank=True, required=False)

    class Meta:
        model = ManualBacktestObservation
        fields = [
            'id',
            'campaign',
            'market_datetime',
            'direction',
            'setup_valid',
            'trade_taken',
            'refusal_reason',
            'entry_price',
            'initial_stop_price',
            'target_price',
            'exit_price',
            'quantity',
            'fees',
            'slippage',
            'result_status',
            'result_r',
            'result_r_source',
            'result_points',
            'mfe',
            'mae',
            'context',
            'structure',
            'notes',
            'screenshot_before_url',
            'screenshot_after_url',
            'sort_index',
            'warnings',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'result_points', 'created_at', 'updated_at']

    def get_warnings(self, obj):
        return getattr(obj, '_warnings', [])

    def validate_campaign(self, campaign):
        request = self.context.get('request')
        if request and campaign.user_id != request.user.id:
            raise serializers.ValidationError('Campagne introuvable.')
        return campaign

    def validate_screenshot_before_url(self, value):
        user = self.context['request'].user
        return normalize_screenshot_url_for_storage(value, user.pk) or ''

    def validate_screenshot_after_url(self, value):
        user = self.context['request'].user
        return normalize_screenshot_url_for_storage(value, user.pk) or ''

    def validate(self, attrs):
        instance = self.instance
        campaign = attrs.get('campaign') or getattr(instance, 'campaign', None)
        if instance and 'campaign' in attrs and attrs['campaign'].pk != instance.campaign_id:
            raise serializers.ValidationError(
                {'campaign': 'Changement de campagne interdit.'}
            )

        merged = {}
        if instance:
            for field in self.Meta.fields:
                if field in {'id', 'warnings', 'created_at', 'updated_at'}:
                    continue
                merged[field] = getattr(instance, field)
        merged.update(attrs)

        trade_taken = merged.get('trade_taken', True)
        if (
            campaign
            and campaign.require_refusal_reason
            and not trade_taken
            and not (merged.get('refusal_reason') or '').strip()
        ):
            raise serializers.ValidationError(
                {'refusal_reason': 'Motif de refus obligatoire.'}
            )

        if merged.get('result_status') == 'PARTIAL':
            has_exit = merged.get('exit_price') not in (None, '')
            source = merged.get('result_r_source') or 'calculated'
            if not has_exit and source != 'manual':
                raise serializers.ValidationError(
                    {
                        'result_r': (
                            'Trade partiel : saisissez un R manuel ou un prix de sortie.'
                        )
                    }
                )

        compute_payload = {
            'direction': merged.get('direction'),
            'entry_price': merged.get('entry_price'),
            'initial_stop_price': merged.get('initial_stop_price'),
            'target_price': merged.get('target_price'),
            'exit_price': merged.get('exit_price'),
            'result_status': merged.get('result_status'),
            'result_r': merged.get('result_r'),
            'result_r_source': merged.get('result_r_source'),
            'allow_stop_side_override': self.initial_data.get(
                'allow_stop_side_override', False
            )
            if hasattr(self, 'initial_data')
            else False,
            'allow_target_side_override': self.initial_data.get(
                'allow_target_side_override', False
            )
            if hasattr(self, 'initial_data')
            else False,
        }
        computed = compute_result_fields(compute_payload)
        attrs['result_r'] = computed.get('result_r', merged.get('result_r'))
        attrs['result_r_source'] = computed.get('result_r_source')
        attrs['result_points'] = computed.get('result_points')
        self._warnings = computed.get('_warnings') or []
        return attrs

    def create(self, validated_data):
        request = self.context['request']
        campaign = validated_data['campaign']
        if validated_data.get('sort_index') is None:
            max_index = campaign.observations.aggregate(m=Max('sort_index'))['m'] or 0
            validated_data['sort_index'] = max_index + 1
        obj = ManualBacktestObservation.objects.create(
            user=request.user, **validated_data
        )
        obj._warnings = getattr(self, '_warnings', [])
        self._lock_version(campaign)
        return obj

    def update(self, instance, validated_data):
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        instance._warnings = getattr(self, '_warnings', [])
        return instance

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        uid = getattr(getattr(request, 'user', None), 'pk', None)
        for key in ('screenshot_before_url', 'screenshot_after_url'):
            val = data.get(key) or ''
            if val and uid:
                data[key] = transform_screenshot_url_for_response(val, uid, request)
        data['warnings'] = getattr(instance, '_warnings', []) or getattr(
            self, '_warnings', []
        )
        return data

    @staticmethod
    def _lock_version(campaign: ManualBacktestCampaign) -> None:
        version = campaign.strategy_version
        if version.locked_at is None:
            version.locked_at = timezone.now()
            version.save(update_fields=['locked_at'])


class ObservationBulkItemSerializer(ManualBacktestObservationSerializer):
    client_key = serializers.CharField(required=False, allow_blank=True, write_only=True)
    id = serializers.IntegerField(required=False)

    class Meta(ManualBacktestObservationSerializer.Meta):
        fields = ManualBacktestObservationSerializer.Meta.fields + ['client_key']
        extra_kwargs = {
            'campaign': {'required': False},
        }


def next_version_number(strategy: ManualBacktestStrategy) -> int:
    current = strategy.versions.aggregate(m=Max('version'))['m'] or 0
    return current + 1
