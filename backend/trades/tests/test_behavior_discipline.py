"""Tests pour les indicateurs de discipline comportementale."""
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User, UserPreferences
from trades.models import ImportedTrade, TradingAccount
from trades.services.behavior_discipline import (
    compute_behavior_discipline,
    compute_revenge_trading,
    compute_sizing_discipline,
    empty_behavior_discipline,
)


class BehaviorDisciplineServiceTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='behavior-disc@example.com',
            username='behavior_disc',
            password='testpass123',
            first_name='B',
            last_name='D',
            role='admin',
        )
        UserPreferences.objects.get_or_create(user=self.user)
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='Behavior account',
            account_type='other',
            currency='USD',
            initial_capital=Decimal('10000.00'),
            status='active',
        )
        self.base_time = timezone.now()
        self.pnl_field = 'net_pnl'

    def _create_trade(
        self,
        external_trade_id: str,
        offset_minutes: int,
        size: str,
        pnl: str,
        contract_name: str = 'NQ',
        trade_day: Optional[date] = None,
    ) -> ImportedTrade:
        entered = self.base_time + timedelta(minutes=offset_minutes)
        day = trade_day or entered.date()
        return ImportedTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            external_trade_id=external_trade_id,
            contract_name=contract_name,
            entered_at=entered,
            exited_at=entered + timedelta(minutes=10),
            entry_price=Decimal('100.000000000'),
            exit_price=Decimal('101.000000000'),
            size=Decimal(size),
            trade_type='Long',
            trade_day=day,
            pnl=Decimal(pnl),
            net_pnl=Decimal(pnl),
            point_value=Decimal('20'),
        )

    def test_empty_behavior_discipline(self) -> None:
        empty = empty_behavior_discipline()
        self.assertEqual(empty['revenge_trading']['days_after_negative'], 0)
        self.assertEqual(empty['sizing_discipline']['winning_trades_count'], 0)

    def test_revenge_trading_after_negative_vs_positive(self) -> None:
        d1, d2, d3, d4 = date(2025, 1, 6), date(2025, 1, 7), date(2025, 1, 8), date(2025, 1, 9)
        daily_data = {
            d1: {'pnl': -100.0, 'trade_count': 2},
            d2: {'pnl': 50.0, 'trade_count': 5},
            d3: {'pnl': -50.0, 'trade_count': 4},
            d4: {'pnl': 30.0, 'trade_count': 2},
        }
        # Add more days for sufficient data
        d5, d6 = date(2025, 1, 10), date(2025, 1, 13)
        daily_data[d5] = {'pnl': 20.0, 'trade_count': 3}
        daily_data[d6] = {'pnl': -10.0, 'trade_count': 1}
        d7 = date(2025, 1, 14)
        daily_data[d7] = {'pnl': 10.0, 'trade_count': 2}

        result = compute_revenge_trading(daily_data)
        # after d1(-), d3(-), d6(-): trade counts 5, 4, 2 -> avg (5+4+2)/3 = 3.67
        self.assertEqual(result['days_after_negative'], 3)
        # after d2(+), d4(+), d5(+), d7(+): 2, 3, 2 -> avg 2.25
        self.assertEqual(result['days_after_positive'], 4)
        self.assertAlmostEqual(result['avg_trades_after_negative_day'], 3.67, places=1)
        self.assertAlmostEqual(result['avg_trades_after_positive_day'], 2.25, places=1)
        self.assertTrue(result['has_sufficient_data'])
        self.assertIsNotNone(result['pct_increase'])
        self.assertGreater(result['pct_increase'], 0)

    def test_revenge_ignores_break_even_previous_day(self) -> None:
        d1, d2, d3, d4 = date(2025, 2, 1), date(2025, 2, 2), date(2025, 2, 3), date(2025, 2, 4)
        daily_data = {
            d1: {'pnl': 0.0, 'trade_count': 1},
            d2: {'pnl': -10.0, 'trade_count': 2},
            d3: {'pnl': 0.0, 'trade_count': 99},
            d4: {'pnl': 10.0, 'trade_count': 3},
        }
        result = compute_revenge_trading(daily_data)
        # d3 follows break-even d2? No - d2 is negative, d3 follows d2 -> after_negative with 99? 
        # d2 prev is d1 break-even -> d2 not counted in after buckets from d1
        # d3 prev d2 negative -> after_negative 99
        # d4 prev d3 break-even -> skipped
        self.assertEqual(result['days_after_negative'], 1)
        self.assertEqual(result['avg_trades_after_negative_day'], 99.0)

    def test_sizing_discipline_winners_smaller_than_losers(self) -> None:
        self._create_trade('w1', 0, '2', '50')
        self._create_trade('w2', 10, '2', '30')
        self._create_trade('w3', 20, '2', '40')
        self._create_trade('w4', 30, '2', '20')
        self._create_trade('w5', 40, '2', '10')
        self._create_trade('l1', 50, '4', '-50')
        self._create_trade('l2', 60, '4', '-30')
        self._create_trade('l3', 70, '4', '-40')
        self._create_trade('l4', 80, '4', '-20')
        self._create_trade('l5', 90, '4', '-10')

        qs = ImportedTrade.objects.filter(trading_account=self.account)
        result = compute_sizing_discipline(qs, self.pnl_field)
        # winners size 2 * 20 = 40, losers 4 * 20 = 80 -> 100% larger
        self.assertEqual(result['avg_size_winning_trades'], 40.0)
        self.assertEqual(result['avg_size_losing_trades'], 80.0)
        self.assertEqual(result['pct_larger_on_losers'], 100.0)
        self.assertTrue(result['has_sufficient_data'])
        self.assertEqual(result['alert_level'], 'warning')

    def test_analytics_includes_behavior_discipline(self) -> None:
        d = date(2025, 3, 1)
        for i in range(6):
            pnl = '-10' if i % 2 == 0 else '10'
            size = '3' if pnl.startswith('-') else '1'
            self._create_trade(
                f't{i}',
                i * 15,
                size,
                pnl,
                trade_day=d + timedelta(days=i // 2),
            )

        self.client.force_authenticate(user=self.user)
        response = self.client.get(
            '/api/trades/imported/analytics/',
            {'trading_account': self.account.id},
        )
        self.assertEqual(response.status_code, 200, response.data)
        bd = response.data.get('behavior_discipline')
        self.assertIsNotNone(bd)
        self.assertIn('revenge_trading', bd)
        self.assertIn('sizing_discipline', bd)
        self.assertIn('avg_trades_after_negative_day', bd['revenge_trading'])
        self.assertIn('avg_size_winning_trades', bd['sizing_discipline'])

    def test_analytics_empty_behavior_discipline_without_trades(self) -> None:
        self.client.force_authenticate(user=self.user)
        response = self.client.get(
            '/api/trades/imported/analytics/',
            {'trading_account': self.account.id},
        )
        self.assertEqual(response.status_code, 200)
        bd = response.data['behavior_discipline']
        self.assertFalse(bd['revenge_trading']['has_sufficient_data'])
        self.assertFalse(bd['sizing_discipline']['has_sufficient_data'])
