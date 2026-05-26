from __future__ import annotations

from rest_framework.permissions import BasePermission

from accounts.models import AppSettings

from .models import CustomerSubscription


def premium_restrictions_are_enabled() -> bool:
    return AppSettings.get_solo().premium_restrictions_enabled


def user_has_premium_access(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    if not premium_restrictions_are_enabled():
        return True
    if getattr(user, 'is_admin', False):
        return True

    current_subscription = (
        CustomerSubscription.objects.filter(user=user, is_current=True)
        .order_by('-updated_at')
        .first()
    )
    if not current_subscription:
        return False
    return current_subscription.grants_premium_access


class IsPremiumBundleSubscriberOrAdmin(BasePermission):
    message = 'Premium subscription required.'

    def has_permission(self, request, view):
        return user_has_premium_access(request.user)

