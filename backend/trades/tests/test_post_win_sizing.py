"""Tests pour l'indicateur taille après gain (post-win sizing)."""
from datetime import timedelta
from decimal import Decimal
from typing import Optional

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User, UserPreferences
from trades.models import ImportedTrade, TradingAccount
from trades.services.post_win_sizing import compute_post_win_sizing


class PostWinSizingServiceTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='post-win@example.com',
            username='post_win',
            password='testpass123',
            first_name='P',
            last_name='W',
            role='admin',
        )
        UserPreferences.objects.get_or_create(user=self.user)
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='Post win account',
            account_type='other',
            currency='USD',
            initial_capital=Decimal('10000.00'),
            status='active',
        )
        self.base_time = timezone.now()

    def _create_trade(
        self,
        external_trade_id: str,
        offset_minutes: int,
        size: str,
        pnl: str,
        net_pnl: Optional[str] = None,
        contract_name: str = 'NQ',
        point_value: Optional[str] = None,
    ) -> ImportedTrade:
        entered = self.base_time + timedelta(minutes=offset_minutes)
        net = net_pnl if net_pnl is not None else pnl
        kwargs: dict = {}
        if point_value is not None:
            kwargs['point_value'] = Decimal(point_value)
        return ImportedTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            external_trade_id=external_trade_id,
            contract_name=contract_name,
            entered_at=entered,
            exited_at=entered + timedelta(minutes=5),
            entry_price=Decimal('100.000000000'),
            exit_price=Decimal('101.000000000'),
            size=Decimal(size),
            trade_type='Long',
            trade_day=entered.date(),
            pnl=Decimal(pnl),
            net_pnl=Decimal(net),
            **kwargs,
        )

    def test_classifies_larger_equal_smaller_vs_winning_trade(self) -> None:
        self._create_trade('pw-1', 0, '2', '50', '50')
        self._create_trade('pw-2', 10, '3', '-20', '-20')
        self._create_trade('pw-3', 20, '3', '30', '30')
        self._create_trade('pw-4', 30, '3', '-10', '-10')
        self._create_trade('pw-5', 40, '3', '20', '20')
        self._create_trade('pw-6', 50, '1', '-5', '-5')

        qs = ImportedTrade.objects.filter(user=self.user, trading_account=self.account)
        result = compute_post_win_sizing(qs, 'net_pnl')

        self.assertEqual(result['sample_size'], 3)
        vs = result['vs_winning_trade']
        self.assertEqual(vs['larger']['count'], 1)
        self.assertEqual(vs['smaller']['count'], 1)
        self.assertEqual(vs['equal']['count'], 1)
        total_pct = vs['larger']['pct'] + vs['equal']['pct'] + vs['smaller']['pct']
        self.assertGreaterEqual(total_pct, 99.0)
        self.assertLessEqual(total_pct, 100.0)
        vs = result['vs_winning_trade']
        self.assertEqual(vs['larger']['avg_pnl'], -20.0)
        self.assertEqual(vs['equal']['avg_pnl'], -10.0)
        self.assertEqual(vs['smaller']['avg_pnl'], -5.0)

    def test_avg_pnl_is_mean_of_following_trade_only(self) -> None:
        """Le PnL moyen par catégorie = moyenne du trade suivant, pas du trade gagnant."""
        self._create_trade('pw-a1', 0, '1', '50', '50')
        self._create_trade('pw-a2', 10, '2', '30', '30')
        self._create_trade('pw-a3', 20, '2', '40', '40')
        self._create_trade('pw-a4', 30, '3', '10', '10')

        qs = ImportedTrade.objects.filter(user=self.user, trading_account=self.account)
        result = compute_post_win_sizing(qs, 'net_pnl')

        larger = result['vs_winning_trade']['larger']
        self.assertEqual(larger['count'], 2)
        self.assertEqual(larger['total_pnl'], 40.0)
        self.assertEqual(larger['avg_pnl'], 20.0)

    def test_win_rate_and_pnl_on_following_trade(self) -> None:
        self._create_trade('pw-w1', 0, '1', '50', '50')
        self._create_trade('pw-w2', 10, '2', '-100', '-100')

        qs = ImportedTrade.objects.filter(user=self.user, trading_account=self.account)
        result = compute_post_win_sizing(qs, 'net_pnl')

        larger = result['vs_winning_trade']['larger']
        self.assertEqual(larger['count'], 1)
        self.assertEqual(larger['win_rate'], 0.0)
        self.assertEqual(larger['total_pnl'], -100.0)
        self.assertEqual(larger['avg_pnl'], -100.0)

    def test_empty_when_no_win_followed_by_trade(self) -> None:
        self._create_trade('pw-loss', 0, '1', '-50', '-50')
        qs = ImportedTrade.objects.filter(user=self.user, trading_account=self.account)
        result = compute_post_win_sizing(qs, 'net_pnl')
        self.assertEqual(result['sample_size'], 0)

    def test_median_baseline_uses_prior_trades(self) -> None:
        for i in range(3):
            self._create_trade(f'pw-m{i}', i * 10, '2', '10', '10')
        self._create_trade('pw-win', 40, '2', '50', '50')
        self._create_trade('pw-next', 50, '4', '-10', '-10')

        qs = ImportedTrade.objects.filter(user=self.user, trading_account=self.account)
        result = compute_post_win_sizing(qs, 'net_pnl')

        self.assertGreater(result['median_sample_size'], 0)
        self.assertEqual(result['vs_median']['larger']['count'], 1)

    def test_nq_win_mnq_next_classified_smaller_not_larger(self) -> None:
        self._create_trade('pw-nq', 0, '1', '50', '50', contract_name='NQM6')
        self._create_trade('pw-mnq', 10, '5', '-10', '-10', contract_name='MNQM6')

        qs = ImportedTrade.objects.filter(user=self.user, trading_account=self.account)
        result = compute_post_win_sizing(qs, 'net_pnl')

        self.assertEqual(result['sample_size'], 1)
        self.assertEqual(result['comparison_basis'], 'risk_units')
        self.assertEqual(result['vs_winning_trade']['smaller']['count'], 1)
        self.assertEqual(result['vs_winning_trade']['larger']['count'], 0)

    def test_nq_win_cl_next_excluded_cross_instrument(self) -> None:
        self._create_trade('pw-nq2', 0, '1', '50', '50', contract_name='NQM6')
        self._create_trade('pw-cl', 10, '1', '-10', '-10', contract_name='CLZ5')

        qs = ImportedTrade.objects.filter(user=self.user, trading_account=self.account)
        result = compute_post_win_sizing(qs, 'net_pnl')

        self.assertEqual(result['sample_size'], 0)
        self.assertEqual(result['skipped_cross_instrument'], 1)


class PostWinSizingAnalyticsApiTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='post-win-api@example.com',
            username='post_win_api',
            password='testpass123',
            first_name='A',
            last_name='W',
            role='admin',
        )
        UserPreferences.objects.get_or_create(user=self.user)
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='API win account',
            account_type='other',
            currency='USD',
            initial_capital=Decimal('10000.00'),
            status='active',
        )
        now = timezone.now()
        ImportedTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            external_trade_id='api-pw-1',
            contract_name='NQ',
            entered_at=now,
            exited_at=now + timedelta(minutes=5),
            entry_price=Decimal('100.000000000'),
            exit_price=Decimal('101.000000000'),
            size=Decimal('1.0000'),
            trade_type='Long',
            trade_day=now.date(),
            pnl=Decimal('50.000000000'),
            net_pnl=Decimal('50.000000000'),
        )
        ImportedTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            external_trade_id='api-pw-2',
            contract_name='NQ',
            entered_at=now + timedelta(minutes=10),
            exited_at=now + timedelta(minutes=15),
            entry_price=Decimal('100.000000000'),
            exit_price=Decimal('99.000000000'),
            size=Decimal('2.0000'),
            trade_type='Long',
            trade_day=now.date(),
            pnl=Decimal('-20.000000000'),
            net_pnl=Decimal('-20.000000000'),
        )

    def test_analytics_includes_post_win_sizing(self) -> None:
        self.client.force_authenticate(user=self.user)
        response = self.client.get(
            '/api/trades/imported/analytics/',
            {'trading_account': self.account.id},
        )
        self.assertEqual(response.status_code, 200, response.data)
        pws = response.data.get('post_win_sizing')
        self.assertIsNotNone(pws)
        self.assertEqual(pws['sample_size'], 1)
        self.assertEqual(pws['comparison_basis'], 'risk_units')
        self.assertEqual(pws['vs_winning_trade']['larger']['count'], 1)
        self.assertIn('skipped_cross_instrument', pws)

    def test_analytics_empty_post_win_sizing_without_trades(self) -> None:
        ImportedTrade.objects.all().delete()
        self.client.force_authenticate(user=self.user)
        response = self.client.get(
            '/api/trades/imported/analytics/',
            {'trading_account': self.account.id},
        )
        self.assertEqual(response.status_code, 200)
        pws = response.data['post_win_sizing']
        self.assertEqual(pws['sample_size'], 0)
        self.assertEqual(pws['skipped_cross_instrument'], 0)
