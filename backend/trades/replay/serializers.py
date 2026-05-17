from rest_framework import serializers

from trades.models import (
    SessionEvent,
    SessionInsight,
    SessionJournalDraft,
    TradingSession,
)


class SessionEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = SessionEvent
        fields = [
            'id',
            'event_type',
            'source',
            'external_id',
            'sequence',
            'occurred_at',
            'payload',
            'trade_id',
        ]


class SessionInsightSerializer(serializers.ModelSerializer):
    class Meta:
        model = SessionInsight
        fields = ['id', 'code', 'severity', 'message', 'occurred_at', 'context']


class SessionJournalDraftSerializer(serializers.ModelSerializer):
    class Meta:
        model = SessionJournalDraft
        fields = ['content', 'applied_at', 'applied_entry_id', 'updated_at']


class TradingSessionSerializer(serializers.ModelSerializer):
    trading_account_name = serializers.CharField(source='trading_account.name', read_only=True)
    journal_draft = SessionJournalDraftSerializer(read_only=True)
    insight_count = serializers.SerializerMethodField()
    event_count = serializers.SerializerMethodField()

    class Meta:
        model = TradingSession
        fields = [
            'id',
            'trading_account',
            'trading_account_name',
            'session_date',
            'status',
            'started_at',
            'ended_at',
            'trade_count',
            'net_pnl',
            'max_drawdown_intraday',
            'build_error',
            'built_at',
            'created_at',
            'updated_at',
            'journal_draft',
            'insight_count',
            'event_count',
        ]
        read_only_fields = [
            'id',
            'trading_account',
            'trading_account_name',
            'session_date',
            'status',
            'started_at',
            'ended_at',
            'trade_count',
            'net_pnl',
            'max_drawdown_intraday',
            'build_error',
            'built_at',
            'created_at',
            'updated_at',
            'journal_draft',
            'insight_count',
            'event_count',
        ]

    def get_insight_count(self, obj: TradingSession) -> int:
        return obj.insights.count()

    def get_event_count(self, obj: TradingSession) -> int:
        return obj.events.count()


class SessionBuildRequestSerializer(serializers.Serializer):
    trading_account = serializers.IntegerField()
    session_date = serializers.DateField()
