"""Tests du statut d'edge stratégie (baseline vs trailing)."""
from datetime import timedelta
from decimal import Decimal

from django.test import SimpleTestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User, UserPreferences
from trades.models import ImportedTrade, PositionStrategy, TradeStrategy, TradingAccount
from trades.services.strategy_edge_status import (
    MIN_SAMPLE,
    RELIABLE_SAMPLE,
    STRONG_SAMPLE,
    TRAILING_WINDOW,
    _uncertainty_band,
    build_strategy_edge_overview_payload,
    build_strategy_edge_status_payload,
    compute_strategy_edge_status,
    hysteresis_band,
)


class HysteresisBandTests(SimpleTestCase):
    def test_band_is_at_least_epsilon(self):
        self.assertEqual(hysteresis_band(0.0), 1.0)
        self.assertEqual(hysteresis_band(10.0), 1.0)

    def test_band_scales_with_large_baseline(self):
        self.assertEqual(hysteresis_band(500.0), 5.0)


class ComputeStrategyEdgeStatusTests(SimpleTestCase):
    def test_insufficient_below_min_sample(self):
        pnls = [10.0] * (MIN_SAMPLE - 1)
        result = compute_strategy_edge_status(pnls)
        self.assertEqual(result['status'], 'insufficient')
        self.assertEqual(result['sample_size'], MIN_SAMPLE - 1)
        self.assertIsNone(result['trailing_expectancy'])

    def test_present_when_baseline_and_trailing_positive(self):
        # 40 trades positifs → present
        pnls = [50.0] * 40
        result = compute_strategy_edge_status(pnls)
        self.assertEqual(result['status'], 'present')
        self.assertEqual(result['baseline_expectancy'], 50.0)
        self.assertEqual(result['trailing_expectancy'], 50.0)
        self.assertEqual(result['basis'], 'respected')

    def test_fading_when_baseline_positive_trailing_clearly_negative(self):
        # 50 gagnants puis 30 perdants forts
        early = [100.0] * 50
        late = [-80.0] * 30
        result = compute_strategy_edge_status(early + late, window=30)
        self.assertEqual(result['status'], 'fading')
        self.assertGreater(result['baseline_expectancy'], 0)
        self.assertLess(result['trailing_expectancy'], 0)

    def test_lost_when_baseline_and_trailing_negative(self):
        pnls = [-40.0] * 40
        result = compute_strategy_edge_status(pnls)
        self.assertEqual(result['status'], 'lost')

    def test_present_when_baseline_negative_but_trailing_clearly_positive(self):
        early = [-100.0] * 40
        late = [80.0] * 30
        result = compute_strategy_edge_status(early + late, window=30)
        self.assertEqual(result['status'], 'present')
        self.assertLessEqual(result['baseline_expectancy'], 0)
        self.assertGreater(result['trailing_expectancy'], 0)

    def test_neutral_trailing_keeps_present_when_baseline_positive(self):
        # Baseline clairement positif ; trailing quasi nul (dans la bande)
        early = [100.0] * 40
        late = [0.5] * 30  # band = max(1% * baseline, 1) ≈ plusieurs unités
        result = compute_strategy_edge_status(early + late, window=30)
        self.assertEqual(result['status'], 'present')
        band = result['hysteresis_band']
        self.assertIsNotNone(band)
        self.assertLess(abs(result['trailing_expectancy']), band)

    def test_trailing_window_exposed(self):
        pnls = [10.0] * 40
        result = compute_strategy_edge_status(pnls, window=TRAILING_WINDOW)
        self.assertEqual(result['trailing_window'], TRAILING_WINDOW)
        self.assertIn('20', result['windows'])
        self.assertIn('30', result['windows'])
        self.assertEqual(result['windows']['30']['expectancy'], 10.0)

    def test_constant_series_uncertainty_degenerate_not_uncertain(self):
        pnls = [50.0] * 40
        result = compute_strategy_edge_status(pnls)
        band = result['trailing_uncertainty']
        self.assertIsNotNone(band)
        self.assertEqual(band['low'], band['high'])
        self.assertFalse(result['trailing_sign_uncertain'])
        self.assertEqual(result['confidence'], 'low')  # 40 < 50

    def test_noisy_centered_trailing_is_sign_uncertain(self):
        # Baseline positif ; trailing bruit autour de 0 → fourchette traverse 0
        early = [100.0] * 40
        late = [20.0, -20.0] * 15  # mean ≈ 0, variance élevée
        result = compute_strategy_edge_status(early + late, window=30)
        self.assertIsNotNone(result['trailing_uncertainty'])
        self.assertTrue(result['trailing_sign_uncertain'])
        self.assertEqual(result['status'], 'present')  # neutre → present si baseline > 0

    def test_confidence_low_medium_high_by_sample_size(self):
        low = compute_strategy_edge_status([10.0] * 25)
        self.assertEqual(low['confidence'], 'low')
        self.assertEqual(low['sample_size'], 25)

        medium = compute_strategy_edge_status([10.0] * 60)
        self.assertEqual(medium['confidence'], 'medium')
        self.assertEqual(medium['sample_size'], 60)

        high = compute_strategy_edge_status([10.0] * 120)
        self.assertEqual(high['confidence'], 'high')
        self.assertEqual(high['sample_size'], 120)

    def test_insufficient_has_null_confidence(self):
        result = compute_strategy_edge_status([10.0] * (MIN_SAMPLE - 1))
        self.assertIsNone(result['confidence'])
        self.assertIsNone(result['trailing_uncertainty'])
        self.assertFalse(result['trailing_sign_uncertain'])

    def test_uncertainty_band_helper_constant(self):
        band = _uncertainty_band([5.0, 5.0, 5.0])
        self.assertEqual(band, {'low': 5.0, 'high': 5.0})

    def test_uncertainty_band_helper_too_short(self):
        self.assertIsNone(_uncertainty_band([1.0]))
        self.assertIsNone(_uncertainty_band([]))

    def test_thresholds_constants(self):
        self.assertEqual(RELIABLE_SAMPLE, 50)
        self.assertEqual(STRONG_SAMPLE, 100)


class BuildStrategyEdgeStatusPayloadTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='edge-status@example.com',
            username='edge_status',
            password='testpass123',
            first_name='E',
            last_name='S',
            role='admin',
        )
        UserPreferences.objects.get_or_create(user=self.user)
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='Edge account',
            account_type='other',
            currency='USD',
            initial_capital=Decimal('10000.00'),
            status='active',
        )
        self.strategy = PositionStrategy.objects.create(
            user=self.user,
            title='Edge strategy',
            version=1,
        )
        self.base_time = timezone.now()

    def _trade(self, idx: int, pnl: str, respected: bool = True) -> ImportedTrade:
        trade = ImportedTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            position_strategy=self.strategy,
            external_trade_id=f'edge-{idx}',
            contract_name='NQ',
            trade_type='Long',
            size=Decimal('1'),
            entry_price=Decimal('100'),
            exit_price=Decimal('101'),
            pnl=Decimal(pnl),
            net_pnl=Decimal(pnl),
            entered_at=self.base_time + timedelta(minutes=idx),
            exited_at=self.base_time + timedelta(minutes=idx + 1),
        )
        TradeStrategy.objects.create(
            user=self.user,
            trade=trade,
            strategy_respected=respected,
            tp1_reached=False,
            tp2_plus_reached=False,
        )
        return trade

    def test_no_strategy_returns_insufficient(self):
        payload = build_strategy_edge_status_payload(
            self.user,
            trading_account_id=self.account.id,
            position_strategy_id=None,
        )
        self.assertEqual(payload['status'], 'insufficient')
        self.assertEqual(payload.get('reason'), 'no_strategy')
        self.assertTrue(payload['period_independent'])

    def test_respected_basis_when_enough_samples(self):
        for i in range(25):
            self._trade(i, '50.00', respected=True)
        payload = build_strategy_edge_status_payload(
            self.user,
            trading_account_id=self.account.id,
            position_strategy_id=self.strategy.id,
        )
        self.assertEqual(payload['basis'], 'respected')
        self.assertEqual(payload['status'], 'present')
        self.assertEqual(payload['sample_size'], 25)
        self.assertTrue(payload['period_independent'])
        self.assertTrue(payload['family_scope'])

    def test_fallback_to_all_when_respected_insufficient(self):
        for i in range(25):
            self._trade(i, '40.00', respected=False)
        # seulement 5 respectés
        for i in range(25, 30):
            self._trade(i, '40.00', respected=True)
        payload = build_strategy_edge_status_payload(
            self.user,
            trading_account_id=self.account.id,
            position_strategy_id=self.strategy.id,
        )
        self.assertEqual(payload['basis'], 'all')
        self.assertTrue(payload.get('fallback_warning'))
        self.assertEqual(payload['status'], 'present')
        self.assertGreaterEqual(payload['sample_size'], MIN_SAMPLE)


class BuildStrategyEdgeOverviewPayloadTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='edge-overview@example.com',
            username='edge_overview',
            password='testpass123',
            first_name='O',
            last_name='V',
            role='admin',
        )
        UserPreferences.objects.get_or_create(user=self.user)
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='Overview account',
            account_type='other',
            currency='USD',
            initial_capital=Decimal('10000.00'),
            status='active',
        )
        self.strategy_a = PositionStrategy.objects.create(
            user=self.user,
            title='Alpha present',
            version=1,
        )
        self.strategy_b = PositionStrategy.objects.create(
            user=self.user,
            title='Beta fading',
            version=1,
        )
        self.base_time = timezone.now()
        self._idx = 0

    def _trade(self, strategy: PositionStrategy, pnl: str, respected: bool = True) -> ImportedTrade:
        self._idx += 1
        trade = ImportedTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            position_strategy=strategy,
            external_trade_id=f'ov-{self._idx}',
            contract_name='NQ',
            trade_type='Long',
            size=Decimal('1'),
            entry_price=Decimal('100'),
            exit_price=Decimal('101'),
            pnl=Decimal(pnl),
            net_pnl=Decimal(pnl),
            entered_at=self.base_time + timedelta(minutes=self._idx),
            exited_at=self.base_time + timedelta(minutes=self._idx + 1),
        )
        TradeStrategy.objects.create(
            user=self.user,
            trade=trade,
            strategy_respected=respected,
            tp1_reached=False,
            tp2_plus_reached=False,
        )
        return trade

    def test_empty_without_trades(self):
        payload = build_strategy_edge_overview_payload(
            self.user,
            trading_account_id=self.account.id,
        )
        self.assertEqual(payload['items'], [])
        self.assertTrue(payload['period_independent'])

    def test_two_families_sorted_fading_before_present(self):
        # Alpha : 25 wins → present
        for _ in range(25):
            self._trade(self.strategy_a, '50.00')
        # Beta : 50 wins puis 30 pertes → fading
        for _ in range(50):
            self._trade(self.strategy_b, '100.00')
        for _ in range(30):
            self._trade(self.strategy_b, '-80.00')

        payload = build_strategy_edge_overview_payload(
            self.user,
            trading_account_id=self.account.id,
        )
        items = payload['items']
        self.assertEqual(len(items), 2)
        self.assertEqual(items[0]['status'], 'fading')
        self.assertEqual(items[0]['root_id'], self.strategy_b.id)
        self.assertEqual(items[1]['status'], 'present')
        self.assertEqual(items[1]['root_id'], self.strategy_a.id)
        self.assertIn('display_strategy_id', items[0])
        self.assertIn('title', items[0])
        self.assertIn('version_count', items[0])
        # Fiabilité : Beta n=80 → medium ; Alpha n=25 → low
        self.assertEqual(items[0]['confidence'], 'medium')
        self.assertIn('trailing_uncertainty', items[0])
        self.assertIn('trailing_sign_uncertain', items[0])
        self.assertEqual(items[1]['confidence'], 'low')

    def test_display_strategy_id_is_latest_version(self):
        child = PositionStrategy.objects.create(
            user=self.user,
            title='Alpha v2',
            version=2,
            parent_strategy=self.strategy_a,
        )
        for _ in range(25):
            self._trade(child, '40.00')

        payload = build_strategy_edge_overview_payload(
            self.user,
            trading_account_id=self.account.id,
        )
        item = next(i for i in payload['items'] if i['root_id'] == self.strategy_a.id)
        self.assertEqual(item['display_strategy_id'], child.id)
        self.assertEqual(item['version_count'], 2)
