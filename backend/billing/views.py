from __future__ import annotations

import json

from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.utils.translation import gettext as _
from django.views.decorators.csrf import csrf_exempt
from drf_spectacular.utils import extend_schema, OpenApiResponse
from rest_framework import permissions, status
from rest_framework.views import APIView

from .serializers import (
    CheckoutSessionSerializer,
    PortalSessionSerializer,
    SubscriptionStatusSerializer,
)
from .services import (
    create_checkout_session,
    create_portal_session,
    get_subscription_state_for_user,
    process_stripe_event,
)


class CreateCheckoutSessionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        responses={
            200: CheckoutSessionSerializer,
            400: OpenApiResponse(description='Invalid checkout request'),
        }
    )
    def post(self, request):
        try:
            session_id, checkout_url = create_checkout_session(request.user)
        except ValueError as exc:
            return JsonResponse({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return JsonResponse({'session_id': session_id, 'checkout_url': checkout_url}, status=status.HTTP_200_OK)


class CreatePortalSessionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        responses={
            200: PortalSessionSerializer,
            400: OpenApiResponse(description='Invalid portal request'),
        }
    )
    def post(self, request):
        try:
            portal_url = create_portal_session(request.user)
        except ValueError as exc:
            return JsonResponse({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return JsonResponse({'portal_url': portal_url}, status=status.HTTP_200_OK)


class SubscriptionStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses={200: SubscriptionStatusSerializer})
    def get(self, request):
        return JsonResponse(get_subscription_state_for_user(request.user), status=status.HTTP_200_OK)


@csrf_exempt
def stripe_webhook(request):
    if request.method != 'POST':
        return HttpResponse(status=status.HTTP_405_METHOD_NOT_ALLOWED)

    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    endpoint_secret = settings.STRIPE_WEBHOOK_SECRET
    if not endpoint_secret:
        return JsonResponse({'detail': _('Stripe webhook secret is not configured.')}, status=status.HTTP_400_BAD_REQUEST)

    try:
        import stripe
    except ImportError:
        return JsonResponse({'detail': _('Stripe SDK is not installed.')}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    try:
        event = stripe.Webhook.construct_event(payload=payload, sig_header=sig_header, secret=endpoint_secret)
    except ValueError:
        return JsonResponse({'detail': _('Invalid Stripe payload.')}, status=status.HTTP_400_BAD_REQUEST)
    except stripe.error.SignatureVerificationError:
        return JsonResponse({'detail': _('Invalid Stripe signature.')}, status=status.HTTP_400_BAD_REQUEST)

    if not isinstance(event, dict):
        event = json.loads(str(event))

    process_stripe_event(event)
    return HttpResponse(status=status.HTTP_200_OK)

