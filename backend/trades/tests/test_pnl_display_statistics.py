"""Statistiques trades : total_pnl suit UserPreferences.pnl_display ; total_net_pnl reste la somme nette."""
from datetime import datetime
from decimal import Decimal

import pytz
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User, UserPreferences
from trades.models import AccountTransaction, TopStepTrade, TradingAccount


class TopStepStatisticsPnlDisplayTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='pnl-stats@example.com',
            username='pnl_stats',
            password='testpass123',
            first_name='S',
            last_name='T',
            role='admin',
        )
        UserPreferences.objects.get_or_create(user=self.user)
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='PnL stats account',
            account_type='other',
            currency='USD',
            initial_capital=Decimal('10000.00'),
            status='active',
        )
        now = timezone.now()
        TopStepTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            topstep_id='pnl-pref-1',
            contract_name='NQ',
            entered_at=now,
            exited_at=now,
            entry_price=Decimal('100.000000000'),
            exit_price=Decimal('101.000000000'),
            size=Decimal('1.0000'),
            trade_type='Long',
            trade_day=now.date(),
            pnl=Decimal('100.000000000'),
            net_pnl=Decimal('80.000000000'),
        )

    def _get_stats(self):
        self.client.force_authenticate(user=self.user)
        return self.client.get('/api/trades/topstep/statistics/')

    def test_net_mode_uses_net_pnl_for_total_pnl(self) -> None:
        prefs = self.user.preferences
        prefs.pnl_display = 'net'
        prefs.save(update_fields=['pnl_display'])

        response = self._get_stats()
        self.assertEqual(response.status_code, 200, response.data)
        data = response.data
        self.assertEqual(Decimal(str(data['total_pnl'])), Decimal('80.00'))
        self.assertEqual(Decimal(str(data['total_net_pnl'])), Decimal('80.00'))
        self.assertEqual(Decimal(str(data['total_raw_pnl'])), Decimal('100.00'))

    def test_gross_mode_uses_pnl_for_total_pnl(self) -> None:
        prefs = self.user.preferences
        prefs.pnl_display = 'gross'
        prefs.save(update_fields=['pnl_display'])

        response = self._get_stats()
        self.assertEqual(response.status_code, 200, response.data)
        data = response.data
        self.assertEqual(Decimal(str(data['total_pnl'])), Decimal('100.00'))
        self.assertEqual(Decimal(str(data['total_net_pnl'])), Decimal('80.00'))
        self.assertEqual(Decimal(str(data['total_raw_pnl'])), Decimal('100.00'))


class CalendarPnlDisplayQueryParamTests(APITestCase):
    """Paramètre pnl_display sur les endpoints calendrier : prime sur les préférences."""

    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='cal-pnl@example.com',
            username='cal_pnl',
            password='testpass123',
            first_name='C',
            last_name='A',
            role='admin',
        )
        UserPreferences.objects.get_or_create(user=self.user)
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='Cal account',
            account_type='other',
            currency='USD',
            initial_capital=Decimal('10000.00'),
            status='active',
        )
        now = timezone.now()
        TopStepTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            topstep_id='cal-pnl-1',
            contract_name='NQ',
            entered_at=now,
            exited_at=now,
            entry_price=Decimal('100.000000000'),
            exit_price=Decimal('101.000000000'),
            size=Decimal('1.0000'),
            trade_type='Long',
            trade_day=now.date(),
            pnl=Decimal('100.000000000'),
            net_pnl=Decimal('80.000000000'),
        )

    def test_calendar_data_query_net_overrides_gross_preference(self) -> None:
        prefs = self.user.preferences
        prefs.pnl_display = 'gross'
        prefs.save(update_fields=['pnl_display'])
        self.client.force_authenticate(user=self.user)
        y = timezone.now().year
        m = timezone.now().month
        url = f'/api/trades/topstep/calendar_data/?year={y}&month={m}&pnl_display=net'
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(float(response.data['monthly_total']), 80.0)

    def test_calendar_data_query_gross_overrides_net_preference(self) -> None:
        prefs = self.user.preferences
        prefs.pnl_display = 'net'
        prefs.save(update_fields=['pnl_display'])
        self.client.force_authenticate(user=self.user)
        y = timezone.now().year
        m = timezone.now().month
        url = f'/api/trades/topstep/calendar_data/?year={y}&month={m}&pnl_display=gross'
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(float(response.data['monthly_total']), 100.0)


class CalendarAccountTransactionTests(APITestCase):
    """calendar_data expose dépôts et retraits par jour."""

    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='cal-tx@example.com',
            username='cal_tx',
            password='testpass123',
            first_name='C',
            last_name='T',
            role='admin',
        )
        prefs, _ = UserPreferences.objects.get_or_create(user=self.user)
        prefs.timezone = 'Europe/Paris'
        prefs.save(update_fields=['timezone'])
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='Cal tx account',
            account_type='other',
            currency='USD',
            initial_capital=Decimal('10000.00'),
            status='active',
        )
        now = timezone.now()
        self.year = now.year
        self.month = now.month
        user_tz = pytz.timezone('Europe/Paris')
        deposit_dt = user_tz.localize(datetime(self.year, self.month, 5, 10, 0, 0))
        withdrawal_dt = user_tz.localize(datetime(self.year, self.month, 15, 14, 0, 0))
        AccountTransaction.objects.create(
            user=self.user,
            trading_account=self.account,
            transaction_type='deposit',
            amount=Decimal('200.00'),
            transaction_date=deposit_dt,
        )
        AccountTransaction.objects.create(
            user=self.user,
            trading_account=self.account,
            transaction_type='withdrawal',
            amount=Decimal('75.50'),
            transaction_date=withdrawal_dt,
        )

    def test_calendar_data_includes_deposit_and_withdrawal_by_day(self) -> None:
        self.client.force_authenticate(user=self.user)
        url = (
            f'/api/trades/topstep/calendar_data/'
            f'?year={self.year}&month={self.month}&trading_account={self.account.id}'
        )
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200, response.data)

        daily_by_day = {int(d['date']): d for d in response.data['daily_data']}

        dep_day = daily_by_day[5]
        self.assertTrue(dep_day['has_deposit'])
        self.assertFalse(dep_day['has_withdrawal'])
        self.assertEqual(dep_day['deposit_count'], 1)
        self.assertEqual(dep_day['withdrawal_count'], 0)
        self.assertEqual(Decimal(dep_day['deposit_total']), Decimal('200.00'))
        self.assertEqual(Decimal(dep_day['withdrawal_total']), Decimal('0'))

        wit_day = daily_by_day[15]
        self.assertFalse(wit_day['has_deposit'])
        self.assertTrue(wit_day['has_withdrawal'])
        self.assertEqual(wit_day['withdrawal_count'], 1)
        self.assertEqual(wit_day['deposit_count'], 0)
        self.assertEqual(Decimal(wit_day['withdrawal_total']), Decimal('75.50'))
        self.assertEqual(Decimal(wit_day['deposit_total']), Decimal('0'))

        empty_day = daily_by_day[1]
        self.assertFalse(empty_day['has_deposit'])
        self.assertFalse(empty_day['has_withdrawal'])
        self.assertEqual(empty_day['deposit_count'], 0)
        self.assertEqual(empty_day['withdrawal_count'], 0)
