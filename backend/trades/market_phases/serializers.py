from __future__ import annotations

from datetime import datetime

from django.utils.dateparse import parse_date, parse_time
from rest_framework import serializers

from .models import (
    MarketPhaseDefinition,
    MarketPhaseEventDefinition,
    MarketPhaseSlotConfig,
    SessionMarketPhaseBlock,
    SessionMarketPhaseEvent,
)


class MarketPhaseDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarketPhaseDefinition
        fields = [
            'id', 'code', 'label', 'color', 'is_system', 'is_active', 'sort_order',
        ]
        read_only_fields = ['is_system']


class MarketPhaseEventDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarketPhaseEventDefinition
        fields = [
            'id', 'code', 'label', 'category', 'is_system', 'is_active', 'sort_order',
        ]
        read_only_fields = ['is_system']


class MarketPhaseSlotConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarketPhaseSlotConfig
        fields = [
            'mode',
            'duration_minutes',
            'anchor',
            'market_code',
            'custom_boundaries',
            'custom_analytical_periods',
            'default_instrument_key',
        ]


class SessionMarketPhaseEventSerializer(serializers.ModelSerializer):
    event_type_code = serializers.CharField(source='event_type.code', read_only=True)
    event_type_label = serializers.CharField(source='event_type.label', read_only=True)
    occurred_at = serializers.TimeField(format='%H:%M')

    class Meta:
        model = SessionMarketPhaseEvent
        fields = [
            'id',
            'occurred_at',
            'event_type',
            'event_type_code',
            'event_type_label',
            'direction',
            'candle_part',
            'outcome',
            'parent_block',
            'attributes',
            'source',
        ]


class SessionMarketPhaseBlockSerializer(serializers.ModelSerializer):
    phase_code = serializers.CharField(source='phase.code', read_only=True)
    phase_label = serializers.CharField(source='phase.label', read_only=True)
    phase_color = serializers.CharField(source='phase.color', read_only=True)
    events = SessionMarketPhaseEventSerializer(many=True, read_only=True)
    range_start = serializers.TimeField(format='%H:%M')
    range_end = serializers.TimeField(format='%H:%M', allow_null=True, required=False)

    class Meta:
        model = SessionMarketPhaseBlock
        fields = [
            'id',
            'instrument_key',
            'range_start',
            'range_end',
            'phase',
            'phase_code',
            'phase_label',
            'phase_color',
            'preceding_context',
            'notes',
            'source',
            'events',
        ]


class CaptureBulkSerializer(serializers.Serializer):
    session_date = serializers.DateField()
    trading_account = serializers.IntegerField()
    instrument_key = serializers.CharField(max_length=32)
    source = serializers.ChoiceField(choices=['live', 'replay'], default='live')
    trading_session = serializers.IntegerField(required=False, allow_null=True)
    blocks = serializers.ListField(child=serializers.DictField(), default=list)
    events = serializers.ListField(child=serializers.DictField(), default=list)

    def validate_blocks(self, value):
        parsed = []
        for item in value:
            rs = item.get('range_start')
            if isinstance(rs, str):
                rs = parse_time(rs)
            if rs is None:
                raise serializers.ValidationError('range_start requis pour chaque bloc.')
            re = item.get('range_end')
            if isinstance(re, str):
                re = parse_time(re) if re else None
            parsed.append({**item, 'range_start': rs, 'range_end': re})
        return parsed

    def validate_events(self, value):
        parsed = []
        for item in value:
            at = item.get('occurred_at')
            if isinstance(at, str):
                at = parse_time(at)
            if at is None:
                raise serializers.ValidationError('occurred_at requis pour chaque événement.')
            parsed.append({**item, 'occurred_at': at})
        return parsed


class MarketPhaseDefinitionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarketPhaseDefinition
        fields = ['code', 'label', 'color']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        validated_data['is_system'] = False
        return super().create(validated_data)
