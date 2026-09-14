from django.contrib import admin

from .models import (
    ManualBacktestCampaign,
    ManualBacktestObservation,
    ManualBacktestStrategy,
    ManualBacktestVersion,
)


@admin.register(ManualBacktestStrategy)
class ManualBacktestStrategyAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'name', 'position_strategy', 'status', 'updated_at')
    list_filter = ('status',)
    search_fields = ('name', 'user__email', 'user__username', 'position_strategy__title')
    raw_id_fields = ('user', 'position_strategy')


@admin.register(ManualBacktestVersion)
class ManualBacktestVersionAdmin(admin.ModelAdmin):
    list_display = ('id', 'strategy', 'version', 'locked_at', 'updated_at')
    list_filter = ('locked_at',)


@admin.register(ManualBacktestCampaign)
class ManualBacktestCampaignAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'user',
        'name',
        'instrument',
        'status',
        'updated_at',
    )
    list_filter = ('status', 'instrument')
    search_fields = ('name', 'instrument')


@admin.register(ManualBacktestObservation)
class ManualBacktestObservationAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'campaign',
        'market_datetime',
        'exit_datetime',
        'direction',
        'trade_taken',
        'result_status',
        'result_r',
    )
    list_filter = ('direction', 'trade_taken', 'result_status')
