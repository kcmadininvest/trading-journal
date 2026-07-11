"""Tests API market phases."""
from datetime import date, time

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from trades.market_phases.capture_service import bulk_upsert_capture
from trades.models import TopStepTrade, TradingAccount

User = get_user_model()


class MarketPhaseApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username='api_mp', password='test')
        cls.account = TradingAccount.objects.create(
            user=cls.user,
            name='API Account',
            account_type='topstep',
        )

    def setUp(self):
        self.client.force_authenticate(user=self.user)

    def test_list_phase_definitions(self):
        url = reverse('trades:market-phase-def-list')
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data.get('results', res.data)
        codes = [p['code'] for p in data]
        self.assertIn('consolidation', codes)

    def test_instruments_from_portfolio_trades(self):
        from decimal import Decimal
        from django.utils import timezone as dj_tz

        entered = dj_tz.make_aware(__import__('datetime').datetime(2026, 7, 10, 12, 30))
        exited = dj_tz.make_aware(__import__('datetime').datetime(2026, 7, 10, 12, 45))
        TopStepTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            topstep_id='inst-t1',
            contract_name='NQM6',
            entered_at=entered,
            exited_at=exited,
            entry_price=Decimal('100'),
            exit_price=Decimal('101'),
            size=Decimal('1'),
            trade_type='Long',
            net_pnl=Decimal('50'),
            pnl=Decimal('50'),
            trade_day=date(2026, 7, 10),
        )
        url = reverse('trades:market-phase-instruments')
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        keys = [item['key'] for item in res.data['instruments']]
        self.assertEqual(keys, ['nasdaq'])

        res_account = self.client.get(url, {'trading_account': self.account.id})
        self.assertEqual([item['key'] for item in res_account.data['instruments']], ['nasdaq'])

    def test_capture_bulk_and_get(self):
        bulk_upsert_capture(
            user=self.user,
            trading_account=self.account,
            session_date=date(2026, 7, 10),
            instrument_key='nasdaq',
            blocks_data=[{
                'phase_code': 'range_bound',
                'range_start': time(12, 0),
                'range_end': time(14, 0),
            }],
            events_data=[],
        )
        url = reverse('trades:market-phase-capture')
        res = self.client.get(url, {
            'session_date': '2026-07-10',
            'trading_account': self.account.id,
            'instrument_key': 'nasdaq',
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data['blocks']), 1)

    def test_period_profile_analytics(self):
        bulk_upsert_capture(
            user=self.user,
            trading_account=self.account,
            session_date=date(2026, 7, 10),
            instrument_key='nasdaq',
            blocks_data=[{
                'phase_code': 'range_bound',
                'range_start': time(12, 0),
                'range_end': time(14, 0),
            }],
            events_data=[],
        )
        from decimal import Decimal
        from django.utils import timezone as dj_tz
        entered = dj_tz.make_aware(
            __import__('datetime').datetime(2026, 7, 10, 12, 30),
        )
        exited = dj_tz.make_aware(
            __import__('datetime').datetime(2026, 7, 10, 12, 45),
        )
        TopStepTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            topstep_id='t1',
            contract_name='NQM6',
            entered_at=entered,
            exited_at=exited,
            entry_price=Decimal('100'),
            exit_price=Decimal('101'),
            size=Decimal('1'),
            trade_type='Long',
            net_pnl=Decimal('50'),
            pnl=Decimal('50'),
            trade_day=date(2026, 7, 10),
        )
        url = reverse('trades:market-phase-period-profile')
        res = self.client.get(url, {
            'instrument_key': 'nasdaq',
            'period_key': '12:00-14:00',
            'trading_account': self.account.id,
            'date_from': '2026-07-01',
            'date_to': '2026-07-31',
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(res.data.get('sample_sessions', 0), 1)
