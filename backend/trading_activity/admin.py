from django.contrib import admin

from .models import (
    TradingActivityCredit,
    TradingActivityExpense,
    TradingActivityExpenseCategory,
    TradingActivityTaxPayment,
    TradingActivityTaxPaymentBuiltinLabel,
    TradingActivityTaxPaymentType,
)


@admin.register(TradingActivityExpenseCategory)
class TradingActivityExpenseCategoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'name', 'updated_at')
    search_fields = ('name', 'user__email')
    list_filter = ('user',)


@admin.register(TradingActivityExpense)
class TradingActivityExpenseAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'date', 'primary_currency', 'total', 'category', 'updated_at')
    list_filter = ('primary_currency', 'user')
    search_fields = ('invoice_reference', 'label', 'user__email')
    raw_id_fields = ('user', 'category')


@admin.register(TradingActivityCredit)
class TradingActivityCreditAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'user',
        'date',
        'primary_currency',
        'amount',
        'secondary_amount',
        'secondary_currency',
        'fx_rate',
        'transfer_fee_amount',
        'updated_at',
    )
    list_filter = ('primary_currency', 'user')
    raw_id_fields = ('user',)
    filter_horizontal = ('linked_account_transactions',)


@admin.register(TradingActivityTaxPaymentBuiltinLabel)
class TradingActivityTaxPaymentBuiltinLabelAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'code', 'label', 'updated_at')
    list_filter = ('code', 'user')
    search_fields = ('label', 'user__email')


@admin.register(TradingActivityTaxPaymentType)
class TradingActivityTaxPaymentTypeAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'name', 'updated_at')
    search_fields = ('name', 'user__email')
    list_filter = ('user',)


@admin.register(TradingActivityTaxPayment)
class TradingActivityTaxPaymentAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'date', 'currency', 'amount', 'payment_type', 'updated_at')
    list_filter = ('currency', 'payment_type', 'user')
    search_fields = ('label', 'reference', 'user__email')
    raw_id_fields = ('user',)
