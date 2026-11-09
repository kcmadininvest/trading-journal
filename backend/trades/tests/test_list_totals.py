"""Anti-régression : totaux légers list-totals vs aggregate SQL et vs statistics."""
from decimal import Decimal
from unittest.mock import patch

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User, UserPreferences
from billing.models import CustomerSubscription
from trades.models import ImportedTrade, TradingAccount
from trades.services.statistics_calculator import compute_list_totals_payload, compute_statistics_payload


class ImportedTradeListTotalsTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='list-totals@example.com',
            username='list_totals_user',
            password='testpass123',
            first_name='L',
            last_name='T',
            role='user',
        )
        UserPreferences.objects.get_or_create(user=self.user)
        CustomerSubscription.objects.create(
            user=self.user,
            stripe_customer_id='cus_list_totals',
            stripe_subscription_id='sub_list_totals',
            stripe_price_id='price_test',
            status=CustomerSubscription.STATUS_ACTIVE,
            current_period_end=timezone.now(),
        )
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='List totals account',
            account_type='other',
            currency='USD',
            initial_capital=Decimal('10000.00'),
            status='active',
        )
        now = timezone.now()
        ImportedTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            external_trade_id='lt-1',
            contract_name='NQ',
            entered_at=now,
            exited_at=now,
            entry_price=Decimal('100.000000000'),
            exit_price=Decimal('101.000000000'),
            size=Decimal('1.0000'),
            trade_type='Long',
            trade_day=now.date(),
            pnl=Decimal('100.000000000'),
            fees=Decimal('10.00'),
            commissions=Decimal('5.00'),
        )
        ImportedTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            external_trade_id='lt-2',
            contract_name='ES',
            entered_at=now,
            exited_at=now,
            entry_price=Decimal('100.000000000'),
            exit_price=Decimal('99.000000000'),
            size=Decimal('1.0000'),
            trade_type='Short',
            trade_day=now.date(),
            pnl=Decimal('50.000000000'),
            fees=Decimal('2.00'),
            commissions=Decimal('3.00'),
        )
        self.client.force_authenticate(user=self.user)

    def test_list_totals_matches_sql_sums_and_effective_fees(self) -> None:
        res = self.client.get('/api/trades/imported/list-totals/')
        self.assertEqual(res.status_code, 200, res.data)
        data = res.data
        self.assertEqual(data['total_trades'], 2)
        self.assertEqual(Decimal(str(data['total_raw_pnl'])), Decimal('150.00'))
        # net_pnl recalculé au save : 100-15=85, 50-5=45 → 130
        self.assertEqual(Decimal(str(data['total_net_pnl'])), Decimal('130.00'))
        self.assertEqual(Decimal(str(data['total_fees'])), Decimal('20.00'))

    def test_list_totals_respects_contract_filter(self) -> None:
        res = self.client.get('/api/trades/imported/list-totals/', {'contract': 'NQ'})
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['total_trades'], 1)
        self.assertEqual(Decimal(str(res.data['total_raw_pnl'])), Decimal('100.00'))
        self.assertEqual(Decimal(str(res.data['total_fees'])), Decimal('15.00'))

    def test_list_totals_does_not_call_compute_statistics_payload(self) -> None:
        with patch(
            'trades.services.statistics_calculator.compute_statistics_payload',
            wraps=compute_statistics_payload,
        ) as calc_stats:
            res = self.client.get('/api/trades/imported/list-totals/')
            self.assertEqual(res.status_code, 200, res.data)
            calc_stats.assert_not_called()

    def test_list_totals_additive_fields_match_statistics(self) -> None:
        lite = self.client.get('/api/trades/imported/list-totals/')
        full = self.client.get('/api/trades/imported/statistics/')
        self.assertEqual(lite.status_code, 200, lite.data)
        self.assertEqual(full.status_code, 200, full.data)
        for key in ('total_trades', 'total_raw_pnl', 'total_net_pnl', 'total_fees', 'total_pnl'):
            self.assertEqual(
                Decimal(str(lite.data[key])),
                Decimal(str(full.data[key])),
                msg=key,
            )

    def test_list_totals_cache_distinguishes_contract_filter(self) -> None:
        from django.core.cache import cache

        cache.clear()
        all_res = self.client.get('/api/trades/imported/list-totals/')
        nq_res = self.client.get('/api/trades/imported/list-totals/', {'contract': 'NQ'})
        self.assertEqual(all_res.data['total_trades'], 2)
        self.assertEqual(nq_res.data['total_trades'], 1)

    def test_compute_list_totals_payload_direct(self) -> None:
        qs = ImportedTrade.objects.filter(user=self.user)
        payload = compute_list_totals_payload(qs, 'net_pnl')
        self.assertEqual(payload['total_trades'], 2)
        self.assertEqual(payload['total_fees'], Decimal('20.00'))
