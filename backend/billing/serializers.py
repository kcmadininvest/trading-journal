from rest_framework import serializers


class CheckoutSessionSerializer(serializers.Serializer):
    checkout_url = serializers.URLField()
    session_id = serializers.CharField()


class PortalSessionSerializer(serializers.Serializer):
    portal_url = serializers.URLField()


class SubscriptionStatusSerializer(serializers.Serializer):
    access_state = serializers.ChoiceField(choices=['admin_bypass', 'trialing', 'active', 'inactive'])
    trial_days_left = serializers.IntegerField()
    can_subscribe = serializers.BooleanField()
    checkout_enabled = serializers.BooleanField()
    status = serializers.CharField()
    current_period_end = serializers.DateTimeField(required=False, allow_null=True)
    cancel_at_period_end = serializers.BooleanField(required=False)

