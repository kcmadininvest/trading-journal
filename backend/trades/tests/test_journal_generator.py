"""Tests génération brouillon journal replay."""
from datetime import date, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.test import TestCase
from django.utils import timezone

from accounts.models import User
from trades.models import SessionEvent, SessionJournalDraft, TradingAccount, TradingSession
from trades.replay.journal_generator import generate_journal_draft, journal_draft_content_for_session


class JournalGeneratorTimezoneTests(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='journal-gen@example.com',
            username='journal_gen',
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
        self.session = TradingSession.objects.create(
            user=self.user,
            trading_account=self.account,
            session_date=date(2025, 8, 10),
            status='built',
            trade_count=1,
            net_pnl=Decimal('100'),
            built_at=timezone.now(),
        )
        SessionEvent.objects.create(
            session=self.session,
            event_type='position_open',
            source='derived',
            external_id='open-1',
            sequence=1,
            occurred_at=datetime(2025, 8, 10, 16, 23, 28, tzinfo=ZoneInfo('UTC')),
            payload={'contract_name': 'NQ'},
        )

    def test_chronology_uses_user_timezone(self) -> None:
        content_paris = journal_draft_content_for_session(
            self.session,
            tz_name='Europe/Paris',
        )
        content_ny = journal_draft_content_for_session(
            self.session,
            tz_name='America/New_York',
        )

        self.assertIn('18:23:28', content_paris)
        self.assertIn('12:23:28', content_ny)
        self.assertNotIn('16:23:28', content_paris)

    def test_generate_journal_draft_default_timezone(self) -> None:
        events = list(self.session.events.order_by('sequence'))
        content = generate_journal_draft(self.session, events, [], tz_name='Europe/Paris')
        self.assertIn('18:23:28', content)
