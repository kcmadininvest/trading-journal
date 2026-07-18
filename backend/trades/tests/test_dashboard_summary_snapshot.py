"""Non-régression dashboard-summary : structure et champs stables sur fixtures."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from django.test import TestCase
from rest_framework.request import Request
from rest_framework.test import APIClient, APIRequestFactory

from accounts.models import User, UserPreferences
from trades.models import ImportedTrade, TradingAccount
from trades.services.dashboard_summary_service import compute_dashboard_summary_payload


class DashboardSummarySnapshotTests(TestCase):
    EXPECTED_TOP_KEYS = {
        'daily_aggregates',
        'trades',
        'strategies',
        'compliance_stats',
        'active_days',
        'count',
        'period_performance',
        'recent_trades',
        'balance_context',
    }

    COMPLIANCE_KEYS = {
        'current_streak',
        'current_streak_start',
        'current_streak_trades',
        'current_not_respect_streak',
        'best_streak',
        'next_badge',
        'next_record_milestone',
    }

    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='dash-snap@example.com',
            username='dash_snap',
            password='testpass123',
        )
        UserPreferences.objects.get_or_create(user=self.user)
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='Snap',
            initial_capital=Decimal('10000'),
            status='active',
            is_default=True,
        )
        entered = datetime(2026, 6, 15, 10, 0)
        ImportedTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            external_trade_id='snap-1',
            contract_name='ES',
            trade_type='Long',
            entered_at=entered,
            exited_at=entered,
            entry_price=Decimal('100'),
            exit_price=Decimal('101'),
            size=Decimal('1'),
            trade_day=entered.date(),
            pnl=Decimal('100'),
            net_pnl=Decimal('100'),
        )
        self.factory = APIRequestFactory()
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _payload_via_service(self) -> dict:
        wsgi = self.factory.get(
            '/api/trades/dashboard-summary/',
            {'trading_account': str(self.account.pk)},
        )
        request = Request(wsgi)
        request.user = self.user
        return compute_dashboard_summary_payload(request)

    def test_service_and_api_payload_match(self) -> None:
        service_payload = self._payload_via_service()
        api_payload = self.client.get(
            '/api/trades/dashboard-summary/',
            {'trading_account': self.account.pk},
        ).json()

        for key in self.EXPECTED_TOP_KEYS - {'balance_context'}:
            self.assertIn(key, service_payload)
            self.assertIn(key, api_payload)

        self.assertEqual(service_payload['count'], api_payload['count'])
        self.assertEqual(
            service_payload['period_performance']['day']['pnl'],
            api_payload['period_performance']['day']['pnl'],
        )

    def test_compliance_stats_structure_unchanged(self) -> None:
        payload = self._payload_via_service()
        compliance = payload['compliance_stats']
        for key in self.COMPLIANCE_KEYS:
            self.assertIn(key, compliance)

    def test_balance_context_present_for_account(self) -> None:
        payload = self._payload_via_service()
        self.assertIn('balance_context', payload)
        self.assertIn('current_balance', payload['balance_context'])
