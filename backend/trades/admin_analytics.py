"""
Configuration de l'admin Django pour les modèles d'analyse.
"""
from django.contrib import admin
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


@admin.register(TradeContext)
class TradeContextAdmin(admin.ModelAdmin):
    """Admin pour les contextes de marché."""
    
    list_display = [
        'trade',
        'trend_m15',
        'trend_m5',
        'trend_h1',
        'trend_alignment',
        'fibonacci_level',
        'created_at',
    ]
    list_filter = [
        'trend_m15',
        'trend_m5',
        'trend_h1',
        'trend_alignment',
        'fibonacci_level',
        'at_support_resistance',
    ]
    search_fields = ['trade__contract_name']
    readonly_fields = ['trend_alignment', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Trade', {
            'fields': ('trade',)
        }),
        ('Tendances Multi-Timeframe', {
            'fields': ('trend_m15', 'trend_m5', 'trend_h1', 'trend_alignment')
        }),
        ('Niveaux Techniques', {
            'fields': ('fibonacci_level', 'at_support_resistance', 'distance_from_key_level')
        }),
        ('Structure de Marché', {
            'fields': ('market_structure', 'break_of_structure')
        }),
        ('Range et Volatilité', {
            'fields': ('within_previous_day_range', 'range_position', 'atr_percentile')
        }),
        ('Volume et Indicateurs', {
            'fields': ('volume_profile', 'at_volume_node', 'rsi_value', 'macd_signal')
        }),
        ('Métadonnées', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(TradeSetup)
class TradeSetupAdmin(admin.ModelAdmin):
    """Admin pour les setups de trading."""
    
    list_display = [
        'trade',
        'setup_category',
        'setup_quality',
        'confluence_count',
        'chart_pattern',
        'created_at',
    ]
    list_filter = [
        'setup_category',
        'setup_quality',
        'chart_pattern',
        'entry_timing',
    ]
    search_fields = ['trade__contract_name', 'setup_subcategory']
    readonly_fields = ['confluence_count', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Trade', {
            'fields': ('trade',)
        }),
        ('Classification', {
            'fields': ('setup_category', 'setup_subcategory', 'chart_pattern')
        }),
        ('Confluence', {
            'fields': ('confluence_factors', 'confluence_count')
        }),
        ('Qualité', {
            'fields': ('setup_quality', 'setup_confidence', 'entry_timing')
        }),
        ('Métadonnées', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(SessionContext)
class SessionContextAdmin(admin.ModelAdmin):
    """Admin pour les contextes de session."""
    
    list_display = [
        'trade',
        'trading_session',
        'day_of_week',
        'has_news_events',
        'physical_state',
        'mental_state',
        'created_at',
    ]
    list_filter = [
        'trading_session',
        'day_of_week',
        'physical_state',
        'mental_state',
    ]
    search_fields = ['trade__contract_name']
    readonly_fields = ['created_at', 'updated_at']
    
    def has_news_events(self, obj):
        """Indique si des événements externes sont présents."""
        return bool(obj.news_events and len(obj.news_events) > 0)
    has_news_events.boolean = True
    has_news_events.short_description = 'Événements'
    
    fieldsets = (
        ('Trade', {
            'fields': ('trade',)
        }),
        ('Session', {
            'fields': ('trading_session', 'session_time_slot', 'day_of_week', 'is_first_trade_of_day', 'is_last_trade_of_day')
        }),
        ('Événements Externes', {
            'fields': ('news_events',)
        }),
        ('État du Trader', {
            'fields': ('physical_state', 'mental_state')
        }),
        ('Contexte Personnel', {
            'fields': ('hours_of_sleep',)
        }),
        ('Métadonnées', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(TradeExecution)
class TradeExecutionAdmin(admin.ModelAdmin):
    """Admin pour les exécutions de trades."""
    
    list_display = [
        'trade',
        'followed_trading_plan',
        'exit_reason',
        'would_take_again',
        'created_at',
    ]
    list_filter = [
        'followed_trading_plan',
        'entry_as_planned',
        'exit_as_planned',
        'position_size_as_planned',
        'exit_reason',
        'moved_stop_loss',
        'partial_exit_taken',
    ]
    search_fields = ['trade__contract_name', 'lesson_learned']
    readonly_fields = ['followed_trading_plan', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Trade', {
            'fields': ('trade',)
        }),
        ('Respect du Plan', {
            'fields': ('followed_trading_plan', 'entry_as_planned', 'exit_as_planned', 'position_size_as_planned')
        }),
        ('Gestion du Trade', {
            'fields': ('moved_stop_loss', 'stop_loss_direction', 'partial_exit_taken', 'partial_exit_percentage')
        }),
        ('Sortie', {
            'fields': ('exit_reason', 'execution_errors', 'slippage_points')
        }),
        ('Post-Trade', {
            'fields': ('would_take_again', 'lesson_learned')
        }),
        ('Métadonnées', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(TradeProbabilityFactor)
class TradeProbabilityFactorAdmin(admin.ModelAdmin):
    """Admin pour les facteurs de probabilité."""
    
    list_display = [
        'factor_name',
        'factor_category',
        'factor_type',
        'is_active',
        'created_at',
    ]
    list_filter = ['factor_category', 'factor_type', 'is_active']
    search_fields = ['factor_name', 'description']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(TradeTag)
class TradeTagAdmin(admin.ModelAdmin):
    """Admin pour les tags de trades."""
    
    list_display = [
        'name',
        'user',
        'category',
        'color',
        'created_at',
    ]
    list_filter = ['category', 'user']
    search_fields = ['name', 'description']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(TradeTagAssignment)
class TradeTagAssignmentAdmin(admin.ModelAdmin):
    """Admin pour les attributions de tags."""
    
    list_display = [
        'trade',
        'tag',
        'created_at',
    ]
    list_filter = ['tag__category']
    search_fields = ['trade__contract_name', 'tag__name']
    readonly_fields = ['created_at']


@admin.register(TradeStatistics)
class TradeStatisticsAdmin(admin.ModelAdmin):
    """Admin pour les statistiques de trades."""
    
    list_display = [
        'user',
        'trading_account',
        'total_trades',
        'win_rate',
        'expectancy',
        'profit_factor',
        'calculated_at',
    ]
    list_filter = ['user', 'trading_account']
    search_fields = ['user__username']
    readonly_fields = ['calculated_at', 'created_at']
    
    fieldsets = (
        ('Utilisateur', {
            'fields': ('user', 'trading_account', 'filter_criteria')
        }),
        ('Statistiques de Base', {
            'fields': ('total_trades', 'winning_trades', 'losing_trades')
        }),
        ('Métriques', {
            'fields': ('win_rate', 'average_win', 'average_loss', 'profit_factor', 'expectancy')
        }),
        ('Extremes', {
            'fields': ('largest_win', 'largest_loss', 'average_duration')
        }),
        ('Métadonnées', {
            'fields': ('calculated_at', 'created_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(ConditionalProbability)
class ConditionalProbabilityAdmin(admin.ModelAdmin):
    """Admin pour les probabilités conditionnelles."""
    
    list_display = [
        'user',
        'sample_size',
        'win_rate',
        'expectancy',
        'is_statistically_significant',
        'calculated_at',
    ]
    list_filter = ['user', 'is_statistically_significant']
    search_fields = ['user__username']
    readonly_fields = ['is_statistically_significant', 'calculated_at', 'created_at']
    
    fieldsets = (
        ('Utilisateur', {
            'fields': ('user', 'condition_set')
        }),
        ('Échantillon', {
            'fields': ('sample_size', 'is_statistically_significant')
        }),
        ('Métriques', {
            'fields': ('win_rate', 'average_rr', 'expectancy', 'confidence_interval')
        }),
        ('Métadonnées', {
            'fields': ('calculated_at', 'created_at'),
            'classes': ('collapse',)
        }),
    )
