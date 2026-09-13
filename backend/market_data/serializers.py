from rest_framework import serializers

from market_data.models import (
    BarQualityIssue,
    HistoricalDownloadJob,
    HistoricalSyncSettings,
    HistoricalSyncTarget,
)
from market_data.services.timeframes import ALLOWED_TIMEFRAMES, UnknownTimeframe, parse_timeframe


class DownloadJobCreateSerializer(serializers.Serializer):
    instrument = serializers.CharField(max_length=16)
    contract_id = serializers.CharField(max_length=64, required=False, allow_blank=True, default='')
    timeframe = serializers.ChoiceField(choices=ALLOWED_TIMEFRAMES, default='1m')
    start = serializers.DateTimeField()
    end = serializers.DateTimeField()

    def validate(self, attrs):
        if attrs['start'] >= attrs['end']:
            raise serializers.ValidationError('start doit être antérieur à end.')
        attrs['instrument'] = attrs['instrument'].upper().strip()
        attrs['contract_id'] = (attrs.get('contract_id') or '').strip()
        raw_tf = (attrs.get('timeframe') or '1m').strip()
        try:
            attrs['timeframe'] = parse_timeframe(raw_tf).code
        except UnknownTimeframe as exc:
            raise serializers.ValidationError({'timeframe': str(exc)}) from exc
        return attrs


class DownloadJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = HistoricalDownloadJob
        fields = (
            'id',
            'instrument',
            'contract_id',
            'timeframe',
            'trigger',
            'start_utc',
            'end_utc',
            'status',
            'progress_pct',
            'bars_fetched',
            'chunks_done',
            'last_chunk_end',
            'error',
            'created_at',
            'started_at',
            'finished_at',
        )


class QualityIssueSerializer(serializers.ModelSerializer):
    class Meta:
        model = BarQualityIssue
        fields = (
            'id',
            'issue_type',
            'severity',
            'instrument',
            'contract_id',
            'timeframe',
            'timestamp_utc',
            'details',
            'created_at',
        )


class SyncTargetSerializer(serializers.Serializer):
    instrument = serializers.CharField(max_length=16)
    timeframe = serializers.ChoiceField(choices=ALLOWED_TIMEFRAMES, default='1m')
    contract_id = serializers.CharField(max_length=64, required=False, allow_blank=True, default='')
    ordering = serializers.IntegerField(required=False, min_value=0, default=0)

    def validate(self, attrs):
        attrs['instrument'] = attrs['instrument'].upper().strip()
        attrs['contract_id'] = (attrs.get('contract_id') or '').strip()
        try:
            attrs['timeframe'] = parse_timeframe(attrs.get('timeframe') or '1m').code
        except UnknownTimeframe as exc:
            raise serializers.ValidationError({'timeframe': str(exc)}) from exc
        return attrs


class SyncSettingsSerializer(serializers.Serializer):
    enabled = serializers.BooleanField(default=False)
    hour = serializers.IntegerField(min_value=0, max_value=23, default=2)
    minute = serializers.IntegerField(min_value=0, max_value=59, default=0)
    targets = SyncTargetSerializer(many=True, required=False)
    last_run_local_date = serializers.DateField(read_only=True)
    last_run_at = serializers.DateTimeField(read_only=True)
    last_error = serializers.CharField(read_only=True)

    def to_representation(self, instance: HistoricalSyncSettings):
        targets = [
            {
                'instrument': t.instrument,
                'timeframe': t.timeframe,
                'contract_id': t.contract_id,
                'ordering': t.ordering,
            }
            for t in instance.targets.all()
        ]
        return {
            'enabled': instance.enabled,
            'hour': instance.hour,
            'minute': instance.minute,
            'targets': targets,
            'last_run_local_date': instance.last_run_local_date,
            'last_run_at': instance.last_run_at,
            'last_error': instance.last_error,
        }

    def update(self, instance: HistoricalSyncSettings, validated_data):
        instance.enabled = validated_data.get('enabled', instance.enabled)
        instance.hour = validated_data.get('hour', instance.hour)
        instance.minute = validated_data.get('minute', instance.minute)
        instance.save(update_fields=['enabled', 'hour', 'minute', 'updated_at'])

        if 'targets' in validated_data:
            instance.targets.all().delete()
            for idx, raw in enumerate(validated_data['targets']):
                HistoricalSyncTarget.objects.create(
                    settings=instance,
                    instrument=raw['instrument'],
                    timeframe=raw['timeframe'],
                    contract_id=raw.get('contract_id') or '',
                    ordering=raw.get('ordering', idx),
                )
        return instance
