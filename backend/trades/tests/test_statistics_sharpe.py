"""API statistiques : Sharpe par trade et Sharpe annualisé."""
from decimal import Decimal

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User, UserPreferences
from trades.models import TopStepTrade, TradingAccount
from trades.risk_metrics import compute_sharpe_annualized_from_trades, compute_sharpe_per_trade
from trades.views import get_user_timezone


class StatisticsSharpeApiTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='sharpe-stats@example.com',
            username='sharpe_stats',
            password='testpass123',
            first_name='S',
            last_name='T',
            role='admin',
        )
        UserPreferences.objects.get_or_create(user=self.user)
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='Sharpe stats account',
            account_type='other',
            currency='USD',
            initial_capital=Decimal('10000.00'),
            status='active',
        )
        now = timezone.now()
        samples = [
            Decimal('200.00'),
            Decimal('-100.00'),
            Decimal('150.00'),
            Decimal('-50.00'),
        ]
        for idx, pnl in enumerate(samples):
            TopStepTrade.objects.create(
                user=self.user,
                trading_account=self.account,
                topstep_id=f'sharpe-{idx}',
                contract_name='NQ',
                entered_at=now + timezone.timedelta(days=idx),
                exited_at=now + timezone.timedelta(days=idx, minutes=30),
                entry_price=Decimal('100.000000000'),
                exit_price=Decimal('101.000000000'),
                size=Decimal('1.0000'),
                trade_type='Long',
                trade_day=now.date(),
                pnl=pnl,
                net_pnl=pnl,
            )

    def test_statistics_returns_sharpe_per_trade_and_annualized(self) -> None:
        trades = list(
            TopStepTrade.objects.filter(trading_account=self.account).order_by('entered_at')
        )
        pnls = [float(t.net_pnl) for t in trades]
        expected_per_trade = compute_sharpe_per_trade(pnls)

        class _Req:
            user = self.user

        user_tz = get_user_timezone(_Req())
        expected_annualized = compute_sharpe_annualized_from_trades(
            10000.0,
            trades,
            lambda t: float(t.net_pnl),
            user_tz,
        )

        self.client.force_authenticate(user=self.user)
        response = self.client.get(
            '/api/trades/topstep/statistics/',
            {'trading_account': str(self.account.id)},
        )
        self.assertEqual(response.status_code, 200, response.data)
        data = response.data
        self.assertAlmostEqual(data['sharpe_ratio'], round(expected_per_trade, 2))
        self.assertAlmostEqual(data['sharpe_ratio_annualized'], round(expected_annualized, 2))
        self.assertNotEqual(data['sharpe_ratio_annualized'], 0.0)
