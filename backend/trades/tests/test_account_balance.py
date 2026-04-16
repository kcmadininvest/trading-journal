"""Tests ciblés : solde compte et validation des retraits."""
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory

from accounts.models import User
from trades.account_balance import compute_trading_account_balance
from trades.models import AccountTransaction, TradingAccount
from trades.serializers import AccountTransactionSerializer


class AccountBalanceComputationTests(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='balance-test@example.com',
            username='balance_test',
            password='testpass123',
            first_name='B',
            last_name='T',
        )
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='Test account',
            account_type='other',
            currency='USD',
            initial_capital=Decimal('1000.00'),
            status='active',
        )

    def test_trading_equity_matches_current_when_no_transactions(self) -> None:
        b = compute_trading_account_balance(self.account)
        self.assertEqual(b['trading_equity'], Decimal('1000.00'))
        self.assertEqual(b['current_balance'], Decimal('1000.00'))

    def test_deposit_and_withdrawal_adjust_current_only(self) -> None:
        AccountTransaction.objects.create(
            user=self.user,
            trading_account=self.account,
            transaction_type='deposit',
            amount=Decimal('100.00'),
            transaction_date=timezone.now(),
        )
        AccountTransaction.objects.create(
            user=self.user,
            trading_account=self.account,
            transaction_type='withdrawal',
            amount=Decimal('50.00'),
            transaction_date=timezone.now(),
        )
        b = compute_trading_account_balance(self.account)
        self.assertEqual(b['trading_equity'], Decimal('1000.00'))
        self.assertEqual(b['net_transactions'], Decimal('50.00'))
        self.assertEqual(b['current_balance'], Decimal('1050.00'))


class WithdrawalValidationTests(TestCase):
    def setUp(self) -> None:
        self.factory = APIRequestFactory()
        self.user = User.objects.create_user(
            email='withdrawal-test@example.com',
            username='withdrawal_test',
            password='testpass123',
            first_name='W',
            last_name='T',
        )
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='W account',
            account_type='other',
            currency='USD',
            initial_capital=Decimal('100.00'),
            status='active',
        )

    def _request(self):
        req = self.factory.post('/')
        req.user = self.user
        return req

    def test_rejects_withdrawal_exceeding_balance(self) -> None:
        ser = AccountTransactionSerializer(
            data={
                'trading_account': self.account.pk,
                'transaction_type': 'withdrawal',
                'amount': '101.00',
                'transaction_date': timezone.now(),
            },
            context={'request': self._request()},
        )
        self.assertFalse(ser.is_valid())
        self.assertIn('amount', ser.errors)

    def test_allows_withdrawal_up_to_balance(self) -> None:
        ser = AccountTransactionSerializer(
            data={
                'trading_account': self.account.pk,
                'transaction_type': 'withdrawal',
                'amount': '100.00',
                'transaction_date': timezone.now(),
            },
            context={'request': self._request()},
        )
        self.assertTrue(ser.is_valid(), ser.errors)

    def test_update_withdrawal_uses_delta_not_double_count(self) -> None:
        txn = AccountTransaction.objects.create(
            user=self.user,
            trading_account=self.account,
            transaction_type='withdrawal',
            amount=Decimal('30.00'),
            transaction_date=timezone.now(),
        )
        ser = AccountTransactionSerializer(
            instance=txn,
            data={'amount': '80.00'},
            partial=True,
            context={'request': self._request()},
        )
        self.assertTrue(ser.is_valid(), ser.errors)

        ser2 = AccountTransactionSerializer(
            instance=txn,
            data={'amount': '101.00'},
            partial=True,
            context={'request': self._request()},
        )
        self.assertFalse(ser2.is_valid())
