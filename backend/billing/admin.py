from django.contrib import admin

from .models import BillingPlatformSettings, CustomerSubscription, StripeWebhookEvent


@admin.register(BillingPlatformSettings)
class BillingPlatformSettingsAdmin(admin.ModelAdmin):
    list_display = ('trial_period_days', 'updated_at')

    def has_add_permission(self, request):
        if BillingPlatformSettings.objects.exists():
            return False
        return super().has_add_permission(request)

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(CustomerSubscription)
class CustomerSubscriptionAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'user',
        'status',
        'stripe_subscription_id',
        'is_current',
        'current_period_end',
        'updated_at',
    )
    list_filter = ('status', 'is_current', 'cancel_at_period_end')
    search_fields = ('user__email', 'stripe_customer_id', 'stripe_subscription_id')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(StripeWebhookEvent)
class StripeWebhookEventAdmin(admin.ModelAdmin):
    list_display = ('event_id', 'event_type', 'processed', 'received_at', 'processed_at')
    list_filter = ('processed', 'event_type')
    search_fields = ('event_id', 'event_type')
    readonly_fields = ('received_at', 'processed_at')

