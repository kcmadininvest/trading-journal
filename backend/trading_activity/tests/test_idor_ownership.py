"""IDOR trading_activity : dépenses, crédits, taxes, catégories cross-user."""
from decimal import Decimal

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User
from billing.models import CustomerSubscription
from trades.models import AccountTransaction, TradingAccount
from trading_activity.models import (
    TradingActivityCredit,
    TradingActivityExpense,
    TradingActivityExpenseCategory,
    TradingActivityTaxPayment,
)


class IdorTradingActivityOwnershipTests(APITestCase):
    def setUp(self) -> None:
        self.user_a = User.objects.create_user(
            email='idor-ta-a@example.com',
            username='idor_ta_a',
            password='testpass123',
            first_name='A',
            last_name='Act',
            role='user',
        )
        self.user_b = User.objects.create_user(
            email='idor-ta-b@example.com',
            username='idor_ta_b',
            password='testpass123',
            first_name='B',
            last_name='Act',
            role='user',
        )
        for i, user in enumerate((self.user_a, self.user_b)):
            CustomerSubscription.objects.create(
                user=user,
                stripe_customer_id=f'cus_idor_ta_{i}',
                stripe_subscription_id=f'sub_idor_ta_{i}',
                stripe_price_id='price_test',
                status=CustomerSubscription.STATUS_ACTIVE,
                current_period_end=timezone.now(),
            )
        self.account_b = TradingAccount.objects.create(
            user=self.user_b,
            name='TA Account B',
            account_type='other',
            currency='USD',
            initial_capital=Decimal('10000.00'),
            status='active',
            is_default=True,
        )
        self.category_b = TradingActivityExpenseCategory.objects.create(
            user=self.user_b,
            name='Cat B',
        )
        self.expense_b = TradingActivityExpense.objects.create(
            user=self.user_b,
            date='2026-01-01',
            primary_currency='EUR',
            subtotal=Decimal('100.00'),
            vat_amount=Decimal('0.00'),
            total=Decimal('100.00'),
            category=self.category_b,
        )
        self.credit_b = TradingActivityCredit.objects.create(
            user=self.user_b,
            date='2026-01-02',
            primary_currency='EUR',
            amount=Decimal('500.00'),
        )
        self.tax_b = TradingActivityTaxPayment.objects.create(
            user=self.user_b,
            date='2026-01-10',
            amount=Decimal('50.00'),
            currency='EUR',
            payment_type='income_tax',
        )
        self.withdrawal_b = AccountTransaction.objects.create(
            user=self.user_b,
            trading_account=self.account_b,
            transaction_type='withdrawal',
            amount=Decimal('100.00'),
            transaction_date=timezone.now(),
            description='idor withdrawal b',
        )

    def test_expense_alien_404(self) -> None:
        self.client.force_authenticate(user=self.user_a)
        pk = self.expense_b.id
        self.assertEqual(self.client.get(f'/api/trading-activity/expenses/{pk}/').status_code, 404)
        self.assertEqual(
            self.client.patch(
                f'/api/trading-activity/expenses/{pk}/',
                {'label': 'hack'},
                format='json',
            ).status_code,
            404,
        )
        self.assertEqual(self.client.delete(f'/api/trading-activity/expenses/{pk}/').status_code, 404)
        self.assertTrue(TradingActivityExpense.objects.filter(id=pk).exists())

    def test_credit_alien_404(self) -> None:
        self.client.force_authenticate(user=self.user_a)
        pk = self.credit_b.id
        self.assertEqual(self.client.get(f'/api/trading-activity/credits/{pk}/').status_code, 404)
        self.assertEqual(
            self.client.patch(
                f'/api/trading-activity/credits/{pk}/',
                {'notes': 'hack'},
                format='json',
            ).status_code,
            404,
        )
        self.assertEqual(self.client.delete(f'/api/trading-activity/credits/{pk}/').status_code, 404)
        self.assertTrue(TradingActivityCredit.objects.filter(id=pk).exists())

    def test_tax_payment_alien_404(self) -> None:
        self.client.force_authenticate(user=self.user_a)
        pk = self.tax_b.id
        self.assertEqual(
            self.client.get(f'/api/trading-activity/tax-payments/{pk}/').status_code,
            404,
        )
        self.assertEqual(
            self.client.patch(
                f'/api/trading-activity/tax-payments/{pk}/',
                {'amount': '1.00'},
                format='json',
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.delete(f'/api/trading-activity/tax-payments/{pk}/').status_code,
            404,
        )
        self.assertTrue(TradingActivityTaxPayment.objects.filter(id=pk).exists())

    def test_expense_category_alien_404(self) -> None:
        self.client.force_authenticate(user=self.user_a)
        pk = self.category_b.id
        self.assertEqual(
            self.client.get(f'/api/trading-activity/expense-categories/{pk}/').status_code,
            404,
        )
        self.assertEqual(
            self.client.patch(
                f'/api/trading-activity/expense-categories/{pk}/',
                {'name': 'hack'},
                format='json',
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.delete(f'/api/trading-activity/expense-categories/{pk}/').status_code,
            404,
        )
        self.assertTrue(TradingActivityExpenseCategory.objects.filter(id=pk).exists())

    def test_create_rejects_alien_fk(self) -> None:
        self.client.force_authenticate(user=self.user_a)
        expense_res = self.client.post(
            '/api/trading-activity/expenses/',
            {
                'date': '2026-02-01',
                'primary_currency': 'EUR',
                'subtotal': '10.00',
                'vat_amount': '0.00',
                'total': '10.00',
                'category': self.category_b.id,
            },
            format='json',
        )
        self.assertEqual(expense_res.status_code, 400, expense_res.data)
        self.assertIn('category', expense_res.data)

        credit_res = self.client.post(
            '/api/trading-activity/credits/',
            {
                'date': '2026-02-01',
                'primary_currency': 'EUR',
                'amount': '50.00',
                'linked_account_transactions': [self.withdrawal_b.id],
            },
            format='json',
        )
        self.assertEqual(credit_res.status_code, 400, credit_res.data)
        self.assertIn('linked_account_transactions', credit_res.data)
