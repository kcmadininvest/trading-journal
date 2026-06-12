"""Tests construction automatique des sessions replay après sync."""
from datetime import date, datetime, timedelta
from decimal import Decimal
from unittest.mock import MagicMock, patch
from zoneinfo import ZoneInfo

from django.test import TestCase, override_settings
from django.utils import timezone

from accounts.models import AppSettings, User
from billing.models import CustomerSubscription
from integrations.credentials_crypto import encrypt_json
from integrations.models import UserApiIntegration
from trades.models import TradingAccount, TradingSession
from trades.replay.auto_build import (
    MAX_AUTO_REPLAY_BUILD_DAYS,
    ReplayAutoBuildSummary,
    build_replay_for_new_trade_days,
)
from trades.replay.session_builder import SessionBuildResult


@override_settings(
    INTEGRATIONS_CREDENTIALS_KEY='test-integrations-key-for-unit-tests-only',
)
class ReplayAutoBuildTests(TestCase):
    def setUp(self) -> None:
        AppSettings.get_solo().premium_restrictions_enabled = True
        AppSettings.get_solo().save()

        self.user = User.objects.create_user(
            email='replay-auto@example.com',
            username='replay_auto',
            password='testpass123',
        )
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='TopStep Auto',
            account_type='topstep',
            broker_account_id='12345',
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
        self.session = TradingSession.objects.create(
            user=self.user,
            trading_account=self.account,
            session_date=date(2025, 8, 10),
            status='built',
            trade_count=1,
            net_pnl=Decimal('100'),
            built_at=timezone.now(),
        )

    def _grant_premium(self) -> None:
        CustomerSubscription.objects.create(
            user=self.user,
            stripe_customer_id='cus_auto_replay',
            stripe_subscription_id='sub_auto_replay',
            stripe_price_id='price_test',
            status=CustomerSubscription.STATUS_ACTIVE,
            current_period_end=timezone.now() + timedelta(days=30),
        )

    def test_skips_when_trade_days_empty(self) -> None:
        with patch('trades.replay.session_builder.SessionReplayBuilder') as mock_builder:
            summary = build_replay_for_new_trade_days(self.user, self.account, [])
        self.assertEqual(summary.built, 0)
        mock_builder.assert_not_called()

    def test_skips_when_not_premium(self) -> None:
        with patch('trades.replay.session_builder.SessionReplayBuilder') as mock_builder:
            summary = build_replay_for_new_trade_days(
                self.user,
                self.account,
                [date(2025, 8, 10)],
            )
        self.assertEqual(summary.built, 0)
        mock_builder.assert_not_called()

    @patch('trades.replay.session_builder.SessionReplayBuilder')
    def test_builds_each_trade_day_when_premium(self, mock_builder_cls) -> None:
        self._grant_premium()
        mock_builder = mock_builder_cls.return_value
        mock_builder.build.return_value = SessionBuildResult(
            session=self.session,
            event_count=1,
            insight_count=0,
        )

        summary = build_replay_for_new_trade_days(
            self.user,
            self.account,
            [date(2025, 8, 9), date(2025, 8, 10)],
        )

        self.assertEqual(summary.built, 2)
        self.assertEqual(summary.failed, 0)
        self.assertEqual(mock_builder.build.call_count, 2)
        called_dates = [call.args[2] for call in mock_builder.build.call_args_list]
        self.assertEqual(called_dates, [date(2025, 8, 10), date(2025, 8, 9)])

    @patch('trades.replay.session_builder.SessionReplayBuilder')
    def test_respects_max_days_cap(self, mock_builder_cls) -> None:
        self._grant_premium()
        mock_builder = mock_builder_cls.return_value
        mock_builder.build.return_value = SessionBuildResult(
            session=self.session,
            event_count=1,
            insight_count=0,
        )

        base = date(2025, 1, 1)
        many_days = [base + timedelta(days=offset) for offset in range(39)]
        summary = build_replay_for_new_trade_days(self.user, self.account, many_days)

        self.assertEqual(summary.built, MAX_AUTO_REPLAY_BUILD_DAYS)
        self.assertEqual(summary.skipped_cap, 39 - MAX_AUTO_REPLAY_BUILD_DAYS)
        self.assertEqual(mock_builder.build.call_count, MAX_AUTO_REPLAY_BUILD_DAYS)

    @patch('trades.replay.session_builder.SessionReplayBuilder')
    def test_continues_after_build_failure(self, mock_builder_cls) -> None:
        self._grant_premium()
        mock_builder = mock_builder_cls.return_value
        mock_builder.build.side_effect = [
            ValueError('API error'),
            SessionBuildResult(session=self.session, event_count=1, insight_count=0),
        ]

        summary = build_replay_for_new_trade_days(
            self.user,
            self.account,
            [date(2025, 8, 9), date(2025, 8, 10)],
        )

        self.assertEqual(summary.built, 1)
        self.assertEqual(summary.failed, 1)
        self.assertEqual(mock_builder.build.call_count, 2)
