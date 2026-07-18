"""daily_aggregates : filtrage dates aligné sur le fuseau des préférences utilisateur."""
from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal

import pytz
from rest_framework.test import APITestCase

from accounts.models import User, UserPreferences
from trades.models import ImportedTrade, TradingAccount


class DailyAggregatesTimezoneTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='daily-agg-tz@example.com',
            username='daily_agg_tz',
            password='testpass123',
            first_name='D',
            last_name='A',
            role='admin',
        )
        prefs, _ = UserPreferences.objects.get_or_create(user=self.user)
        prefs.timezone = 'America/New_York'
        prefs.save(update_fields=['timezone'])

        self.account = TradingAccount.objects.create(
            user=self.user,
            name='TZ account',
            account_type='other',
            currency='USD',
            initial_capital=Decimal('10000.00'),
            status='active',
        )
        self.ny_tz = pytz.timezone('America/New_York')
        self.client.force_authenticate(user=self.user)

    def _create_trade(self, entered_at: datetime, trade_day: date, pnl: str = '100.00') -> None:
        ImportedTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            external_trade_id=f'tz-{entered_at.isoformat()}',
            contract_name='NQ',
            entered_at=entered_at,
            exited_at=entered_at + timedelta(hours=1),
            entry_price=Decimal('100.000000000'),
            exit_price=Decimal('101.000000000'),
            size=Decimal('1.0000'),
            trade_type='Long',
            trade_day=trade_day,
            pnl=Decimal(pnl),
            net_pnl=Decimal(pnl),
        )

    def test_daily_aggregates_date_filter_uses_user_timezone(self) -> None:
        # 2026-05-25 02:00 UTC = 2026-05-24 22:00 NY (still May 24 in user TZ)
        entered_ny_may24 = pytz.UTC.localize(datetime(2026, 5, 25, 2, 0, 0))
        self._create_trade(entered_ny_may24, date(2026, 5, 24), pnl='50.00')

        # 2026-05-25 14:00 UTC = 2026-05-25 10:00 NY
        entered_ny_may25 = pytz.UTC.localize(datetime(2026, 5, 25, 14, 0, 0))
        self._create_trade(entered_ny_may25, date(2026, 5, 25), pnl='75.00')

        url = (
            f'/api/trades/imported/daily_aggregates/'
            f'?trading_account={self.account.id}'
            f'&start_date=2026-05-25&end_date=2026-05-25'
        )
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        results = response.data['results']
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['date'], '2026-05-25')
        self.assertEqual(results[0]['pnl'], 75.0)

    def test_daily_aggregates_without_dates_returns_all_days(self) -> None:
        entered = self.ny_tz.localize(datetime(2026, 6, 1, 10, 0, 0))
        self._create_trade(entered, date(2026, 6, 1), pnl='40.00')

        url = f'/api/trades/imported/daily_aggregates/?trading_account={self.account.id}'
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['pnl'], 40.0)
