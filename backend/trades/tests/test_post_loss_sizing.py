"""Tests pour l'indicateur taille après perte (post-loss sizing)."""
from datetime import timedelta
from decimal import Decimal
from typing import Optional

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User, UserPreferences
from trades.models import TopStepTrade, TradingAccount
from trades.services.post_loss_sizing import compute_post_loss_sizing


class PostLossSizingServiceTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='post-loss@example.com',
            username='post_loss',
            password='testpass123',
            first_name='P',
            last_name='L',
            role='admin',
        )
        UserPreferences.objects.get_or_create(user=self.user)
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='Post loss account',
            account_type='other',
            currency='USD',
            initial_capital=Decimal('10000.00'),
            status='active',
        )
        self.base_time = timezone.now()

    def _create_trade(
        self,
        topstep_id: str,
        offset_minutes: int,
        size: str,
        pnl: str,
        net_pnl: Optional[str] = None,
    ) -> TopStepTrade:
        entered = self.base_time + timedelta(minutes=offset_minutes)
        net = net_pnl if net_pnl is not None else pnl
        return TopStepTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            topstep_id=topstep_id,
            contract_name='NQ',
            entered_at=entered,
            exited_at=entered + timedelta(minutes=5),
            entry_price=Decimal('100.000000000'),
            exit_price=Decimal('101.000000000'),
            size=Decimal(size),
            trade_type='Long',
            trade_day=entered.date(),
            pnl=Decimal(pnl),
            net_pnl=Decimal(net),
        )

    def test_classifies_larger_equal_smaller_vs_losing_trade(self) -> None:
        self._create_trade('pl-1', 0, '2', '-50', '-50')
        self._create_trade('pl-2', 10, '3', '20', '20')
        self._create_trade('pl-3', 20, '3', '-30', '-30')
        self._create_trade('pl-4', 30, '3', '10', '10')
        self._create_trade('pl-5', 40, '3', '-20', '-20')
        self._create_trade('pl-6', 50, '1', '5', '5')

        qs = TopStepTrade.objects.filter(user=self.user, trading_account=self.account)
        result = compute_post_loss_sizing(qs, 'net_pnl')

        self.assertEqual(result['sample_size'], 3)
        vs = result['vs_losing_trade']
        self.assertEqual(vs['larger']['count'], 1)
        self.assertEqual(vs['smaller']['count'], 1)
        self.assertEqual(vs['equal']['count'], 1)
        total_pct = vs['larger']['pct'] + vs['equal']['pct'] + vs['smaller']['pct']
        self.assertGreaterEqual(total_pct, 99.0)
        self.assertLessEqual(total_pct, 100.0)

    def test_win_rate_and_pnl_on_following_trade(self) -> None:
        self._create_trade('pl-w1', 0, '1', '-50', '-50')
        self._create_trade('pl-w2', 10, '2', '100', '100')

        qs = TopStepTrade.objects.filter(user=self.user, trading_account=self.account)
        result = compute_post_loss_sizing(qs, 'net_pnl')

        larger = result['vs_losing_trade']['larger']
        self.assertEqual(larger['count'], 1)
        self.assertEqual(larger['win_rate'], 100.0)
        self.assertEqual(larger['total_pnl'], 100.0)

    def test_empty_when_no_loss_followed_by_trade(self) -> None:
        self._create_trade('pl-win', 0, '1', '50', '50')
        qs = TopStepTrade.objects.filter(user=self.user, trading_account=self.account)
        result = compute_post_loss_sizing(qs, 'net_pnl')
        self.assertEqual(result['sample_size'], 0)

    def test_median_baseline_uses_prior_trades(self) -> None:
        for i in range(3):
            self._create_trade(f'pl-m{i}', i * 10, '2', '10', '10')
        self._create_trade('pl-loss', 40, '2', '-50', '-50')
        self._create_trade('pl-next', 50, '4', '-10', '-10')

        qs = TopStepTrade.objects.filter(user=self.user, trading_account=self.account)
        result = compute_post_loss_sizing(qs, 'net_pnl')

        self.assertGreater(result['median_sample_size'], 0)
        self.assertEqual(result['vs_median']['larger']['count'], 1)


class PostLossSizingAnalyticsApiTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='post-loss-api@example.com',
            username='post_loss_api',
            password='testpass123',
            first_name='A',
            last_name='P',
            role='admin',
        )
        UserPreferences.objects.get_or_create(user=self.user)
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='API account',
            account_type='other',
            currency='USD',
            initial_capital=Decimal('10000.00'),
            status='active',
        )
        now = timezone.now()
        TopStepTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            topstep_id='api-pl-1',
            contract_name='NQ',
            entered_at=now,
            exited_at=now + timedelta(minutes=5),
            entry_price=Decimal('100.000000000'),
            exit_price=Decimal('99.000000000'),
            size=Decimal('1.0000'),
            trade_type='Long',
            trade_day=now.date(),
            pnl=Decimal('-50.000000000'),
            net_pnl=Decimal('-50.000000000'),
        )
        TopStepTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            topstep_id='api-pl-2',
            contract_name='NQ',
            entered_at=now + timedelta(minutes=10),
            exited_at=now + timedelta(minutes=15),
            entry_price=Decimal('100.000000000'),
            exit_price=Decimal('101.000000000'),
            size=Decimal('2.0000'),
            trade_type='Long',
            trade_day=now.date(),
            pnl=Decimal('20.000000000'),
            net_pnl=Decimal('20.000000000'),
        )

    def test_analytics_includes_post_loss_sizing(self) -> None:
        self.client.force_authenticate(user=self.user)
        response = self.client.get(
            '/api/trades/topstep/analytics/',
            {'trading_account': self.account.id},
        )
        self.assertEqual(response.status_code, 200, response.data)
        pls = response.data.get('post_loss_sizing')
        self.assertIsNotNone(pls)
        self.assertEqual(pls['sample_size'], 1)
        self.assertEqual(pls['vs_losing_trade']['larger']['count'], 1)

    def test_analytics_empty_post_loss_sizing_without_trades(self) -> None:
        TopStepTrade.objects.all().delete()
        self.client.force_authenticate(user=self.user)
        response = self.client.get(
            '/api/trades/topstep/analytics/',
            {'trading_account': self.account.id},
        )
        self.assertEqual(response.status_code, 200)
        pls = response.data['post_loss_sizing']
        self.assertEqual(pls['sample_size'], 0)
