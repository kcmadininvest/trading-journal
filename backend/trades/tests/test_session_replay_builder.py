"""Tests reconstruction session replay."""
from datetime import date, datetime
from decimal import Decimal
from unittest.mock import MagicMock, patch
from zoneinfo import ZoneInfo

from django.test import TestCase, override_settings

from accounts.models import User
from integrations.credentials_crypto import encrypt_json
from integrations.models import UserApiIntegration
from integrations.topstepx_client import TopStepXApiError
from trades.models import SessionEvent, TradingAccount, TradingSession, TopStepTrade
from trades.replay.insight_rules import run_insight_rules
from trades.replay.event_display import format_contract_label, order_summary
from trades.replay.session_builder import (
    SessionReplayBuilder,
    _fill_events,
    _order_events,
    session_day_bounds,
)


@override_settings(
    INTEGRATIONS_CREDENTIALS_KEY='test-integrations-key-for-unit-tests-only',
)
class SessionReplayBuilderUnitTests(TestCase):
    def test_order_events_created_and_updated(self) -> None:
        order = {
            'id': 99,
            'creationTimestamp': '2025-08-10T14:00:00.000Z',
            'updateTimestamp': '2025-08-10T14:05:00.000Z',
            'status': 2,
            'type': 1,
            'side': 0,
            'size': 2,
            'contractId': 'CON.F.US.MNQ.U25',
            'limitPrice': 21050.25,
        }
        events = _order_events(order)
        self.assertEqual(len(events), 2)
        self.assertEqual(events[0]['event_type'], 'order_created')
        self.assertEqual(events[1]['event_type'], 'order_updated')
        payload = events[0]['payload']
        self.assertEqual(payload['contract_name'], 'MNQ')
        self.assertEqual(payload['trade_type'], 'Long')
        self.assertEqual(payload['order_type'], 'limit')
        self.assertEqual(payload['order_status'], 'filled')

    def test_format_contract_label(self) -> None:
        self.assertEqual(format_contract_label('CON.NQ'), 'NQ')
        self.assertEqual(format_contract_label('CON.F.US.MNQ.U25'), 'MNQ')

    def test_order_summary(self) -> None:
        summary = order_summary({
            'contractId': 'CON.NQ',
            'side': 1,
            'size': 1,
            'type': 2,
            'status': 1,
        })
        self.assertEqual(summary['contract_name'], 'NQ')
        self.assertEqual(summary['trade_type'], 'Short')
        self.assertEqual(summary['order_type'], 'market')
        self.assertEqual(summary['order_status'], 'open')

    def test_fill_events_dedupe_position_open_on_partial_close(self) -> None:
        """Clôtures partielles : une seule ouverture par fill d'entrée."""
        fills = [
            {
                'id': 3001,
                'contractId': 'CON.NQ',
                'creationTimestamp': '2026-05-19T15:00:00.000Z',
                'price': 25250.0,
                'size': 3,
                'side': 0,
                'profitAndLoss': None,
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
                'voided': False,
            },
        ]
        events = _fill_events(fills, {})
        open_events = [e for e in events if e['event_type'] == 'position_open']
        close_events = [e for e in events if e['event_type'] == 'position_close']
        self.assertEqual(len(open_events), 1)
        self.assertEqual(open_events[0]['external_id'], 'open-3001')
        self.assertEqual(len(close_events), 2)
        self.assertEqual(
            {e['external_id'] for e in close_events},
            {'close-3002', 'close-3003'},
        )

    def test_fill_events_include_position_open_close(self) -> None:
        fills = [
            {
                'id': 1001,
                'contractId': 'CON.NQ',
                'creationTimestamp': '2025-08-10T16:23:28.000Z',
                'price': 25261.75,
                'size': 1,
                'side': 0,
                'profitAndLoss': None,
                'voided': False,
            },
            {
                'id': 1002,
                'contractId': 'CON.NQ',
                'creationTimestamp': '2025-08-10T16:31:03.000Z',
                'price': 25245.75,
                'size': 1,
                'side': 0,
                'profitAndLoss': -50.0,
                'voided': False,
            },
        ]
        events = _fill_events(fills, {'1002': MagicMock()})
        types = {e['event_type'] for e in events}
        self.assertIn('fill', types)
        self.assertIn('position_open', types)
        self.assertIn('position_close', types)

    def test_session_day_bounds_paris(self) -> None:
        d = date(2025, 8, 10)
        start, end = session_day_bounds(d, 'Europe/Paris')
        self.assertLess(start, end)


@override_settings(
    INTEGRATIONS_CREDENTIALS_KEY='test-integrations-key-for-unit-tests-only',
)
class SessionReplayBuildIntegrationTests(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='replay@example.com',
            username='replay_user',
            password='testpass123',
        )
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='TopStep Replay',
            account_type='topstep',
            broker_account_id='12345',
            currency='USD',
            status='active',
            maximum_loss_limit=Decimal('2000'),
        )
        UserApiIntegration.objects.create(
            user=self.user,
            provider='topstepx',
            external_username='trader',
            secrets_encrypted=encrypt_json({'api_key': 'key-123'}),
            is_connected=True,
        )
        tz = ZoneInfo('UTC')
        TopStepTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            topstep_id='1002',
            contract_name='NQ',
            entered_at=datetime(2025, 8, 10, 16, 23, 28, tzinfo=tz),
            exited_at=datetime(2025, 8, 10, 16, 31, 3, tzinfo=tz),
            entry_price=Decimal('100'),
            exit_price=Decimal('99'),
            fees=Decimal('1'),
            size=Decimal('1'),
            trade_type='Long',
            trade_day=date(2025, 8, 10),
            pnl=Decimal('-50'),
        )

    @patch('trades.replay.session_builder.get_valid_session_token', return_value='tok')
    @patch('trades.replay.session_builder.resolve_projectx_account_id', return_value=(12345, False))
    @patch('trades.replay.session_builder.TopStepXApiClient')
    def test_build_persists_session(
        self, mock_client_cls, _mock_resolve, _mock_token,
    ) -> None:
        mock_client = MagicMock()
        mock_client.search_orders.return_value = []
        mock_client.search_trades.return_value = [
            {
                'id': 1001,
                'contractId': 'CON.NQ',
                'creationTimestamp': '2025-08-10T16:23:28.000Z',
                'price': 25261.75,
                'size': 1,
                'side': 0,
                'profitAndLoss': None,
                'voided': False,
            },
            {
                'id': 1002,
                'contractId': 'CON.NQ',
                'creationTimestamp': '2025-08-10T16:31:03.000Z',
                'price': 25245.75,
                'size': 1,
                'side': 0,
                'profitAndLoss': -50.0,
                'voided': False,
            },
        ]
        builder = SessionReplayBuilder()
        builder.client = mock_client

        result = builder.build(self.user, self.account, date(2025, 8, 10))
        self.assertEqual(result.session.status, 'built')
        self.assertGreater(result.event_count, 0)
        self.assertTrue(SessionEvent.objects.filter(session=result.session).exists())
        self.assertTrue(hasattr(result.session, 'journal_draft'))

    def _build_with_mock_fills(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client.search_orders.return_value = []
        mock_client.search_trades.return_value = [
            {
                'id': 1001,
                'contractId': 'CON.NQ',
                'creationTimestamp': '2025-08-10T16:23:28.000Z',
                'price': 25261.75,
                'size': 1,
                'side': 0,
                'profitAndLoss': None,
                'voided': False,
            },
            {
                'id': 1002,
                'contractId': 'CON.NQ',
                'creationTimestamp': '2025-08-10T16:31:03.000Z',
                'price': 25245.75,
                'size': 1,
                'side': 0,
                'profitAndLoss': -50.0,
                'voided': False,
            },
        ]
        mock_client_cls.return_value = mock_client
        builder = SessionReplayBuilder()
        builder.client = mock_client
        return builder.build(self.user, self.account, date(2025, 8, 10))

    @patch('trades.replay.session_builder.get_valid_session_token', return_value='tok')
    @patch('trades.replay.session_builder.resolve_projectx_account_id', return_value=(12345, False))
    @patch('trades.replay.session_builder.TopStepXApiClient')
    def test_build_preserves_session_when_api_returns_empty(
        self, mock_client_cls, _mock_resolve, _mock_token,
    ) -> None:
        first = self._build_with_mock_fills(mock_client_cls)
        event_count = SessionEvent.objects.filter(session=first.session).count()
        self.assertGreater(event_count, 0)

        mock_client = mock_client_cls.return_value
        mock_client.search_orders.return_value = []
        mock_client.search_trades.return_value = []

        builder = SessionReplayBuilder()
        builder.client = mock_client
        second = builder.build(self.user, self.account, date(2025, 8, 10))

        self.assertTrue(second.preserved)
        self.assertEqual(second.preserve_reason, 'api_empty')
        self.assertEqual(second.session.id, first.session.id)
        self.assertEqual(
            SessionEvent.objects.filter(session=second.session).count(),
            event_count,
        )

    @patch('trades.replay.session_builder.get_valid_session_token', return_value='tok')
    @patch('trades.replay.session_builder.resolve_projectx_account_id', return_value=(12345, False))
    @patch('trades.replay.session_builder.TopStepXApiClient')
    def test_build_preserves_session_on_api_error(
        self, mock_client_cls, _mock_resolve, _mock_token,
    ) -> None:
        first = self._build_with_mock_fills(mock_client_cls)
        event_count = SessionEvent.objects.filter(session=first.session).count()

        mock_client = mock_client_cls.return_value
        mock_client.search_orders.side_effect = TopStepXApiError('API timeout')

        builder = SessionReplayBuilder()
        builder.client = mock_client
        second = builder.build(self.user, self.account, date(2025, 8, 10))

        self.assertTrue(second.preserved)
        self.assertEqual(second.preserve_reason, 'api_error')

        first.session.refresh_from_db()
        self.assertEqual(first.session.status, 'built')
        self.assertEqual(
            SessionEvent.objects.filter(session=first.session).count(),
            event_count,
        )
