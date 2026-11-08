"""Tri serveur des listes ledger trading-activity (?ordering=)."""

from datetime import date
from decimal import Decimal

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User
from billing.models import CustomerSubscription
from trading_activity.models import (
    TradingActivityCredit,
    TradingActivityExpense,
    TradingActivityExpenseCategory,
    TradingActivityTaxPayment,
)


class TradingActivityLedgerOrderingTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='sort_ledger',
            email='sort-ledger@example.com',
            password='testpass123',
        )
        CustomerSubscription.objects.create(
            user=self.user,
            stripe_customer_id='cus_sort_ledger',
            stripe_subscription_id='sub_sort_ledger',
            stripe_price_id='price_test',
            status=CustomerSubscription.STATUS_ACTIVE,
            current_period_end=timezone.now(),
        )
        self.client.force_authenticate(user=self.user)

        cat_a = TradingActivityExpenseCategory.objects.create(user=self.user, name='Alpha')
        cat_b = TradingActivityExpenseCategory.objects.create(user=self.user, name='Zulu')
        TradingActivityExpense.objects.create(
            user=self.user,
            date=date(2024, 1, 1),
            primary_currency='EUR',
            subtotal=Decimal('10.00'),
            vat_amount=Decimal('2.00'),
            total=Decimal('12.00'),
            label='early',
            category=cat_b,
            invoice_reference='R-1',
        )
        TradingActivityExpense.objects.create(
            user=self.user,
            date=date(2024, 6, 1),
            primary_currency='EUR',
            subtotal=Decimal('100.00'),
            vat_amount=Decimal('20.00'),
            total=Decimal('120.00'),
            label='late',
            category=cat_a,
            invoice_reference='R-2',
        )

        TradingActivityCredit.objects.create(
            user=self.user,
            date=date(2024, 2, 1),
            primary_currency='EUR',
            amount=Decimal('50.00'),
        )
        TradingActivityCredit.objects.create(
            user=self.user,
            date=date(2024, 5, 1),
            primary_currency='EUR',
            amount=Decimal('200.00'),
        )

        TradingActivityTaxPayment.objects.create(
            user=self.user,
            date=date(2024, 3, 1),
            amount=Decimal('30.00'),
            currency='EUR',
            payment_type='income_tax',
            label='tax-a',
            reference='T-1',
        )
        TradingActivityTaxPayment.objects.create(
            user=self.user,
            date=date(2024, 4, 1),
            amount=Decimal('90.00'),
            currency='EUR',
            payment_type='other',
            label='tax-b',
            reference='T-2',
        )

    def test_expenses_default_date_desc(self):
        res = self.client.get('/api/trading-activity/expenses/')
        self.assertEqual(res.status_code, 200)
        labels = [row['label'] for row in res.data['results']]
        self.assertEqual(labels, ['late', 'early'])

    def test_expenses_ordering_total_asc(self):
        res = self.client.get('/api/trading-activity/expenses/', {'ordering': 'total'})
        self.assertEqual(res.status_code, 200)
        totals = [Decimal(row['total']) for row in res.data['results']]
        self.assertEqual(totals, [Decimal('12.00'), Decimal('120.00')])

    def test_expenses_ordering_category_name(self):
        res = self.client.get('/api/trading-activity/expenses/', {'ordering': 'category'})
        self.assertEqual(res.status_code, 200)
        names = [row['category_name'] for row in res.data['results']]
        self.assertEqual(names, ['Alpha', 'Zulu'])

    def test_expenses_invalid_ordering_falls_back_to_date_desc(self):
        res = self.client.get('/api/trading-activity/expenses/', {'ordering': '-bogus'})
        self.assertEqual(res.status_code, 200)
        labels = [row['label'] for row in res.data['results']]
        self.assertEqual(labels, ['late', 'early'])

    def test_credits_ordering_amount_desc(self):
        res = self.client.get('/api/trading-activity/credits/', {'ordering': '-amount'})
        self.assertEqual(res.status_code, 200)
        amounts = [Decimal(row['amount']) for row in res.data['results']]
        self.assertEqual(amounts, [Decimal('200.00'), Decimal('50.00')])

    def test_tax_payments_ordering_label_asc(self):
        res = self.client.get('/api/trading-activity/tax-payments/', {'ordering': 'label'})
        self.assertEqual(res.status_code, 200)
        labels = [row['label'] for row in res.data['results']]
        self.assertEqual(labels, ['tax-a', 'tax-b'])
