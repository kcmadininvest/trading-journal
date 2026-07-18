from datetime import date, datetime, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from billing.models import CustomerSubscription
from trades.models import ImportedTrade, TradeStrategy, TradingAccount

User = get_user_model()


class TradeStrategyDrilldownFiltersTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='drill', password='test-pass-123')
        self.account = TradingAccount.objects.create(user=self.user, name='Main')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        CustomerSubscription.objects.create(
            user=self.user,
            stripe_customer_id='cus_drill',
            stripe_subscription_id='sub_drill',
            stripe_price_id='price_test',
            status=CustomerSubscription.STATUS_ACTIVE,
            current_period_end=timezone.now() + timedelta(days=30),
        )

        entered1 = datetime(2025, 1, 10, 10, 0, 0)
        trade_respected = ImportedTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            external_trade_id='R1',
            contract_name='ES',
            trade_type='Long',
            entered_at=entered1,
            exited_at=entered1 + timedelta(hours=1),
            trade_day=date(2025, 1, 10),
            size=Decimal('1'),
            entry_price=Decimal('100.000000000'),
            exit_price=Decimal('101.000000000'),
            net_pnl=Decimal('100'),
            pnl=Decimal('100'),
        )
        entered2 = datetime(2025, 1, 11, 10, 0, 0)
        trade_not = ImportedTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            external_trade_id='R2',
            contract_name='ES',
            trade_type='Short',
            entered_at=entered2,
            exited_at=entered2 + timedelta(hours=1),
            trade_day=date(2025, 1, 11),
            size=Decimal('1'),
            entry_price=Decimal('100.000000000'),
            exit_price=Decimal('99.000000000'),
            net_pnl=Decimal('-50'),
            pnl=Decimal('-50'),
        )
        entered3 = datetime(2025, 1, 12, 10, 0, 0)
        trade_uneval = ImportedTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            external_trade_id='R3',
            contract_name='NQ',
            trade_type='Long',
            entered_at=entered3,
            exited_at=entered3 + timedelta(hours=1),
            trade_day=date(2025, 1, 12),
            size=Decimal('1'),
            entry_price=Decimal('100.000000000'),
            exit_price=Decimal('101.000000000'),
            net_pnl=Decimal('20'),
            pnl=Decimal('20'),
        )
        entered4 = datetime(2025, 1, 13, 10, 0, 0)
        trade_win_tp1 = ImportedTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            external_trade_id='R4',
            contract_name='ES',
            trade_type='Long',
            entered_at=entered4,
            exited_at=entered4 + timedelta(hours=1),
            trade_day=date(2025, 1, 13),
            size=Decimal('1'),
            entry_price=Decimal('100.000000000'),
            exit_price=Decimal('102.000000000'),
            net_pnl=Decimal('80'),
            pnl=Decimal('80'),
        )

        TradeStrategy.objects.create(
            user=self.user,
            trade=trade_respected,
            strategy_respected=True,
            tp1_reached=False,
            tp2_plus_reached=False,
            dominant_emotions=['peur'],
        )
        TradeStrategy.objects.create(
            user=self.user,
            trade=trade_not,
            strategy_respected=False,
            tp1_reached=False,
            tp2_plus_reached=False,
            gain_if_strategy_respected=True,
            dominant_emotions=['frustration'],
        )
        TradeStrategy.objects.create(
            user=self.user,
            trade=trade_uneval,
            strategy_respected=None,
            tp1_reached=False,
            tp2_plus_reached=False,
        )
        TradeStrategy.objects.create(
            user=self.user,
            trade=trade_win_tp1,
            strategy_respected=False,
            tp1_reached=True,
            tp2_plus_reached=False,
        )

    def _ids(self, params):
        response = self.client.get('/api/trades/trade-strategies/', params)
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()
        results = data['results'] if isinstance(data, dict) else data
        return {row['trade_info']['external_trade_id'] for row in results}

    def test_filter_strategy_respected(self):
        self.assertEqual(self._ids({'strategy_respected': 'true'}), {'R1'})

    def test_filter_gain_if_and_date_range(self):
        ids = self._ids({
            'strategy_respected': 'false',
            'gain_if_strategy_respected': 'true',
            'start_date': '2025-01-01',
            'end_date': '2025-01-31',
        })
        self.assertEqual(ids, {'R2'})

    def test_filter_unevaluated(self):
        self.assertEqual(self._ids({'strategy_respected__isnull': 'true'}), {'R3'})

    def test_filter_dominant_emotion(self):
        self.assertEqual(self._ids({'dominant_emotion': 'peur'}), {'R1'})

    def test_filter_trade_day(self):
        self.assertEqual(self._ids({'trade_day': '2025-01-10'}), {'R1'})

    def test_filter_trade_weekday(self):
        # 2025-01-10 is a Friday (JS dayIndex=5 → Django week_day=6)
        self.assertEqual(self._ids({'trade_weekday': '6'}), {'R1'})

    def test_filter_winning_session_tp1(self):
        self.assertEqual(self._ids({'winning_session': 'tp1'}), {'R4'})

    def _paginated(self, params):
        response = self.client.get('/api/trades/trade-strategies/', params)
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()
        self.assertIn('results', data)
        return data

    def test_pagination_page_size_and_count(self):
        data = self._paginated({'page': '1', 'page_size': '2', 'ordering': 'trade_day'})
        self.assertEqual(data['count'], 4)
        self.assertEqual(len(data['results']), 2)
        self.assertIsNotNone(data.get('next'))

    def test_pagination_page_two_disjoint(self):
        page1 = self._paginated({'page': '1', 'page_size': '2', 'ordering': 'trade_day'})
        page2 = self._paginated({'page': '2', 'page_size': '2', 'ordering': 'trade_day'})
        ids1 = {row['trade_info']['external_trade_id'] for row in page1['results']}
        ids2 = {row['trade_info']['external_trade_id'] for row in page2['results']}
        self.assertEqual(len(ids1 & ids2), 0)
        self.assertEqual(len(ids1 | ids2), 4)

    def test_ordering_trade_day_chronological(self):
        data = self._paginated({'ordering': 'trade_day', 'page_size': '10'})
        ids = [row['trade_info']['external_trade_id'] for row in data['results']]
        self.assertEqual(ids, ['R1', 'R2', 'R3', 'R4'])
