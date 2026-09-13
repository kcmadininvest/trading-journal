from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from accounts.models import AppSettings, User
from backtest_journal.services.stats import compute_metrics
from trades.models import PositionStrategy


class BacktestJournalApiTests(APITestCase):
    def setUp(self) -> None:
        app = AppSettings.get_solo()
        app.premium_restrictions_enabled = False
        app.save()
        self.user = User.objects.create_user(
            email='bt@example.com',
            username='bt_user',
            password='testpass123',
        )
        self.other = User.objects.create_user(
            email='other-bt@example.com',
            username='other_bt',
            password='testpass123',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _create_position_strategy(self, title='OR Retrace') -> PositionStrategy:
        return PositionStrategy.objects.create(
            user=self.user,
            title=title,
            status='active',
            is_current=True,
            strategy_content={'sections': [{'title': 'Setup', 'rules': ['OR']}]},
        )

    def _create_strategy(self, name='OR Retrace') -> dict:
        position = self._create_position_strategy(title=name)
        res = self.client.post(
            '/api/backtest-journal/strategies/',
            {
                'position_strategy': position.id,
                'default_instrument': 'NQ',
                'default_timeframe': '5m',
            },
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        return res.data

    def _create_campaign(self, version_id: int, name='Mars NQ') -> dict:
        res = self.client.post(
            '/api/backtest-journal/campaigns/',
            {
                'strategy_version': version_id,
                'name': name,
                'instrument': 'NQ',
                'timeframe': '5m',
                'period_start': '2026-03-01',
                'period_end': '2026-03-31',
                'timezone': 'America/New_York',
            },
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        return res.data

    def test_user_isolation_returns_404(self):
        data = self._create_strategy()
        other_client = APIClient()
        other_client.force_authenticate(user=self.other)
        res = other_client.get(f'/api/backtest-journal/strategies/{data["id"]}/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_create_strategy_seeds_version_one(self):
        data = self._create_strategy()
        self.assertEqual(len(data['versions']), 1)
        self.assertEqual(data['versions'][0]['version'], 1)
        self.assertIsNone(data['versions'][0]['locked_at'])
        self.assertEqual(data['name'], 'OR Retrace')

    def test_create_strategy_requires_position_strategy(self):
        missing = self.client.post(
            '/api/backtest-journal/strategies/',
            {'name': 'Sans lien', 'default_instrument': 'NQ'},
            format='json',
        )
        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_strategy_is_idempotent_for_same_position_strategy(self):
        first = self._create_strategy()
        again = self.client.post(
            '/api/backtest-journal/strategies/',
            {'position_strategy': first['position_strategy']},
            format='json',
        )
        self.assertEqual(again.status_code, status.HTTP_200_OK, again.data)
        self.assertEqual(again.data['id'], first['id'])

    def test_lock_and_duplicate_version(self):
        strategy = self._create_strategy()
        version_id = strategy['versions'][0]['id']
        patch = self.client.patch(
            f'/api/backtest-journal/versions/{version_id}/',
            {'entry_rules': 'Retest OR'},
            format='json',
        )
        self.assertEqual(patch.status_code, status.HTTP_200_OK, patch.data)
        campaign = self._create_campaign(version_id)
        obs = self.client.post(
            f'/api/backtest-journal/campaigns/{campaign["id"]}/observations/',
            {
                'market_datetime': '2026-03-10T14:30:00Z',
                'direction': 'LONG',
                'entry_price': '21000',
                'initial_stop_price': '20980',
                'exit_price': '21040',
                'result_status': 'WIN',
                'trade_taken': True,
            },
            format='json',
        )
        self.assertEqual(obs.status_code, status.HTTP_201_CREATED, obs.data)
        locked = self.client.get(f'/api/backtest-journal/versions/{version_id}/')
        self.assertIsNotNone(locked.data['locked_at'])
        denied = self.client.patch(
            f'/api/backtest-journal/versions/{version_id}/',
            {'entry_rules': 'Autre règle'},
            format='json',
        )
        self.assertEqual(denied.status_code, status.HTTP_400_BAD_REQUEST)
        dup = self.client.post(
            f'/api/backtest-journal/versions/{version_id}/duplicate/'
        )
        self.assertEqual(dup.status_code, status.HTTP_201_CREATED, dup.data)
        self.assertEqual(dup.data['version'], 2)
        self.assertIsNone(dup.data['locked_at'])
        self.assertEqual(dup.data['entry_rules'], 'Retest OR')

    def test_long_short_r_and_manual_override(self):
        strategy = self._create_strategy()
        version_id = strategy['versions'][0]['id']
        campaign = self._create_campaign(version_id)
        long_obs = self.client.post(
            f'/api/backtest-journal/campaigns/{campaign["id"]}/observations/',
            {
                'market_datetime': '2026-03-10T14:30:00Z',
                'direction': 'LONG',
                'entry_price': '100',
                'initial_stop_price': '90',
                'exit_price': '120',
                'result_status': 'WIN',
                'context': 'OR',
                'structure': 'Cassure',
            },
            format='json',
        )
        self.assertEqual(long_obs.status_code, status.HTTP_201_CREATED, long_obs.data)
        self.assertEqual(Decimal(long_obs.data['result_r']), Decimal('2.0000'))
        self.assertEqual(long_obs.data['context'], 'OR')
        self.assertEqual(long_obs.data['structure'], 'Cassure')
        short_obs = self.client.post(
            f'/api/backtest-journal/campaigns/{campaign["id"]}/observations/',
            {
                'market_datetime': '2026-03-10T15:30:00Z',
                'direction': 'SHORT',
                'entry_price': '100',
                'initial_stop_price': '110',
                'exit_price': '80',
                'result_status': 'WIN',
            },
            format='json',
        )
        self.assertEqual(short_obs.status_code, status.HTTP_201_CREATED, short_obs.data)
        self.assertEqual(Decimal(short_obs.data['result_r']), Decimal('2.0000'))
        manual = self.client.post(
            f'/api/backtest-journal/campaigns/{campaign["id"]}/observations/',
            {
                'market_datetime': '2026-03-10T16:30:00Z',
                'direction': 'LONG',
                'entry_price': '100',
                'initial_stop_price': '90',
                'exit_price': '120',
                'result_r': '1.5',
                'result_r_source': 'manual',
                'result_status': 'PARTIAL',
            },
            format='json',
        )
        self.assertEqual(manual.status_code, status.HTTP_201_CREATED, manual.data)
        self.assertEqual(Decimal(manual.data['result_r']), Decimal('1.5000'))
        self.assertIn('r_divergence', manual.data['warnings'])

    def test_refused_and_open_excluded_from_primary_stats(self):
        strategy = self._create_strategy()
        version_id = strategy['versions'][0]['id']
        campaign = self._create_campaign(version_id)
        cid = campaign['id']
        self.client.post(
            f'/api/backtest-journal/campaigns/{cid}/observations/',
            {
                'market_datetime': '2026-03-10T14:30:00Z',
                'direction': 'LONG',
                'entry_price': '100',
                'initial_stop_price': '90',
                'exit_price': '120',
                'result_status': 'WIN',
                'trade_taken': True,
            },
            format='json',
        )
        refused = self.client.post(
            f'/api/backtest-journal/campaigns/{cid}/observations/',
            {
                'market_datetime': '2026-03-11T14:30:00Z',
                'direction': 'LONG',
                'trade_taken': False,
                'refusal_reason': 'News',
                'entry_price': '100',
                'initial_stop_price': '90',
                'exit_price': '70',
                'result_status': 'LOSS',
            },
            format='json',
        )
        self.assertEqual(refused.status_code, status.HTTP_201_CREATED, refused.data)
        self.client.post(
            f'/api/backtest-journal/campaigns/{cid}/observations/',
            {
                'market_datetime': '2026-03-12T14:30:00Z',
                'direction': 'LONG',
                'result_status': 'OPEN',
                'trade_taken': True,
            },
            format='json',
        )
        stats = self.client.get(f'/api/backtest-journal/campaigns/{cid}/statistics/')
        self.assertEqual(stats.status_code, status.HTTP_200_OK, stats.data)
        self.assertEqual(stats.data['sample_size'], 1)
        self.assertEqual(stats.data['setups_refused'], 1)
        self.assertEqual(stats.data['excluded_open'], 1)
        self.assertEqual(stats.data['total_r'], 2.0)
        self.assertEqual(stats.data['refused_with_result']['sample_size'], 1)
        equity = self.client.get(f'/api/backtest-journal/campaigns/{cid}/equity/')
        self.assertEqual(len(equity.data['taken']), 1)
        self.assertEqual(len(equity.data['refused_theoretical']), 1)

    def test_profit_factor_without_losses_is_null(self):
        strategy = self._create_strategy()
        version_id = strategy['versions'][0]['id']
        campaign = self._create_campaign(version_id)
        self.client.post(
            f'/api/backtest-journal/campaigns/{campaign["id"]}/observations/',
            {
                'market_datetime': '2026-03-10T14:30:00Z',
                'direction': 'LONG',
                'entry_price': '100',
                'initial_stop_price': '90',
                'exit_price': '110',
                'result_status': 'WIN',
            },
            format='json',
        )
        stats = self.client.get(
            f'/api/backtest-journal/campaigns/{campaign["id"]}/statistics/'
        )
        self.assertIsNone(stats.data['profit_factor'])
        self.assertTrue(stats.data['profit_factor_not_applicable'])

    def test_analysis_filters_and_csv_export(self):
        strategy = self._create_strategy()
        version_id = strategy['versions'][0]['id']
        campaign = self._create_campaign(version_id)
        cid = campaign['id']
        self.client.post(
            f'/api/backtest-journal/campaigns/{cid}/observations/',
            {
                'market_datetime': '2026-03-10T14:30:00Z',
                'direction': 'LONG',
                'entry_price': '100',
                'initial_stop_price': '90',
                'exit_price': '120',
                'result_status': 'WIN',
                'context': 'OR',
            },
            format='json',
        )
        self.client.post(
            f'/api/backtest-journal/campaigns/{cid}/observations/',
            {
                'market_datetime': '2026-03-11T14:30:00Z',
                'direction': 'SHORT',
                'entry_price': '100',
                'initial_stop_price': '110',
                'exit_price': '105',
                'result_status': 'LOSS',
                'context': 'IB',
            },
            format='json',
        )
        analysis = self.client.get(
            f'/api/backtest-journal/campaigns/{cid}/analysis/'
            f'?group_by=direction&direction=LONG'
        )
        self.assertEqual(analysis.status_code, status.HTTP_200_OK, analysis.data)
        self.assertEqual(analysis.data['filtered']['sample_size'], 1)
        groups = {row['group']: row for row in analysis.data['groups']}
        self.assertIn('LONG', groups)
        csv_res = self.client.get(f'/api/backtest-journal/campaigns/{cid}/export/')
        self.assertEqual(csv_res.status_code, status.HTTP_200_OK)
        body = csv_res.content.decode('utf-8')
        self.assertIn('context', body)
        self.assertIn('OR', body)

    def test_cannot_use_other_user_version_for_campaign(self):
        strategy = self._create_strategy()
        version_id = strategy['versions'][0]['id']
        other_client = APIClient()
        other_client.force_authenticate(user=self.other)
        res = other_client.post(
            '/api/backtest-journal/campaigns/',
            {
                'strategy_version': version_id,
                'name': 'Hack',
                'instrument': 'NQ',
                'timeframe': '5m',
                'period_start': '2026-03-01',
                'period_end': '2026-03-31',
            },
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class StatsUnitTests(TestCase):
    def test_drawdown_and_streaks(self):
        now = timezone.now()

        class Fake:
            def __init__(self, r, i):
                self.result_r = Decimal(str(r))
                self.market_datetime = now + timedelta(minutes=i)
                self.created_at = self.market_datetime
                self.pk = i

        metrics = compute_metrics(
            [Fake(1, 1), Fake(-2, 2), Fake(-1, 3), Fake(3, 4)]
        )
        self.assertEqual(metrics['max_drawdown_r'], 3.0)
        self.assertEqual(metrics['max_loss_streak'], 2)
        self.assertEqual(metrics['max_win_streak'], 1)
        self.assertAlmostEqual(metrics['total_r'], 1.0)
