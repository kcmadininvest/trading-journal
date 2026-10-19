"""IDOR : ownership des FK trade / trading_account (écriture + lecture croisée)."""
from datetime import date, timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User
from daily_journal.models import DailyJournalEntry
from trades.models import (
    DayStrategyCompliance,
    ImportedTrade,
    TradeStrategy,
    TradingAccount,
    TradingGoal,
)


class IdorOwnershipTests(APITestCase):
    def setUp(self) -> None:
        # role admin : évite le gate Premium sur goals / stratégies / compliance
        self.user_a = User.objects.create_user(
            email='idor-a@example.com',
            username='idor_a',
            password='testpass123',
            first_name='A',
            last_name='User',
            role='admin',
        )
        self.user_b = User.objects.create_user(
            email='idor-b@example.com',
            username='idor_b',
            password='testpass123',
            first_name='B',
            last_name='User',
            role='admin',
        )
        self.account_a = TradingAccount.objects.create(
            user=self.user_a,
            name='Account A',
            account_type='other',
            currency='USD',
            initial_capital=Decimal('10000.00'),
            status='active',
            is_default=True,
        )
        self.account_b = TradingAccount.objects.create(
            user=self.user_b,
            name='Account B',
            account_type='other',
            currency='USD',
            initial_capital=Decimal('10000.00'),
            status='active',
            is_default=True,
        )
        now = timezone.now()
        self.trade_a = ImportedTrade.objects.create(
            user=self.user_a,
            trading_account=self.account_a,
            external_trade_id='idor-trade-a',
            contract_name='MNQ',
            entered_at=now,
            exited_at=now,
            entry_price=Decimal('100'),
            exit_price=Decimal('110'),
            size=Decimal('1'),
            trade_type='Long',
            trade_day=now.date(),
            pnl=Decimal('10'),
        )
        self.trade_b = ImportedTrade.objects.create(
            user=self.user_b,
            trading_account=self.account_b,
            external_trade_id='idor-trade-b',
            contract_name='MNQ',
            entered_at=now,
            exited_at=now,
            entry_price=Decimal('100'),
            exit_price=Decimal('90'),
            size=Decimal('1'),
            trade_type='Long',
            trade_day=now.date(),
            pnl=Decimal('-10'),
        )

    def test_trade_strategy_rejects_alien_trade(self) -> None:
        self.client.force_authenticate(user=self.user_a)
        response = self.client.post(
            '/api/trades/trade-strategies/',
            {'trade': self.trade_b.id, 'strategy_respected': True},
            format='json',
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('trade', response.data)

    def test_imported_trade_rejects_alien_account(self) -> None:
        self.client.force_authenticate(user=self.user_a)
        now = timezone.now()
        response = self.client.post(
            '/api/trades/imported/',
            {
                'trading_account': self.account_b.id,
                'contract_name': 'ES',
                'trade_type': 'Long',
                'entered_at': now.isoformat(),
                'exited_at': now.isoformat(),
                'entry_price': '1',
                'exit_price': '2',
                'size': '1',
                'trade_day': now.date().isoformat(),
            },
            format='json',
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('trading_account', response.data)

    def test_imported_trade_get_alien_returns_404(self) -> None:
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get(f'/api/trades/imported/{self.trade_b.id}/')
        self.assertEqual(response.status_code, 404)

    def test_trading_account_get_alien_returns_404(self) -> None:
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get(f'/api/trades/trading-accounts/{self.account_b.id}/')
        self.assertEqual(response.status_code, 404)

    def test_statistics_ignore_foreign_user_trades_on_account(self) -> None:
        # Pollution FK : trade de B rattaché au compte de A (bypass ORM direct)
        polluted = ImportedTrade.objects.create(
            user=self.user_b,
            trading_account=self.account_a,
            external_trade_id='idor-polluted',
            contract_name='MNQ',
            entered_at=timezone.now(),
            exited_at=timezone.now(),
            entry_price=Decimal('1'),
            exit_price=Decimal('2'),
            size=Decimal('1'),
            trade_type='Long',
            trade_day=timezone.now().date(),
            pnl=Decimal('999'),
        )
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get(
            f'/api/trades/trading-accounts/{self.account_a.id}/statistics/'
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['total_trades'], 1)
        polluted.delete()

    def test_goal_rejects_alien_account(self) -> None:
        self.client.force_authenticate(user=self.user_a)
        today = date.today()
        response = self.client.post(
            '/api/trades/goals/',
            {
                'goal_type': 'pnl_total',
                'direction': 'maximize',
                'period_type': 'monthly',
                'threshold_target': '1000',
                'start_date': today.isoformat(),
                'end_date': (today + timedelta(days=30)).isoformat(),
                'trading_account': self.account_b.id,
            },
            format='json',
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('trading_account', response.data)

    def test_day_compliance_rejects_alien_account(self) -> None:
        self.client.force_authenticate(user=self.user_a)
        response = self.client.post(
            '/api/trades/day-strategy-compliances/',
            {
                'date': date.today().isoformat(),
                'trading_account': self.account_b.id,
                'strategy_respected': True,
            },
            format='json',
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('trading_account', response.data)

    def test_journal_entry_rejects_alien_account(self) -> None:
        self.client.force_authenticate(user=self.user_a)
        response = self.client.post(
            '/api/daily-journal/entries/',
            {
                'date': date.today().isoformat(),
                'content': 'note',
                'trading_account': self.account_b.id,
            },
            format='json',
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('trading_account', response.data)

    def test_admin_users_forbidden_for_regular_user(self) -> None:
        regular = User.objects.create_user(
            email='idor-regular@example.com',
            username='idor_regular',
            password='testpass123',
            first_name='R',
            last_name='User',
            role='user',
        )
        self.client.force_authenticate(user=regular)
        response = self.client.get('/api/accounts/admin/users/')
        self.assertEqual(response.status_code, 403)

    def test_profile_anonymous_401(self) -> None:
        response = self.client.get('/api/accounts/profile/')
        self.assertEqual(response.status_code, 401)
