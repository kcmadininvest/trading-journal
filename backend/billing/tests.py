import types
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from billing.models import BillingPlatformSettings, CustomerSubscription
from billing.permissions import user_has_premium_access

User = get_user_model()


class BillingPermissionTests(TestCase):
    def test_admin_has_access_without_subscription(self):
        admin = User.objects.create_user(
            email='admin@example.com',
            username='admin',
            password='test1234',
            role='admin',
        )
        self.assertTrue(user_has_premium_access(admin))

    def test_trialing_subscription_grants_access(self):
        user = User.objects.create_user(
            email='user@example.com',
            username='user',
            password='test1234',
            role='user',
        )
        CustomerSubscription.objects.create(
            user=user,
            stripe_customer_id='cus_123',
            stripe_subscription_id='sub_123',
            stripe_price_id='price_123',
            status=CustomerSubscription.STATUS_TRIALING,
            current_period_end=timezone.now() + timedelta(days=10),
        )
        self.assertTrue(user_has_premium_access(user))


class BillingApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='regular@example.com',
            username='regular',
            password='test1234',
            role='user',
        )
        self.admin = User.objects.create_user(
            email='admin2@example.com',
            username='admin2',
            password='test1234',
            role='admin',
        )

    def test_subscription_status_inactive_for_regular_user_without_subscription(self):
        self.client.force_authenticate(self.user)
        response = self.client.get('/api/billing/subscription/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['access_state'], 'inactive')

    @override_settings(STRIPE_SECRET_KEY='sk_test_x', STRIPE_PRICE_PREMIUM_ID='price_x')
    def test_checkout_rejected_for_admin(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post('/api/billing/checkout-session/', {}, format='json')
        self.assertEqual(response.status_code, 400)

    @override_settings(STRIPE_SECRET_KEY='sk_test_x', STRIPE_PRICE_PREMIUM_ID='price_x')
    def test_checkout_uses_trial_period_from_settings(self):
        BillingPlatformSettings.get_solo()
        settings_obj = BillingPlatformSettings.get_solo()
        settings_obj.trial_period_days = 21
        settings_obj.save()

        stripe_stub = types.SimpleNamespace()
        stripe_stub.api_key = ''
        stripe_stub.Customer = types.SimpleNamespace(
            create=lambda **kwargs: type('Customer', (), {'id': 'cus_123'})
        )
        call_kwargs = {}

        def checkout_create(**kwargs):
            call_kwargs.update(kwargs)
            return type(
                'Session',
                (),
                {'id': 'cs_123', 'url': 'https://checkout.stripe.test'},
            )
        stripe_stub.checkout = types.SimpleNamespace(
            Session=types.SimpleNamespace(create=checkout_create)
        )

        with patch.dict('sys.modules', {'stripe': stripe_stub}):
            self.client.force_authenticate(self.user)
            response = self.client.post('/api/billing/checkout-session/', {}, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['session_id'], 'cs_123')
        self.assertEqual(call_kwargs['subscription_data']['trial_period_days'], 21)

