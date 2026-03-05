from typing import Any, Dict, Optional
from rest_framework import serializers
from .models_analytics import (
    TradeContext,
    TradeSetup,
    SessionContext,
    TradeExecution,
)
from .models_statistics import (
    TradeProbabilityFactor,
    TradeTag,
    TradeTagAssignment,
    TradeStatistics,
    ConditionalProbability,
)


class TradeContextSerializer(serializers.ModelSerializer):
    """Serializer pour le contexte de marché d'un trade."""
    
    class Meta:
        model = TradeContext
        fields = [
            'id',
            'trade',
            'trend_m1',
            'trend_m2',
            'trend_m5',
            'trend_m15',
            'trend_m30',
            'trend_h1',
            'trend_h4',
            'trend_daily',
            'trend_weekly',
            'trend_alignment',
            'fibonacci_level',
            'at_support_resistance',
            'distance_from_key_level',
            'market_structure',
            'break_of_structure',
            'within_previous_day_range',
            'range_position',
            'atr_percentile',
            'volume_profile',
            'at_volume_node',
            'rsi_value',
            'macd_signal',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'trend_alignment', 'created_at', 'updated_at']


class TradeSetupSerializer(serializers.ModelSerializer):
    """Serializer pour le setup de trading."""
    
    class Meta:
        model = TradeSetup
        fields = [
            'id',
            'trade',
            'setup_category',
            'setup_subcategory',
            'chart_pattern',
            'confluence_factors',
            'confluence_count',
            'setup_quality',
            'setup_confidence',
            'entry_timing',
            'entry_in_range_percentage',
            'missed_better_entry',
            'planned_hold_duration',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'confluence_count', 'created_at', 'updated_at']


class SessionContextSerializer(serializers.ModelSerializer):
    """Serializer pour le contexte de session."""
    
    class Meta:
        model = SessionContext
        fields = [
            'id',
            'trade',
            'trading_session',
            'session_time_slot',
            'news_events',
            'day_of_week',
            'is_first_trade_of_day',
            'is_last_trade_of_day',
            'physical_state',
            'mental_state',
            'hours_of_sleep',
            'previous_trade_result',
            'minutes_since_last_trade',
            'trade_motivation',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'minutes_since_last_trade', 'created_at', 'updated_at']


class TradeExecutionSerializer(serializers.ModelSerializer):
    """Serializer pour l'exécution du trade."""
    
    class Meta:
        model = TradeExecution
        fields = [
            'id',
            'trade',
            'followed_trading_plan',
            'entry_as_planned',
            'exit_as_planned',
            'position_size_as_planned',
            'moved_stop_loss',
            'stop_loss_direction',
            'partial_exit_taken',
            'partial_exit_percentage',
            'exit_reason',
            'execution_errors',
            'slippage_points',
            'would_take_again',
            'lesson_learned',
            'time_in_position_vs_planned',
            'exit_emotional_context',
            'position_size_change_reason',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'followed_trading_plan', 'created_at', 'updated_at']


class TradeProbabilityFactorSerializer(serializers.ModelSerializer):
    """Serializer pour les facteurs de probabilité."""
    
    class Meta:
        model = TradeProbabilityFactor
        fields = [
            'id',
            'factor_category',
            'factor_name',
            'factor_type',
            'possible_values',
            'description',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class TradeTagSerializer(serializers.ModelSerializer):
    """Serializer pour les tags de trades."""
    
    class Meta:
        model = TradeTag
        fields = [
            'id',
            'user',
            'name',
            'color',
            'category',
            'description',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']
    
    def create(self, validated_data):
        # Ajouter automatiquement l'utilisateur depuis le contexte de la requête
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class TradeTagAssignmentSerializer(serializers.ModelSerializer):
    """Serializer pour l'attribution de tags aux trades."""
    
    tag_details = TradeTagSerializer(source='tag', read_only=True)
    
    class Meta:
        model = TradeTagAssignment
        fields = [
            'id',
            'trade',
            'tag',
            'tag_details',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class TradeStatisticsSerializer(serializers.ModelSerializer):
    """Serializer pour les statistiques de trades."""
    
    class Meta:
        model = TradeStatistics
        fields = [
            'id',
            'user',
            'trading_account',
            'filter_criteria',
            'total_trades',
            'winning_trades',
            'losing_trades',
            'win_rate',
            'average_win',
            'average_loss',
            'profit_factor',
            'expectancy',
            'largest_win',
            'largest_loss',
            'average_duration',
            'calculated_at',
            'created_at',
        ]
        read_only_fields = ['id', 'user', 'calculated_at', 'created_at']


class ConditionalProbabilitySerializer(serializers.ModelSerializer):
    """Serializer pour les probabilités conditionnelles."""
    
    class Meta:
        model = ConditionalProbability
        fields = [
            'id',
            'user',
            'condition_set',
            'sample_size',
            'win_rate',
            'average_rr',
            'expectancy',
            'confidence_interval',
            'is_statistically_significant',
            'calculated_at',
            'created_at',
        ]
        read_only_fields = ['id', 'user', 'is_statistically_significant', 'calculated_at', 'created_at']


# Serializers combinés pour affichage complet

class TradeWithAnalyticsSerializer(serializers.Serializer):
    """
    Serializer pour afficher un trade avec toutes ses données analytiques.
    Utilisé pour les vues détaillées.
    """
    
    trade_id = serializers.IntegerField()
    contract_name = serializers.CharField()
    entered_at = serializers.DateTimeField()
    exited_at = serializers.DateTimeField()
    net_pnl = serializers.DecimalField(max_digits=15, decimal_places=2)
    
    # Données analytiques (optionnelles)
    context = serializers.SerializerMethodField()  # type: ignore[assignment]
    setup = serializers.SerializerMethodField()  # type: ignore[assignment]
    session_context = serializers.SerializerMethodField()  # type: ignore[assignment]
    execution = serializers.SerializerMethodField()  # type: ignore[assignment]
    tags = serializers.SerializerMethodField()  # type: ignore[assignment]
    
    def get_context(self, obj):
        if 'context' in obj and obj['context']:
            return TradeContextSerializer(obj['context']).data
        return None
    
    def get_setup(self, obj):
        if 'setup' in obj and obj['setup']:
            return TradeSetupSerializer(obj['setup']).data
        return None
    
    def get_session_context(self, obj):
        if 'session_context' in obj and obj['session_context']:
            return SessionContextSerializer(obj['session_context']).data
        return None
    
    def get_execution(self, obj):
        if 'execution' in obj and obj['execution']:
            return TradeExecutionSerializer(obj['execution']).data
        return None
    
    def get_tags(self, obj):
        if 'tags' in obj and obj['tags']:
            return TradeTagSerializer(obj['tags'], many=True).data
        return []


class NestedTradeContextSerializer(serializers.ModelSerializer):
    """Serializer pour le contexte de marché dans bulk create (sans champ trade obligatoire)."""
    
    class Meta:
        model = TradeContext
        fields = [
            'trend_m1', 'trend_m2', 'trend_m5', 'trend_m15', 'trend_m30',
            'trend_h1', 'trend_h4', 'trend_daily', 'trend_weekly',
            'fibonacci_level', 'at_support_resistance', 'distance_from_key_level',
            'market_structure', 'break_of_structure', 'within_previous_day_range',
            'range_position', 'atr_percentile', 'volume_profile', 'at_volume_node',
            'rsi_value', 'macd_signal',
        ]


class NestedTradeSetupSerializer(serializers.ModelSerializer):
    """Serializer pour le setup dans bulk create (sans champ trade obligatoire)."""
    
    class Meta:
        model = TradeSetup
        fields = [
            'setup_category', 'setup_subcategory', 'chart_pattern',
            'confluence_factors', 'setup_quality', 'setup_confidence', 'entry_timing',
            'entry_in_range_percentage', 'missed_better_entry', 'planned_hold_duration',
        ]


class NestedSessionContextSerializer(serializers.ModelSerializer):
    """Serializer pour le contexte de session dans bulk create (sans champ trade obligatoire)."""
    
    class Meta:
        model = SessionContext
        fields = [
            'trading_session', 'session_time_slot', 'news_events', 'day_of_week',
            'is_first_trade_of_day', 'is_last_trade_of_day', 'physical_state',
            'mental_state', 'hours_of_sleep', 'previous_trade_result', 'trade_motivation',
        ]


class NestedTradeExecutionSerializer(serializers.ModelSerializer):
    """Serializer pour l'exécution dans bulk create (sans champ trade obligatoire)."""
    
    class Meta:
        model = TradeExecution
        fields = [
            'followed_trading_plan', 'entry_as_planned', 'exit_as_planned',
            'position_size_as_planned', 'moved_stop_loss', 'stop_loss_direction',
            'partial_exit_taken', 'partial_exit_percentage', 'exit_reason',
            'execution_errors', 'slippage_points', 'would_take_again', 'lesson_learned',
            'time_in_position_vs_planned', 'exit_emotional_context', 'position_size_change_reason',
        ]


class BulkTradeAnalyticsSerializer(serializers.Serializer):
    """
    Serializer pour créer en masse les données analytiques pour un trade.
    Permet de créer context, setup, session_context et execution en une seule requête.
    """
    
    trade_id: serializers.IntegerField = serializers.IntegerField()
    context: NestedTradeContextSerializer = NestedTradeContextSerializer(required=False, allow_null=True)
    setup: NestedTradeSetupSerializer = NestedTradeSetupSerializer(required=False, allow_null=True)
    session_context: NestedSessionContextSerializer = NestedSessionContextSerializer(required=False, allow_null=True)
    execution: NestedTradeExecutionSerializer = NestedTradeExecutionSerializer(required=False, allow_null=True)
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True
    )
