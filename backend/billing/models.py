from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils.translation import gettext_lazy as _


class BillingPlatformSettings(models.Model):
    trial_period_days = models.PositiveIntegerField(default=15, verbose_name=_('Trial period (days)'))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('Billing platform settings')
        verbose_name_plural = _('Billing platform settings')

    def clean(self):
        if self.trial_period_days < 0:
            raise ValidationError({'trial_period_days': _('Trial period cannot be negative.')})
        if self.trial_period_days > 365:
            raise ValidationError({'trial_period_days': _('Trial period is too high (max 365 days).')})

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError(_('Billing platform settings cannot be deleted.'))

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1, defaults={'trial_period_days': 15})
        return obj


class CustomerSubscription(models.Model):
    STATUS_TRIALING = 'trialing'
    STATUS_ACTIVE = 'active'
    STATUS_PAST_DUE = 'past_due'
    STATUS_CANCELED = 'canceled'
    STATUS_UNPAID = 'unpaid'
    STATUS_INCOMPLETE = 'incomplete'
    STATUS_INCOMPLETE_EXPIRED = 'incomplete_expired'
    STATUS_PAUSED = 'paused'

    STATUS_CHOICES = (
        (STATUS_TRIALING, _('Trialing')),
        (STATUS_ACTIVE, _('Active')),
        (STATUS_PAST_DUE, _('Past due')),
        (STATUS_CANCELED, _('Canceled')),
        (STATUS_UNPAID, _('Unpaid')),
        (STATUS_INCOMPLETE, _('Incomplete')),
        (STATUS_INCOMPLETE_EXPIRED, _('Incomplete expired')),
        (STATUS_PAUSED, _('Paused')),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='stripe_subscriptions',
    )
    stripe_customer_id = models.CharField(max_length=255, db_index=True)
    stripe_subscription_id = models.CharField(max_length=255, unique=True, db_index=True)
    stripe_price_id = models.CharField(max_length=255, blank=True, default='')
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, db_index=True)
    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    cancel_at_period_end = models.BooleanField(default=False)
    canceled_at = models.DateTimeField(null=True, blank=True)
    is_current = models.BooleanField(default=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('Customer subscription')
        verbose_name_plural = _('Customer subscriptions')
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['stripe_customer_id']),
            models.Index(fields=['stripe_subscription_id']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['user'],
                condition=Q(is_current=True),
                name='unique_current_subscription_per_user',
            ),
        ]

    def __str__(self):
        return f'{self.user_id}:{self.status}:{self.stripe_subscription_id}'

    @property
    def grants_premium_access(self):
        return self.status in {self.STATUS_TRIALING, self.STATUS_ACTIVE}


class StripeWebhookEvent(models.Model):
    event_id = models.CharField(max_length=255, unique=True)
    event_type = models.CharField(max_length=255)
    processed = models.BooleanField(default=False)
    received_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    payload = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = _('Stripe webhook event')
        verbose_name_plural = _('Stripe webhook events')
        ordering = ['-received_at']

    def __str__(self):
        return f'{self.event_type} ({self.event_id})'

