"""Tests endpoint / service monte_carlo_inputs (médiane risk_units)."""
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal
from typing import Optional

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User, UserPreferences
from trades.models import TopStepTrade, TradingAccount
from trades.services.monte_carlo_inputs import compute_monte_carlo_exposure_inputs


class MonteCarloInputsServiceTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='mc-inputs@example.com',
            username='mc_inputs',
            password='testpass123',
            first_name='M',
            last_name='C',
            role='admin',
        )
        UserPreferences.objects.get_or_create(user=self.user)
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='MC inputs account',
            account_type='other',
            currency='USD',
            initial_capital=Decimal('10000.00'),
            status='active',
        )
        self.base_time = timezone.now()

    def _create_trade(
        self,
        topstep_id: str,
        size: str,
        contract_name: str = 'MNQ',
        point_value: Optional[str] = '2',
    ) -> TopStepTrade:
        entered = self.base_time + timedelta(minutes=int(topstep_id.replace('mc-', '') or 0))
        kwargs: dict = {}
        if point_value is not None:
            kwargs['point_value'] = Decimal(point_value)
        return TopStepTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            topstep_id=topstep_id,
            contract_name=contract_name,
            entered_at=entered,
            exited_at=entered + timedelta(minutes=5),
            entry_price=Decimal('100.000000000'),
            exit_price=Decimal('101.000000000'),
            size=Decimal(size),
            trade_type='Long',
            trade_day=entered.date(),
            pnl=Decimal('10'),
            net_pnl=Decimal('10'),
            **kwargs,
        )

    def test_median_risk_units_three_mnq_trades(self) -> None:
        self._create_trade('mc-1', '1', point_value='2')
        self._create_trade('mc-2', '2', point_value='2')
        self._create_trade('mc-3', '3', point_value='2')

        qs = TopStepTrade.objects.filter(user=self.user, trading_account=self.account)
        result = compute_monte_carlo_exposure_inputs(qs)

        self.assertEqual(result['median_risk_units'], 4.0)
        self.assertEqual(result['trades_with_risk_units'], 3)
        self.assertEqual(result['skipped_unknown_contract'], 0)

    def test_point_value_resolved_from_contract_when_missing(self) -> None:
        self._create_trade('mc-10', '1', contract_name='MNQ', point_value=None)

        qs = TopStepTrade.objects.filter(user=self.user, trading_account=self.account)
        result = compute_monte_carlo_exposure_inputs(qs)

        self.assertEqual(result['median_risk_units'], 2.0)
        self.assertEqual(result['trades_with_risk_units'], 1)

    def test_unknown_contract_incremented_skipped(self) -> None:
        self._create_trade('mc-20', '1', contract_name='UNKNOWN.XYZ', point_value=None)

        qs = TopStepTrade.objects.filter(user=self.user, trading_account=self.account)
        result = compute_monte_carlo_exposure_inputs(qs)

        self.assertIsNone(result['median_risk_units'])
        self.assertEqual(result['trades_with_risk_units'], 0)
        self.assertEqual(result['skipped_unknown_contract'], 1)


class MonteCarloInputsAPITests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='mc-api@example.com',
            username='mc_api',
            password='testpass123',
            first_name='M',
            last_name='A',
            role='admin',
        )
        UserPreferences.objects.get_or_create(user=self.user)
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='MC API account',
            account_type='other',
            currency='USD',
            initial_capital=Decimal('10000.00'),
            status='active',
        )
        self.client.force_authenticate(user=self.user)
        entered = timezone.now()
        TopStepTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            topstep_id='mc-api-1',
            contract_name='MNQ',
            entered_at=entered,
            exited_at=entered + timedelta(minutes=5),
            entry_price=Decimal('100.000000000'),
            exit_price=Decimal('101.000000000'),
            size=Decimal('1'),
            trade_type='Long',
            trade_day=entered.date(),
            pnl=Decimal('10'),
            net_pnl=Decimal('10'),
            point_value=Decimal('2'),
        )

    def test_monte_carlo_inputs_endpoint(self) -> None:
        url = f'/api/trades/topstep/monte_carlo_inputs/?trading_account={self.account.id}'
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['median_risk_units'], 2.0)
        self.assertEqual(response.data['trades_with_risk_units'], 1)
