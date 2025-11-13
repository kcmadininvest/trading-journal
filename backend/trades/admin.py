from django.contrib import admin
from django.utils.html import format_html
from .models import TopStepTrade, TopStepImportLog, AccountTransaction


@admin.register(TopStepTrade)
class TopStepTradeAdmin(admin.ModelAdmin):
    list_display = [
        'topstep_id',
        'contract_name',
        'trade_type',
        'formatted_entry',
        'formatted_exit',
        'size',
        'formatted_pnl_display',
        'pnl_badge',
        'duration_display',
        'user'
    ]
    list_filter = [
        'trade_type',
        'contract_name',
        'trade_day',
        'user',
        'imported_at'
    ]
    search_fields = [
        'topstep_id',
        'contract_name',
        'notes',
        'strategy'
    ]
    readonly_fields = [
        'topstep_id',
        'net_pnl',
        'pnl_percentage',
        'imported_at',
        'updated_at',
        'formatted_entry_date',
        'formatted_exit_date',
        'duration_str'
    ]
    fieldsets = (
        ('Identification', {
            'fields': ('user', 'topstep_id', 'contract_name')
        }),
        ('Détails du Trade', {
            'fields': (
                'trade_type',
                'size',
                'entered_at',
                'exited_at',
                'trade_day',
                'trade_duration',
                'duration_str'
            )
        }),
        ('Prix et Performance', {
            'fields': (
                'entry_price',
                'exit_price',
                'pnl',
                'fees',
                'commissions',
                'net_pnl',
                'pnl_percentage'
            )
        }),
        ('Notes et Stratégie', {
            'fields': ('strategy', 'notes'),
            'classes': ('collapse',)
        }),
        ('Données Techniques', {
            'fields': ('raw_data', 'imported_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    date_hierarchy = 'entered_at'
    ordering = ['-entered_at']
    
    def formatted_entry(self, obj):
        return obj.entered_at.strftime('%d/%m/%Y %H:%M')
    formatted_entry.short_description = 'Entrée'
    formatted_entry.admin_order_field = 'entered_at'
    
    def formatted_exit(self, obj):
        if obj.exited_at:
            return obj.exited_at.strftime('%d/%m/%Y %H:%M')
        return '-'
    formatted_exit.short_description = 'Sortie'
    formatted_exit.admin_order_field = 'exited_at'
    
    def formatted_pnl_display(self, obj):
        if obj.net_pnl is not None:
            return f"{obj.net_pnl:,.2f} €"
        return '-'
    formatted_pnl_display.short_description = 'PnL Net'
    formatted_pnl_display.admin_order_field = 'net_pnl'
    
    def pnl_badge(self, obj):
        if obj.net_pnl is not None:
            if obj.net_pnl > 0:
                color = 'green'
                symbol = '✓'
            elif obj.net_pnl < 0:
                color = 'red'
                symbol = '✗'
            else:
                color = 'gray'
                symbol = '='
            
            percentage = f"{obj.pnl_percentage:.2f}%" if obj.pnl_percentage else ""
            return format_html(
                '<span style="color: {}; font-weight: bold;">{} {}</span>',
                color,
                symbol,
                percentage
            )
        return '-'
    pnl_badge.short_description = 'Statut'
    
    def duration_display(self, obj):
        return obj.duration_str if obj.duration_str else '-'
    duration_display.short_description = 'Durée'
    duration_display.admin_order_field = 'trade_duration'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if not request.user.is_superuser:
            qs = qs.filter(user=request.user)
        return qs
    
    def save_model(self, request, obj, form, change):
        if not change:  # Si c'est une création
            obj.user = request.user
        super().save_model(request, obj, form, change)


@admin.register(TopStepImportLog)
class TopStepImportLogAdmin(admin.ModelAdmin):
    list_display = [
        'filename',
        'user',
        'formatted_date',
        'total_rows',
        'success_count',
        'skipped_count',
        'error_count',
        'success_rate_display'
    ]
    list_filter = [
        'user',
        'imported_at'
    ]
    search_fields = [
        'filename',
        'user__username'
    ]
    readonly_fields = [
        'user',
        'filename',
        'total_rows',
        'success_count',
        'skipped_count',
        'error_count',
        'errors',
        'imported_at'
    ]
    date_hierarchy = 'imported_at'
    ordering = ['-imported_at']
    
    def formatted_date(self, obj):
        return obj.imported_at.strftime('%d/%m/%Y %H:%M')
    formatted_date.short_description = 'Date d\'import'
    formatted_date.admin_order_field = 'imported_at'
    
    def success_rate_display(self, obj):
        if obj.total_rows > 0:
            rate = (obj.success_count / obj.total_rows) * 100
            if rate == 100:
                color = 'green'
            elif rate >= 75:
                color = 'orange'
            else:
                color = 'red'
            return format_html(
                '<span style="color: {}; font-weight: bold;">{:.1f}%</span>',
                color,
                rate
            )
        return '-'
    success_rate_display.short_description = 'Taux de réussite'
    
    def has_add_permission(self, request):
        return False  # Les logs sont créés automatiquement
    
    def has_change_permission(self, request, obj=None):
        return False  # Les logs ne peuvent pas être modifiés


@admin.register(AccountTransaction)
class AccountTransactionAdmin(admin.ModelAdmin):
    list_display = [
        'transaction_date',
        'user',
        'trading_account',
        'transaction_type_display',
        'amount_display',
        'description_short',
        'created_at'
    ]
    list_filter = [
        'transaction_type',
        'transaction_date',
        'user',
        'trading_account',
        'created_at'
    ]
    search_fields = [
        'description',
        'trading_account__name',
        'user__username'
    ]
    readonly_fields = [
        'created_at',
        'updated_at'
    ]
    date_hierarchy = 'transaction_date'
    ordering = ['-transaction_date', '-created_at']
    
    fieldsets = (
        ('Informations', {
            'fields': ('user', 'trading_account', 'transaction_type')
        }),
        ('Détails', {
            'fields': ('amount', 'transaction_date', 'description')
        }),
        ('Métadonnées', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def transaction_type_display(self, obj):
        if obj.transaction_type == 'deposit':
            return format_html('<span style="color: green; font-weight: bold;">📥 Dépôt</span>')
        else:
            return format_html('<span style="color: red; font-weight: bold;">📤 Retrait</span>')
    transaction_type_display.short_description = 'Type'
    transaction_type_display.admin_order_field = 'transaction_type'
    
    def amount_display(self, obj):
        currency = obj.trading_account.currency
        amount = obj.amount
        if obj.transaction_type == 'withdrawal':
            return format_html('<span style="color: red;">-{:.2f} {}</span>', amount, currency)
        else:
            return format_html('<span style="color: green;">+{:.2f} {}</span>', amount, currency)
    amount_display.short_description = 'Montant'
    amount_display.admin_order_field = 'amount'
    
    def description_short(self, obj):
        if obj.description:
            return obj.description[:50] + '...' if len(obj.description) > 50 else obj.description
        return '-'
    description_short.short_description = 'Description'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if not request.user.is_superuser:
            qs = qs.filter(user=request.user)
        return qs.select_related('trading_account', 'user')
    
    def save_model(self, request, obj, form, change):
        if not change:  # Si c'est une création
            obj.user = request.user
        super().save_model(request, obj, form, change)
