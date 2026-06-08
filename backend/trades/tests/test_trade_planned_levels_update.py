"""Mise à jour PATCH d'un trade : effacement des niveaux SL/TP prévus."""
from decimal import Decimal

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User
from trades.models import TopStepTrade, TradingAccount


class TopStepTradePlannedLevelsUpdateTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='planned-levels@example.com',
            username='planned_levels',
            password='testpass123',
            first_name='P',
            last_name='L',
            role='admin',
        )
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='Planned levels account',
            account_type='other',
            currency='USD',
            initial_capital=Decimal('10000.00'),
            status='active',
        )
        now = timezone.now()
        self.trade = TopStepTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            topstep_id='planned-levels-1',
            contract_name='CON.FUS.MNQ.M26',
            entered_at=now,
            exited_at=now,
            entry_price=Decimal('29573.750000000'),
            exit_price=Decimal('29544.000000000'),
            size=Decimal('1.0000'),
            trade_type='Long',
            trade_day=now.date(),
            pnl=Decimal('-29.750000000'),
            planned_stop_loss=Decimal('29544.000000000'),
            planned_take_profit=Decimal('29584.000000000'),
            planned_risk_reward_ratio=Decimal('0.9700'),
            actual_risk_reward_ratio=Decimal('0.3700'),
        )

    def test_patch_null_clears_planned_stop_loss_and_take_profit(self) -> None:
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(
            f'/api/trades/topstep/{self.trade.id}/',
            {
                'planned_stop_loss': None,
                'planned_take_profit': None,
            },
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.data)

        self.trade.refresh_from_db()
        self.assertIsNone(self.trade.planned_stop_loss)
        self.assertIsNone(self.trade.planned_take_profit)
        self.assertIsNone(self.trade.planned_risk_reward_ratio)
        self.assertIsNone(self.trade.actual_risk_reward_ratio)

        self.assertIsNone(response.data['planned_stop_loss'])
        self.assertIsNone(response.data['planned_take_profit'])
        self.assertIsNone(response.data['planned_risk_reward_ratio'])
        self.assertIsNone(response.data['actual_risk_reward_ratio'])
