"""Tests synchronisation TopStepX (insert-only, API mockée)."""
from datetime import datetime
from decimal import Decimal
from unittest.mock import MagicMock, patch
from zoneinfo import ZoneInfo

from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User
from integrations.credentials_crypto import encrypt_json
from integrations.models import UserApiIntegration
from trades.models import TopStepTrade, TradeSyncLog, TradingAccount
from trades.sync.topstepx_mapper import map_api_trades_to_parsed_rows, parse_api_timestamp
from integrations.topstepx_accounts import resolve_projectx_account_id
from trades.sync.topstepx_sync import TopStepXSyncService, SyncResult
from trades.sync.trade_upsert import create_trade_from_parsed, import_parsed_trades


@override_settings(
    INTEGRATIONS_CREDENTIALS_KEY='test-integrations-key-for-unit-tests-only',
)
class TopStepXMapperTests(TestCase):
    def test_aggregate_entry_exit_fills(self) -> None:
        fills = [
            {
                'id': 1001,
                'contractId': 'CON.NQ',
                'creationTimestamp': '2025-08-10T16:23:28.000Z',
                'price': 25261.75,
                'size': 3,
                'side': 0,
                'profitAndLoss': None,
                'fees': 4.2,
                'voided': False,
            },
            {
                'id': 1002,
                'contractId': 'CON.NQ',
                'creationTimestamp': '2025-08-10T16:31:03.000Z',
                'price': 25245.75,
                'size': 3,
                'side': 0,
                'profitAndLoss': -960.0,
                'fees': 4.2,
                'voided': False,
            },
        ]
        rows = map_api_trades_to_parsed_rows(fills)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['topstep_id'], '1002')
        self.assertEqual(rows[0]['trade_type'], 'Long')

    def test_exit_without_entry_is_skipped(self) -> None:
        fills = [
            {
                'id': 2001,
                'contractId': 'CON.NQ',
                'creationTimestamp': '2026-05-19T14:00:00.000Z',
                'price': 25200.0,
                'size': 1,
                'side': 0,
                'profitAndLoss': -100.0,
                'fees': 2.0,
                'voided': False,
            },
        ]
        self.assertEqual(map_api_trades_to_parsed_rows(fills), [])

    def test_partial_close_reuses_entry_fill(self) -> None:
        fills = [
            {
                'id': 3001,
                'contractId': 'CON.NQ',
                'creationTimestamp': '2026-05-19T15:00:00.000Z',
                'price': 25250.0,
                'size': 3,
                'side': 0,
                'profitAndLoss': None,
                'fees': 4.0,
                'voided': False,
            },
            {
                'id': 3002,
                'contractId': 'CON.NQ',
                'creationTimestamp': '2026-05-19T15:10:00.000Z',
                'price': 25255.0,
                'size': 1,
                'side': 0,
                'profitAndLoss': -50.0,
                'fees': 2.0,
                'voided': False,
            },
            {
                'id': 3003,
                'contractId': 'CON.NQ',
                'creationTimestamp': '2026-05-19T15:20:00.000Z',
                'price': 25260.0,
                'size': 2,
                'side': 0,
                'profitAndLoss': -120.0,
                'fees': 3.0,
                'voided': False,
            },
        ]
        rows = map_api_trades_to_parsed_rows(fills)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]['topstep_id'], '3002')
        self.assertEqual(rows[0]['entered_at'], parse_api_timestamp('2026-05-19T15:00:00.000Z'))
        self.assertNotEqual(rows[0]['entered_at'], rows[0]['exited_at'])
        self.assertEqual(rows[1]['topstep_id'], '3003')
        self.assertEqual(rows[1]['entry_price'], Decimal('25250.0'))

    def test_exit_after_prior_exit_still_finds_entry(self) -> None:
        """Deux sorties consécutives : la 2e ne doit pas dupliquer entrée=sortie."""
        fills = [
            {
                'id': 4001,
                'contractId': 'CON.ES',
                'creationTimestamp': '2026-05-19T16:00:00.000Z',
                'price': 5800.0,
                'size': 2,
                'side': 0,
                'profitAndLoss': None,
                'fees': 4.0,
                'voided': False,
            },
            {
                'id': 4002,
                'contractId': 'CON.ES',
                'creationTimestamp': '2026-05-19T16:05:00.000Z',
                'price': 5805.0,
                'size': 2,
                'side': 0,
                'profitAndLoss': 50.0,
                'fees': 4.0,
                'voided': False,
            },
            {
                'id': 4003,
                'contractId': 'CON.ES',
                'creationTimestamp': '2026-05-19T16:30:00.000Z',
                'price': 5810.0,
                'size': 1,
                'side': 1,
                'profitAndLoss': 25.0,
                'fees': 2.0,
                'voided': False,
            },
        ]
        rows = map_api_trades_to_parsed_rows(fills)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[1]['entered_at'], parse_api_timestamp('2026-05-19T16:00:00.000Z'))
        self.assertNotEqual(rows[1]['entered_at'], rows[1]['exited_at'])


@override_settings(
    INTEGRATIONS_CREDENTIALS_KEY='test-integrations-key-for-unit-tests-only',
)
class TopStepXTradeUpsertTests(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='sync-upsert@example.com',
            username='sync_upsert',
            password='testpass123',
        )
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='TopStep Sync',
            account_type='topstep',
            broker_account_id='12345',
            currency='USD',
            status='active',
        )
        tz = ZoneInfo('UTC')
        self.parsed = {
            'topstep_id': 'api-42',
            'contract_name': 'NQZ5',
            'entered_at': datetime(2025, 8, 10, 16, 0, tzinfo=tz),
            'exited_at': datetime(2025, 8, 10, 17, 0, tzinfo=tz),
            'entry_price': Decimal('100'),
            'exit_price': Decimal('101'),
            'fees': Decimal('1'),
            'size': Decimal('1'),
            'trade_type': 'Long',
            'trade_day': datetime(2025, 8, 10, tzinfo=tz).date(),
            'commissions': Decimal('1'),
            'pnl': Decimal('50'),
        }

    def test_create_then_skip_duplicate(self) -> None:
        created = create_trade_from_parsed(self.user, self.account, self.parsed)
        self.assertIsNotNone(created)
        skipped = create_trade_from_parsed(self.user, self.account, self.parsed)
        self.assertIsNone(skipped)

    def test_existing_trade_notes_preserved_on_skip(self) -> None:
        trade = TopStepTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            topstep_id='api-42',
            contract_name='NQZ5',
            entered_at=self.parsed['entered_at'],
            exited_at=self.parsed['exited_at'],
            entry_price=Decimal('100'),
            exit_price=Decimal('101'),
            fees=Decimal('1'),
            size=Decimal('1'),
            trade_type='Long',
            trade_day=self.parsed['trade_day'],
            notes='Note utilisateur',
            position_strategy='breakout',
        )
        result = import_parsed_trades(self.user, self.account, [self.parsed])
        self.assertEqual(result['skipped'], 1)
        self.assertEqual(result['created'], 0)
        trade.refresh_from_db()
        self.assertEqual(trade.notes, 'Note utilisateur')
        self.assertEqual(trade.position_strategy, 'breakout')


@override_settings(
    INTEGRATIONS_CREDENTIALS_KEY='test-integrations-key-for-unit-tests-only',
)
class TopStepXSyncApiTests(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='sync-api@example.com',
            username='sync_api',
            password='testpass123',
        )
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='TopStep API',
            account_type='topstep',
            broker_account_id='999',
            currency='USD',
            status='active',
        )
        UserApiIntegration.objects.create(
            user=self.user,
            provider='topstepx',
            external_username='trader',
            secrets_encrypted=encrypt_json({'api_key': 'key-123'}),
            is_connected=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.sync_url = reverse('trading-account-sync', kwargs={'pk': self.account.pk})
        self.status_url = reverse('trading-account-sync-status', kwargs={'pk': self.account.pk})

    @patch.object(TopStepXSyncService, 'sync_account')
    def test_sync_endpoint_returns_counts(self, mock_sync) -> None:
        now = timezone.now()
        mock_sync.return_value = SyncResult(
            created=2,
            skipped=1,
            errors=[],
            last_sync_at=now,
            total_fetched=3,
        )
        res = self.client.post(self.sync_url, {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['created'], 2)
        self.assertEqual(res.data['skipped'], 1)

    @patch.object(TopStepXSyncService, 'sync_account')
    def test_sync_resolves_without_broker_id_when_service_succeeds(self, mock_sync) -> None:
        self.account.broker_account_id = ''
        self.account.save(update_fields=['broker_account_id'])
        now = timezone.now()
        mock_sync.return_value = SyncResult(
            created=1, skipped=0, errors=[], last_sync_at=now, total_fetched=1,
        )
        res = self.client.post(self.sync_url, {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_sync_requires_integration(self) -> None:
        UserApiIntegration.objects.filter(user=self.user).delete()
        res = self.client.post(self.sync_url, {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_sync_status_includes_should_sync(self) -> None:
        res = self.client.get(self.status_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('should_sync', res.data)
        self.assertIn('sync_stale_minutes', res.data)

    @patch.object(TopStepXSyncService, 'sync_account')
    def test_sync_status_endpoint(self, mock_sync) -> None:
        TradeSyncLog.objects.create(
            user=self.user,
            trading_account=self.account,
            provider='topstepx',
            source='api',
            total_fetched=5,
            created_count=2,
            skipped_count=3,
        )
        res = self.client.get(self.status_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data['integration_configured'])
        self.assertIsNotNone(res.data['last_log'])

    @patch.object(TopStepXSyncService, 'sync_account')
    def test_sync_throttle(self, mock_sync) -> None:
        now = timezone.now()
        mock_sync.return_value = SyncResult(
            created=0,
            skipped=0,
            errors=[],
            last_sync_at=now,
            total_fetched=0,
        )
        for _ in range(3):
            res = self.client.post(self.sync_url, {}, format='json')
            self.assertEqual(res.status_code, status.HTTP_200_OK)
        res = self.client.post(self.sync_url, {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
