"""trade_day = jour d'entrée dans le fuseau de l'utilisateur (save, changement de fuseau, commande)."""
from datetime import date, datetime, timedelta
from decimal import Decimal
from io import StringIO

import pytz
from django.core.management import call_command
from rest_framework.test import APITestCase

from accounts.models import User, UserPreferences
from trades.models import AccountDailyMetrics, ImportedTrade, TradingAccount
from trades.services.trade_day_service import recalculate_trade_days_for_user


class TradeDayTimezoneTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='trade-day-tz@example.com',
            username='trade_day_tz',
            password='testpass123',
            first_name='T',
            last_name='Z',
            role='admin',
        )
        self.prefs, _ = UserPreferences.objects.get_or_create(user=self.user)
        self.prefs.timezone = 'Europe/Paris'
        self.prefs.save(update_fields=['timezone'])
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='TZ account',
            account_type='other',
            currency='USD',
            initial_capital=Decimal('10000.00'),
            status='active',
        )
        self._seq = 0

    def _trade(self, entered_at, user=None) -> ImportedTrade:
        self._seq += 1
        return ImportedTrade.objects.create(
            user=user or self.user,
            trading_account=self.account,
            external_trade_id=f'tz-{self._seq}',
            contract_name='NQ',
            entered_at=entered_at,
            exited_at=entered_at + timedelta(minutes=5),
            entry_price=Decimal('100'),
            exit_price=Decimal('101'),
            size=Decimal('1'),
            trade_type='Long',
            pnl=Decimal('10'),
        )

    def _set_timezone(self, tz_name: str) -> None:
        prefs = UserPreferences.objects.get(user=self.user)
        prefs.timezone = tz_name
        with self.captureOnCommitCallbacks(execute=True):
            prefs.save(update_fields=['timezone'])

    def test_save_uses_owner_timezone_for_utc_entered_at(self) -> None:
        # 01/09 00:30 Paris = 31/08 22:30 UTC
        trade = self._trade(pytz.UTC.localize(datetime(2026, 8, 31, 22, 30)))
        self.assertEqual(trade.trade_day, date(2026, 9, 1))

    def test_save_overrides_imported_trade_day(self) -> None:
        trade = self._trade(pytz.UTC.localize(datetime(2026, 8, 31, 22, 30)))
        trade.trade_day = date(2026, 8, 31)
        trade.save()
        trade.refresh_from_db()
        self.assertEqual(trade.trade_day, date(2026, 9, 1))

    def test_timezone_change_recalculates_trade_days(self) -> None:
        trade = self._trade(pytz.UTC.localize(datetime(2026, 8, 31, 22, 30)))
        self.assertEqual(trade.trade_day, date(2026, 9, 1))

        self._set_timezone('America/New_York')  # 31/08 18:30 New York
        trade.refresh_from_db()
        self.assertEqual(trade.trade_day, date(2026, 8, 31))

        self._set_timezone('Europe/Paris')
        trade.refresh_from_db()
        self.assertEqual(trade.trade_day, date(2026, 9, 1))

    def test_saving_other_preferences_does_not_recalculate(self) -> None:
        trade = self._trade(pytz.UTC.localize(datetime(2026, 8, 31, 22, 30)))
        ImportedTrade.objects.filter(pk=trade.pk).update(trade_day=date(2020, 1, 1))  # état hérité
        prefs = UserPreferences.objects.get(user=self.user)
        prefs.pnl_display = 'gross'
        with self.captureOnCommitCallbacks(execute=True):
            prefs.save(update_fields=['pnl_display'])
        trade.refresh_from_db()
        self.assertEqual(trade.trade_day, date(2020, 1, 1))

    def test_timezone_change_refreshes_mll_metrics(self) -> None:
        self.account.mll_enabled = True
        self.account.maximum_loss_limit = Decimal('2000.00')
        self.account.save()
        self._trade(pytz.UTC.localize(datetime(2026, 8, 31, 22, 30)))
        self.assertTrue(
            AccountDailyMetrics.objects.filter(trading_account=self.account, date=date(2026, 9, 1)).exists()
        )

        self._set_timezone('America/New_York')

        dates = set(AccountDailyMetrics.objects.filter(trading_account=self.account).values_list('date', flat=True))
        self.assertIn(date(2026, 8, 31), dates)
        self.assertNotIn(date(2026, 9, 1), dates)

    def test_service_fixes_legacy_rows_and_supports_dry_run(self) -> None:
        trade = self._trade(pytz.UTC.localize(datetime(2026, 8, 31, 22, 30)))
        ImportedTrade.objects.filter(pk=trade.pk).update(trade_day=date(2026, 8, 31))  # ancienne date UTC

        self.assertEqual(recalculate_trade_days_for_user(self.user.id, dry_run=True), 1)
        trade.refresh_from_db()
        self.assertEqual(trade.trade_day, date(2026, 8, 31))

        self.assertEqual(recalculate_trade_days_for_user(self.user.id), 1)
        trade.refresh_from_db()
        self.assertEqual(trade.trade_day, date(2026, 9, 1))
        self.assertEqual(recalculate_trade_days_for_user(self.user.id), 0)

    def test_management_command(self) -> None:
        trade = self._trade(pytz.UTC.localize(datetime(2026, 8, 31, 22, 30)))
        ImportedTrade.objects.filter(pk=trade.pk).update(trade_day=date(2026, 8, 31))
        out = StringIO()
        call_command('recalculate_trade_days', '--user-id', str(self.user.id), stdout=out)
        trade.refresh_from_db()
        self.assertEqual(trade.trade_day, date(2026, 9, 1))
        self.assertIn('1 trade(s) corrigé(s)', out.getvalue())
