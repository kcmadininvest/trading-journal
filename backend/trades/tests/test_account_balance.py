"""Tests ciblés : solde compte et validation des retraits."""
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase, APIClient, APIRequestFactory

from accounts.models import User
from trades.account_balance import (
    compute_peak_balances,
    compute_topstep_best_day,
    compute_trading_account_balance,
    resolve_peak_balance_only,
)
from trades.models import AccountTransaction, TopStepTrade, TradingAccount
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

    def test_gross_totals_when_pnl_differs_from_net_pnl(self) -> None:
        now = timezone.now()
        TopStepTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            topstep_id='bal-gross-1',
            contract_name='NQ',
            entered_at=now,
            entry_price=Decimal('100.000000000'),
            size=Decimal('1.0000'),
            trade_type='Long',
            pnl=Decimal('100.000000000'),
            fees=Decimal('20.000000000'),
        )
        b = compute_trading_account_balance(self.account)
        self.assertEqual(b['total_pnl'], Decimal('80.000000000'))
        self.assertEqual(b['total_pnl_gross'], Decimal('100.000000000'))
        self.assertEqual(b['trading_equity'], Decimal('1080.000000000'))
        self.assertEqual(b['trading_equity_gross'], Decimal('1100.000000000'))
        self.assertEqual(b['current_balance'], Decimal('1080.000000000'))
        self.assertEqual(b['current_balance_gross'], Decimal('1100.000000000'))
        self.assertEqual(b['peak_balance'], Decimal('1080.000000000'))
        self.assertEqual(b['peak_balance_gross'], Decimal('1100.000000000'))

    def test_peak_balance_tracks_intraday_high_before_drawdown(self) -> None:
        d1 = timezone.now().date()
        TopStepTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            topstep_id='bal-peak-1',
            contract_name='NQ',
            entered_at=timezone.now(),
            entry_price=Decimal('100.000000000'),
            size=Decimal('1.0000'),
            trade_type='Long',
            net_pnl=Decimal('200.00'),
            trade_day=d1,
        )
        TopStepTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            topstep_id='bal-peak-2',
            contract_name='NQ',
            entered_at=timezone.now(),
            entry_price=Decimal('100.000000000'),
            size=Decimal('1.0000'),
            trade_type='Long',
            net_pnl=Decimal('-50.00'),
            trade_day=d1,
        )
        b = compute_trading_account_balance(self.account)
        self.assertEqual(b['current_balance'], Decimal('1150.00'))
        self.assertEqual(b['peak_balance'], Decimal('1200.00'))

    def test_deposit_can_raise_peak_balance(self) -> None:
        AccountTransaction.objects.create(
            user=self.user,
            trading_account=self.account,
            transaction_type='deposit',
            amount=Decimal('500.00'),
            transaction_date=timezone.now(),
        )
        b = compute_trading_account_balance(self.account)
        self.assertEqual(b['peak_balance'], Decimal('1500.00'))
        self.assertEqual(b['current_balance'], Decimal('1500.00'))

    def test_include_peak_false_omits_peak_fields(self) -> None:
        TopStepTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            topstep_id='bal-no-peak-1',
            contract_name='NQ',
            entered_at=timezone.now(),
            entry_price=Decimal('100.000000000'),
            size=Decimal('1.0000'),
            trade_type='Long',
            net_pnl=Decimal('50.00'),
        )
        b = compute_trading_account_balance(self.account, include_peak=False)
        self.assertEqual(b['current_balance'], Decimal('1050.00'))
        self.assertNotIn('peak_balance', b)
        self.assertNotIn('peak_balance_gross', b)

    def test_compute_peak_balances_single_pass_matches_net_and_gross(self) -> None:
        now = timezone.now()
        TopStepTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            topstep_id='bal-dual-1',
            contract_name='NQ',
            entered_at=now,
            entry_price=Decimal('100.000000000'),
            size=Decimal('1.0000'),
            trade_type='Long',
            pnl=Decimal('100.000000000'),
            fees=Decimal('20.000000000'),
        )
        peak_net, peak_gross = compute_peak_balances(self.account)
        full = compute_trading_account_balance(self.account)
        self.assertEqual(peak_net, full['peak_balance'])
        self.assertEqual(peak_gross, full['peak_balance_gross'])

    def test_topstep_best_day_aggregation(self) -> None:
        self.account.account_type = 'topstep'
        self.account.save(update_fields=['account_type'])
        d1 = timezone.now().date()
        TopStepTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            topstep_id='bal-best-1',
            contract_name='NQ',
            entered_at=timezone.now(),
            entry_price=Decimal('100.000000000'),
            size=Decimal('1.0000'),
            trade_type='Long',
            pnl=Decimal('120.000000000'),
            fees=Decimal('20.000000000'),
            trade_day=d1,
        )
        best = compute_topstep_best_day(self.account)
        self.assertIsNotNone(best)
        self.assertEqual(best['best_day_pnl_net'], Decimal('100.000000000'))
        self.assertEqual(best['best_day_pnl_gross'], Decimal('120.000000000'))

    def test_resolve_peak_balance_only(self) -> None:
        TopStepTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            topstep_id='bal-peak-only-1',
            contract_name='NQ',
            entered_at=timezone.now(),
            entry_price=Decimal('100.000000000'),
            size=Decimal('1.0000'),
            trade_type='Long',
            net_pnl=Decimal('40.00'),
        )
        peaks = resolve_peak_balance_only(self.account, use_cache=False)
        full = compute_trading_account_balance(self.account)
        self.assertEqual(peaks['peak_balance'], full['peak_balance'])


class AccountBalanceApiTests(APITestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='balance-api@example.com',
            username='balance_api',
            password='testpass123',
            first_name='A',
            last_name='P',
        )
        self.client.force_authenticate(user=self.user)
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='API account',
            account_type='other',
            currency='USD',
            initial_capital=Decimal('1000.00'),
            status='active',
        )

    def test_balance_api_without_peak(self) -> None:
        response = self.client.get(
            '/api/trades/account-transactions/balance/',
            {'trading_account': self.account.pk, 'include_peak': 'false'},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['current_balance'], '1000.00')
        self.assertNotIn('peak_balance', response.data)
        self.assertNotIn('peak_balance_gross', response.data)

    def test_balance_api_with_peak(self) -> None:
        TopStepTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            topstep_id='bal-api-1',
            contract_name='NQ',
            entered_at=timezone.now(),
            entry_price=Decimal('100.000000000'),
            size=Decimal('1.0000'),
            trade_type='Long',
            net_pnl=Decimal('25.00'),
        )
        response = self.client.get(
            '/api/trades/account-transactions/balance/',
            {'trading_account': self.account.pk},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Decimal(response.data['current_balance']), Decimal('1025'))
        self.assertEqual(Decimal(response.data['peak_balance']), Decimal('1025'))
        self.assertIn('peak_balance_gross', response.data)

    def test_balance_peak_api(self) -> None:
        TopStepTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            topstep_id='bal-peak-api-1',
            contract_name='NQ',
            entered_at=timezone.now(),
            entry_price=Decimal('100.000000000'),
            size=Decimal('1.0000'),
            trade_type='Long',
            net_pnl=Decimal('25.00'),
        )
        response = self.client.get(
            '/api/trades/account-transactions/balance/peak/',
            {'trading_account': self.account.pk},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Decimal(response.data['peak_balance']), Decimal('1025'))

    def test_balance_consistency_api_topstep(self) -> None:
        self.account.account_type = 'topstep'
        self.account.save(update_fields=['account_type'])
        d1 = timezone.now().date()
        TopStepTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            topstep_id='bal-cons-1',
            contract_name='NQ',
            entered_at=timezone.now(),
            entry_price=Decimal('100.000000000'),
            size=Decimal('1.0000'),
            trade_type='Long',
            net_pnl=Decimal('150.00'),
            trade_day=d1,
        )
        response = self.client.get(
            '/api/trades/account-transactions/balance/consistency/',
            {'trading_account': self.account.pk},
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.data['consistency'])
        self.assertEqual(
            Decimal(response.data['consistency']['best_day_pnl_net']),
            Decimal('150'),
        )


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
