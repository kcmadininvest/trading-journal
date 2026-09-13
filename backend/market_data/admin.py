from django.contrib import admin

from .models import (
    BarCoverage,
    BarQualityIssue,
    FuturesContract,
    HistoricalBar,
    HistoricalDownloadJob,
    HistoricalSyncSettings,
    HistoricalSyncTarget,
)


@admin.register(FuturesContract)
class FuturesContractAdmin(admin.ModelAdmin):
    list_display = (
        'contract_id',
        'instrument',
        'symbol',
        'symbol_id',
        'expiry_date',
        'source',
        'updated_at',
    )
    list_filter = ('instrument', 'source')
    search_fields = ('contract_id', 'symbol', 'symbol_id', 'instrument')


@admin.register(HistoricalBar)
class HistoricalBarAdmin(admin.ModelAdmin):
    list_display = (
        'contract_id',
        'instrument',
        'timeframe',
        'timestamp_utc',
        'open',
        'high',
        'low',
        'close',
        'volume',
        'is_rth',
    )
    list_filter = ('instrument', 'timeframe', 'source')
    search_fields = ('contract_id', 'instrument')
    date_hierarchy = 'timestamp_utc'
    readonly_fields = ('fetched_at',)


@admin.register(BarCoverage)
class BarCoverageAdmin(admin.ModelAdmin):
    list_display = (
        'contract_id',
        'instrument',
        'timeframe',
        'start_utc',
        'end_utc',
        'status',
        'bars_stored',
        'bars_expected',
        'unexpected_missing_count',
    )
    list_filter = ('status', 'instrument', 'timeframe')
    search_fields = ('contract_id', 'instrument')


@admin.register(HistoricalDownloadJob)
class HistoricalDownloadJobAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'user',
        'instrument',
        'contract_id',
        'trigger',
        'status',
        'progress_pct',
        'bars_fetched',
        'created_at',
    )
    list_filter = ('status', 'trigger', 'instrument')
    search_fields = ('instrument', 'contract_id', 'error')
    readonly_fields = ('created_at', 'updated_at', 'started_at', 'finished_at')


class HistoricalSyncTargetInline(admin.TabularInline):
    model = HistoricalSyncTarget
    extra = 0


@admin.register(HistoricalSyncSettings)
class HistoricalSyncSettingsAdmin(admin.ModelAdmin):
    list_display = (
        'user',
        'enabled',
        'hour',
        'minute',
        'last_run_local_date',
        'last_run_at',
    )
    list_filter = ('enabled',)
    search_fields = ('user__username', 'user__email')
    inlines = [HistoricalSyncTargetInline]


@admin.register(BarQualityIssue)
class BarQualityIssueAdmin(admin.ModelAdmin):
    list_display = (
        'issue_type',
        'severity',
        'contract_id',
        'timestamp_utc',
        'job',
        'created_at',
    )
    list_filter = ('issue_type', 'severity')
    search_fields = ('contract_id', 'instrument')
