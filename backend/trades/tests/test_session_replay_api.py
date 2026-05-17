"""Tests API replay session."""
from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User
from billing.models import CustomerSubscription
from integrations.credentials_crypto import encrypt_json
from integrations.models import UserApiIntegration
from trades.models import SessionJournalDraft, TopStepTrade, TradingAccount, TradingSession
from trades.replay.session_builder import SessionBuildResult


@override_settings(
    INTEGRATIONS_CREDENTIALS_KEY='test-integrations-key-for-unit-tests-only',
)
class SessionReplayApiTests(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='replay-api@example.com',
            username='replay_api',
            password='testpass123',
        )
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='TopStep',
            account_type='topstep',
            broker_account_id='1',
            currency='USD',
            status='active',
        )
        UserApiIntegration.objects.create(
            user=self.user,
            provider='topstepx',
            external_username='trader',
            secrets_encrypted=encrypt_json({'api_key': 'k'}),
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
        SessionJournalDraft.objects.create(
            session=self.session,
            content='# Test draft',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        CustomerSubscription.objects.create(
            user=self.user,
            stripe_customer_id='cus_replay_test',
            stripe_subscription_id='sub_replay_test',
            stripe_price_id='price_test',
            status=CustomerSubscription.STATUS_ACTIVE,
            current_period_end=timezone.now(),
        )

    def test_list_requires_premium(self) -> None:
        free_user = User.objects.create_user(
            email='free@example.com',
            username='free_user',
            password='testpass123',
        )
        client = APIClient()
        client.force_authenticate(user=free_user)
        res = client.get(reverse('session-replay-list'))
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_active_dates(self) -> None:
        from datetime import datetime
        from zoneinfo import ZoneInfo

        tz = ZoneInfo('UTC')
        TopStepTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            topstep_id='t1',
            contract_name='NQ',
            entered_at=datetime(2025, 8, 9, 10, 0, tzinfo=tz),
            exited_at=datetime(2025, 8, 9, 11, 0, tzinfo=tz),
            entry_price=Decimal('100'),
            exit_price=Decimal('101'),
            fees=Decimal('0'),
            size=Decimal('1'),
            trade_type='Long',
            trade_day=date(2025, 8, 9),
            pnl=Decimal('10'),
        )
        url = reverse('session-replay-active-dates')
        res = self.client.get(url, {'trading_account': self.account.pk})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('2025-08-09', res.data['dates'])

    def test_active_dates_requires_account(self) -> None:
        url = reverse('session-replay-active-dates')
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_sessions(self) -> None:
        url = reverse('session-replay-list')
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(res.data), 1)

    @patch('trades.replay.views.SessionReplayBuilder.build')
    def test_build_session(self, mock_build) -> None:
        mock_build.return_value = SessionBuildResult(
            session=self.session,
            event_count=5,
            insight_count=1,
        )
        url = reverse('session-replay-build')
        res = self.client.post(
            url,
            {'trading_account': self.account.pk, 'session_date': '2025-08-10'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_apply_journal_creates_entry(self) -> None:
        url = reverse('session-replay-apply-journal', kwargs={'pk': self.session.pk})
        res = self.client.post(url, {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data.get('created'))
