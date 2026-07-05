"""Parité balance-series : agrégats journaliers = somme manuelle des transactions."""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from decimal import Decimal

import pytz
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User, UserPreferences
from trades.account_balance import aggregate_daily_net_transactions
from trades.models import AccountTransaction, TradingAccount


class BalanceSeriesParityTests(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='balance-series@example.com',
            username='balance_series',
            password='testpass123',
        )
        UserPreferences.objects.get_or_create(
            user=self.user,
            defaults={'timezone': 'Europe/Paris'},
        )
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='Series account',
            initial_capital=Decimal('5000'),
            status='active',
            is_default=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.user_tz = pytz.timezone('Europe/Paris')

    def _create_tx(self, day: str, tx_type: str, amount: str) -> None:
        dt = self.user_tz.localize(datetime.strptime(day, '%Y-%m-%d').replace(hour=12))
        AccountTransaction.objects.create(
            user=self.user,
            trading_account=self.account,
            transaction_type=tx_type,
            amount=Decimal(amount),
            transaction_date=dt,
        )

    def _manual_daily_net(self, *, account_id: int | None = None) -> dict[str, Decimal]:
        qs = AccountTransaction.objects.filter(user=self.user)
        if account_id is not None:
            qs = qs.filter(trading_account_id=account_id)
        by_day: dict[str, Decimal] = defaultdict(lambda: Decimal('0'))
        for tx in qs:
            day = tx.transaction_date.astimezone(self.user_tz).date().isoformat()
            signed = tx.amount if tx.transaction_type == 'deposit' else -tx.amount
            by_day[day] += signed
        return dict(by_day)

    def test_aggregate_matches_manual_sum(self) -> None:
        self._create_tx('2026-03-01', 'deposit', '100.00')
        self._create_tx('2026-03-01', 'withdrawal', '25.00')
        self._create_tx('2026-03-02', 'deposit', '50.00')

        points = aggregate_daily_net_transactions(
            self.user,
            trading_account_id=self.account.pk,
            timezone_str='Europe/Paris',
        )
        manual = self._manual_daily_net(account_id=self.account.pk)

        self.assertEqual(len(points), len(manual))
        for point in points:
            self.assertEqual(
                Decimal(point['net_transactions']),
                manual[point['date']],
            )

    def test_trading_account_endpoint_matches_function(self) -> None:
        self._create_tx('2026-04-10', 'deposit', '200.00')
        self._create_tx('2026-04-11', 'withdrawal', '75.50')

        url = f'/api/trades/trading-accounts/{self.account.pk}/balance-series/'
        response = self.client.get(url, {'timezone': 'Europe/Paris'})
        self.assertEqual(response.status_code, 200, response.data)

        expected = aggregate_daily_net_transactions(
            self.user,
            trading_account_id=self.account.pk,
            timezone_str='Europe/Paris',
        )
        self.assertEqual(response.json()['points'], expected)

    def test_account_transactions_endpoint_all_accounts(self) -> None:
        other = TradingAccount.objects.create(
            user=self.user,
            name='Other',
            initial_capital=Decimal('1000'),
            status='active',
        )
        self._create_tx('2026-05-01', 'deposit', '10.00')
        AccountTransaction.objects.create(
            user=self.user,
            trading_account=other,
            transaction_type='deposit',
            amount=Decimal('20.00'),
            transaction_date=self.user_tz.localize(datetime(2026, 5, 1, 15)),
        )

        response = self.client.get(
            '/api/trades/account-transactions/balance-series/',
            {'timezone': 'Europe/Paris'},
        )
        self.assertEqual(response.status_code, 200, response.data)

        expected = aggregate_daily_net_transactions(
            self.user,
            trading_account_id=None,
            timezone_str='Europe/Paris',
        )
        self.assertEqual(response.json()['points'], expected)
        self.assertEqual(
            Decimal(response.json()['points'][0]['net_transactions']),
            Decimal('30.00'),
        )
