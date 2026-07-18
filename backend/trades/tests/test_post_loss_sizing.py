"""Tests pour l'indicateur taille après perte (post-loss sizing)."""
from datetime import timedelta
from decimal import Decimal
from typing import Optional

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User, UserPreferences
from trades.models import ImportedTrade, TradingAccount
from trades.contract_utils.contract_family import (
    get_base_symbol,
    get_contract_family_key,
    normalize_contract_symbol,
)
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

    def test_classifies_larger_equal_smaller_vs_losing_trade(self) -> None:
        self._create_trade('pl-1', 0, '2', '-50', '-50')
        self._create_trade('pl-2', 10, '3', '20', '20')
        self._create_trade('pl-3', 20, '3', '-30', '-30')
        self._create_trade('pl-4', 30, '3', '10', '10')
        self._create_trade('pl-5', 40, '3', '-20', '-20')
        self._create_trade('pl-6', 50, '1', '5', '5')

        qs = ImportedTrade.objects.filter(user=self.user, trading_account=self.account)
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

        qs = ImportedTrade.objects.filter(user=self.user, trading_account=self.account)
        result = compute_post_loss_sizing(qs, 'net_pnl')

        larger = result['vs_losing_trade']['larger']
        self.assertEqual(larger['count'], 1)
        self.assertEqual(larger['win_rate'], 100.0)
        self.assertEqual(larger['total_pnl'], 100.0)

    def test_empty_when_no_loss_followed_by_trade(self) -> None:
        self._create_trade('pl-win', 0, '1', '50', '50')
        qs = ImportedTrade.objects.filter(user=self.user, trading_account=self.account)
        result = compute_post_loss_sizing(qs, 'net_pnl')
        self.assertEqual(result['sample_size'], 0)

    def test_median_baseline_uses_prior_trades(self) -> None:
        for i in range(3):
            self._create_trade(f'pl-m{i}', i * 10, '2', '10', '10')
        self._create_trade('pl-loss', 40, '2', '-50', '-50')
        self._create_trade('pl-next', 50, '4', '-10', '-10')

        qs = ImportedTrade.objects.filter(user=self.user, trading_account=self.account)
        result = compute_post_loss_sizing(qs, 'net_pnl')

        self.assertGreater(result['median_sample_size'], 0)
        self.assertEqual(result['vs_median']['larger']['count'], 1)

    def test_normalize_contract_symbol_formats(self) -> None:
        self.assertEqual(get_base_symbol('NQM6'), 'NQ')
        self.assertEqual(get_contract_family_key('NQM6'), 'NQ')
        self.assertEqual(normalize_contract_symbol('CON.F.US.MNQ.M26'), 'MNQ')
        self.assertEqual(get_base_symbol('CON.F.US.MNQ.M26'), 'MNQ')
        self.assertEqual(get_contract_family_key('CON.F.US.MNQ.M26'), 'NQ')
        self.assertEqual(get_contract_family_key('CON.NQ'), 'NQ')
        self.assertEqual(normalize_contract_symbol('CON.F.US.ENQ.M26'), 'ENQ')
        self.assertEqual(get_base_symbol('CON.F.US.ENQ.M26'), 'NQ')
        self.assertEqual(get_contract_family_key('CON.F.US.ENQ.M26'), 'NQ')
        self.assertEqual(get_base_symbol('CON.F.US.EP.M26'), 'ES')
        self.assertEqual(get_contract_family_key('CON.F.US.EP.M26'), 'ES')

    def test_enq_loss_mnq_next_same_nasdaq_family(self) -> None:
        self._create_trade(
            'pl-enq',
            0,
            '1',
            '-50',
            '-50',
            contract_name='CON.F.US.ENQ.M26',
        )
        self._create_trade(
            'pl-mnq-enq',
            10,
            '5',
            '10',
            '10',
            contract_name='CON.F.US.MNQ.M26',
        )

        qs = ImportedTrade.objects.filter(user=self.user, trading_account=self.account)
        result = compute_post_loss_sizing(qs, 'net_pnl')

        self.assertEqual(result['sample_size'], 1)
        self.assertEqual(result['vs_losing_trade']['smaller']['count'], 1)

    def test_nq_loss_mnq_next_classified_smaller_not_larger(self) -> None:
        self._create_trade('pl-nq', 0, '1', '-50', '-50', contract_name='NQM6')
        self._create_trade('pl-mnq', 10, '5', '10', '10', contract_name='MNQM6')

        qs = ImportedTrade.objects.filter(user=self.user, trading_account=self.account)
        result = compute_post_loss_sizing(qs, 'net_pnl')

        self.assertEqual(result['sample_size'], 1)
        self.assertEqual(result['comparison_basis'], 'risk_units')
        self.assertEqual(result['vs_losing_trade']['smaller']['count'], 1)
        self.assertEqual(result['vs_losing_trade']['larger']['count'], 0)

    def test_con_f_us_nq_mnq_pair_classified_by_risk_units(self) -> None:
        self._create_trade(
            'pl-con-nq',
            0,
            '1',
            '-50',
            '-50',
            contract_name='CON.F.US.NQ.M26',
        )
        self._create_trade(
            'pl-con-mnq',
            10,
            '5',
            '10',
            '10',
            contract_name='CON.F.US.MNQ.M26',
        )

        qs = ImportedTrade.objects.filter(user=self.user, trading_account=self.account)
        result = compute_post_loss_sizing(qs, 'net_pnl')

        self.assertEqual(result['sample_size'], 1)
        self.assertEqual(result['vs_losing_trade']['smaller']['count'], 1)

    def test_nq_loss_cl_next_excluded_cross_instrument(self) -> None:
        self._create_trade('pl-nq2', 0, '1', '-50', '-50', contract_name='NQM6')
        self._create_trade('pl-cl', 10, '1', '10', '10', contract_name='CLZ5')

        qs = ImportedTrade.objects.filter(user=self.user, trading_account=self.account)
        result = compute_post_loss_sizing(qs, 'net_pnl')

        self.assertEqual(result['sample_size'], 0)
        self.assertEqual(result['skipped_cross_instrument'], 1)

    def test_median_uses_same_family_only(self) -> None:
        self._create_trade('pl-h-nq', 0, '2', '10', '10', contract_name='NQM6')
        self._create_trade('pl-h-mnq', 10, '10', '10', '10', contract_name='MNQM6')
        self._create_trade('pl-h-loss', 20, '1', '-50', '-50', contract_name='NQM6')
        self._create_trade('pl-h-next', 30, '3', '-10', '-10', contract_name='NQM6')

        qs = ImportedTrade.objects.filter(user=self.user, trading_account=self.account)
        result = compute_post_loss_sizing(qs, 'net_pnl')

        self.assertEqual(result['sample_size'], 1)
        self.assertEqual(result['median_sample_size'], 1)
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
        ImportedTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            external_trade_id='api-pl-1',
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
        ImportedTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            external_trade_id='api-pl-2',
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
            '/api/trades/imported/analytics/',
            {'trading_account': self.account.id},
        )
        self.assertEqual(response.status_code, 200, response.data)
        pls = response.data.get('post_loss_sizing')
        self.assertIsNotNone(pls)
        self.assertEqual(pls['sample_size'], 1)
        self.assertEqual(pls['comparison_basis'], 'risk_units')
        self.assertEqual(pls['vs_losing_trade']['larger']['count'], 1)
        self.assertIn('skipped_cross_instrument', pls)

    def test_analytics_empty_post_loss_sizing_without_trades(self) -> None:
        ImportedTrade.objects.all().delete()
        self.client.force_authenticate(user=self.user)
        response = self.client.get(
            '/api/trades/imported/analytics/',
            {'trading_account': self.account.id},
        )
        self.assertEqual(response.status_code, 200)
        pls = response.data['post_loss_sizing']
        self.assertEqual(pls['sample_size'], 0)
        self.assertEqual(pls['skipped_cross_instrument'], 0)
