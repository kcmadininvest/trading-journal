"""Statistiques trades : total_pnl suit UserPreferences.pnl_display ; total_net_pnl reste la somme nette."""
from datetime import date, datetime
from decimal import Decimal

import pytz
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User, UserPreferences
from trades.models import AccountTransaction, ImportedTrade, TradeStrategy, TradingAccount


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
        ImportedTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            external_trade_id='pnl-pref-1',
            contract_name='NQ',
            entered_at=now,
            exited_at=now,
            entry_price=Decimal('100.000000000'),
            exit_price=Decimal('101.000000000'),
            size=Decimal('1.0000'),
            trade_type='Long',
            trade_day=now.date(),
            pnl=Decimal('100.000000000'),
            # save() recalcule net_pnl = pnl - fees - commissions → 80
            fees=Decimal('20.00'),
        )

    def _get_stats(self):
        self.client.force_authenticate(user=self.user)
        return self.client.get('/api/trades/imported/statistics/')

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
        ImportedTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            external_trade_id='cal-pnl-1',
            contract_name='NQ',
            entered_at=now,
            exited_at=now,
            entry_price=Decimal('100.000000000'),
            exit_price=Decimal('101.000000000'),
            size=Decimal('1.0000'),
            trade_type='Long',
            trade_day=now.date(),
            pnl=Decimal('100.000000000'),
            # save() recalcule net_pnl = pnl - fees - commissions → 80
            fees=Decimal('20.00'),
        )

    def test_calendar_data_query_net_overrides_gross_preference(self) -> None:
        prefs = self.user.preferences
        prefs.pnl_display = 'gross'
        prefs.save(update_fields=['pnl_display'])
        self.client.force_authenticate(user=self.user)
        y = timezone.now().year
        m = timezone.now().month
        url = f'/api/trades/imported/calendar_data/?year={y}&month={m}&pnl_display=net'
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
        url = f'/api/trades/imported/calendar_data/?year={y}&month={m}&pnl_display=gross'
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
            f'/api/trades/imported/calendar_data/'
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


class CalendarAdjacentDaysAndTimezoneTests(APITestCase):
    """
    calendar_data : jours du mois précédent/suivant visibles dans la grille (adjacent_days),
    total mensuel limité au mois, et rattachement des trades au jour du fuseau utilisateur
    (cases, pastille de compliance, fenêtres « trades du jour » et compliance du calendrier).
    """

    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='cal-adj@example.com',
            username='cal_adj',
            password='testpass123',
            first_name='C',
            last_name='A',
            role='admin',
        )
        prefs, _ = UserPreferences.objects.get_or_create(user=self.user)
        prefs.timezone = 'Europe/Paris'
        prefs.pnl_display = 'net'
        prefs.save(update_fields=['timezone', 'pnl_display'])
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='Cal adj account',
            account_type='other',
            currency='USD',
            initial_capital=Decimal('10000.00'),
            status='active',
        )
        self.paris = pytz.timezone('Europe/Paris')
        self.client.force_authenticate(user=self.user)
        self._seq = 0

    def _trade(self, entered_at: datetime, net_pnl: str) -> ImportedTrade:
        self._seq += 1
        return ImportedTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            external_trade_id=f'cal-adj-{self._seq}',
            contract_name='NQ',
            entered_at=entered_at,
            exited_at=entered_at,
            entry_price=Decimal('100'),
            exit_price=Decimal('101'),
            size=Decimal('1'),
            trade_type='Long',
            pnl=Decimal(net_pnl),
            net_pnl=Decimal(net_pnl),
        )

    def _paris(self, *args) -> datetime:
        return self.paris.localize(datetime(*args))

    def _calendar(self, year: int, month: int):
        response = self.client.get(
            f'/api/trades/imported/calendar_data/?year={year}&month={month}&trading_account={self.account.id}'
        )
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def test_adjacent_days_cover_grid_only_and_monthly_total_is_month_only(self) -> None:
        # Septembre 2026 : du mardi 1er au mercredi 30 → grille du dim. 30/08 au sam. 03/10
        self._trade(self._paris(2026, 8, 29, 12, 0), '999')   # hors grille
        self._trade(self._paris(2026, 8, 31, 12, 0), '30')    # lundi, première ligne
        self._trade(self._paris(2026, 9, 15, 12, 0), '100')
        self._trade(self._paris(2026, 10, 2, 12, 0), '50')    # vendredi, dernière ligne
        self._trade(self._paris(2026, 10, 4, 12, 0), '999')   # hors grille

        data = self._calendar(2026, 9)

        self.assertEqual(
            [(d['date'], d['pnl'], d['trade_count']) for d in data['adjacent_days']],
            [('2026-08-31', 30.0, 1), ('2026-10-02', 50.0, 1)],
        )
        self.assertEqual(float(data['monthly_total']), 100.0)
        self.assertEqual(sum(d['pnl'] for d in data['daily_data']), 100.0)

    def test_no_adjacent_days_when_month_aligned_on_weeks(self) -> None:
        # Février 2026 : du dimanche 1er au samedi 28
        self._trade(self._paris(2026, 1, 31, 12, 0), '10')
        self._trade(self._paris(2026, 3, 1, 12, 0), '10')
        data = self._calendar(2026, 2)
        self.assertEqual(data['adjacent_days'], [])
        self.assertEqual(float(data['monthly_total']), 0.0)

    def test_trades_near_midnight_use_user_timezone_day(self) -> None:
        # 01/09 00:30 Paris = 31/08 22:30 UTC : save() calcule trade_day = 01/09 (fuseau utilisateur)
        early = self._trade(pytz.utc.localize(datetime(2026, 8, 31, 22, 30)), '40')
        self.assertEqual(early.trade_day.isoformat(), '2026-09-01')
        # Ligne héritée (trade_day = date UTC, écrit sans save()) : le calendrier suit entered_at
        ImportedTrade.objects.filter(pk=early.pk).update(trade_day=date(2026, 8, 31))
        TradeStrategy.objects.create(
            user=self.user, trade=early, strategy_respected=True,
            tp1_reached=False, tp2_plus_reached=False,
        )
        # 01/10 00:30 Paris = 30/09 22:30 UTC : appartient au mois suivant
        self._trade(pytz.utc.localize(datetime(2026, 9, 30, 22, 30)), '7')

        data = self._calendar(2026, 9)
        daily = {int(d['date']): d for d in data['daily_data']}

        self.assertEqual(daily[1]['trade_count'], 1)
        self.assertEqual(daily[1]['pnl'], 40.0)
        self.assertEqual(daily[1]['strategy_compliance_status'], 'compliant')
        self.assertEqual(daily[30]['trade_count'], 0)
        self.assertEqual(float(data['monthly_total']), 40.0)
        self.assertEqual(
            [(d['date'], d['pnl']) for d in data['adjacent_days']],
            [('2026-10-01', 7.0)],
        )

    def test_day_trades_list_uses_user_timezone_bounds(self) -> None:
        early = self._trade(pytz.utc.localize(datetime(2026, 8, 31, 22, 30)), '40')
        # Dernière seconde de la journée (fraction de seconde incluse)
        late = self._trade(self._paris(2026, 9, 2, 23, 59, 59, 500000), '5')

        def ids(start: str, end: str) -> set:
            response = self.client.get(
                f'/api/trades/imported/?start_date={start}&end_date={end}&trading_account={self.account.id}'
            )
            self.assertEqual(response.status_code, 200, response.data)
            return {t['id'] for t in response.data['results']}

        self.assertEqual(ids('2026-09-01', '2026-09-01'), {early.id})
        self.assertEqual(ids('2026-08-31', '2026-08-31'), set())
        self.assertEqual(ids('2026-09-02', '2026-09-02'), {late.id})
        self.assertEqual(ids('2026-09-03', '2026-09-03'), set())

    def test_strategies_by_date_day_basis(self) -> None:
        early = self._trade(pytz.utc.localize(datetime(2026, 8, 31, 22, 30)), '40')
        strategy = TradeStrategy.objects.create(
            user=self.user, trade=early, strategy_respected=True,
            tp1_reached=False, tp2_plus_reached=False,
        )
        # Ligne héritée (trade_day = date UTC, écrit sans save()) pour distinguer les deux bases
        ImportedTrade.objects.filter(pk=early.pk).update(trade_day=date(2026, 8, 31))

        def ids(query: str) -> list:
            response = self.client.get(f'/api/trades/trade-strategies/by_date/?{query}')
            self.assertEqual(response.status_code, 200, response.data)
            return [s['id'] for s in response.data]

        # Calendrier : jour du fuseau utilisateur
        self.assertEqual(ids('date=2026-09-01&day_basis=entered_at'), [strategy.id])
        self.assertEqual(ids('date=2026-08-31&day_basis=entered_at'), [])
        # Autres pages (défaut) : comportement historique sur trade_day conservé
        self.assertEqual(ids('date=2026-08-31'), [strategy.id])
        self.assertEqual(ids('date=2026-09-01'), [])
