"""Vérifie l'agrégation par durée contre les champs réels du modèle TopStepTrade."""
from datetime import timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User
from trades.duration_buckets import aggregate_duration_performance
from trades.models import TopStepTrade, TradingAccount


class DurationBucketAggregationTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='duration-buckets@example.com',
            username='duration_buckets',
            password='testpass123',
            first_name='D',
            last_name='B',
            role='admin',
        )
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='Duration bucket account',
            account_type='other',
            currency='USD',
            initial_capital=Decimal('10000.00'),
            status='active',
        )
        now = timezone.now()

        TopStepTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            topstep_id='dur-1',
            contract_name='NQ',
            entered_at=now,
            exited_at=now + timedelta(minutes=3),
            entry_price=Decimal('100'),
            exit_price=Decimal('101'),
            size=Decimal('1'),
            trade_type='Long',
            trade_day=now.date(),
            trade_duration=timedelta(minutes=3),
            pnl=Decimal('100'),
            net_pnl=Decimal('80'),
        )
        TopStepTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            topstep_id='dur-2',
            contract_name='NQ',
            entered_at=now,
            exited_at=now + timedelta(minutes=3),
            entry_price=Decimal('100'),
            exit_price=Decimal('99'),
            size=Decimal('1'),
            trade_type='Long',
            trade_day=now.date(),
            trade_duration=timedelta(minutes=3),
            pnl=Decimal('-50'),
            net_pnl=Decimal('-60'),
        )
        TopStepTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            topstep_id='dur-3',
            contract_name='NQ',
            entered_at=now,
            exited_at=now + timedelta(minutes=3),
            entry_price=Decimal('100'),
            exit_price=Decimal('100'),
            size=Decimal('1'),
            trade_type='Long',
            trade_day=now.date(),
            trade_duration=timedelta(minutes=3),
            pnl=Decimal('0'),
            net_pnl=Decimal('0'),
        )
        TopStepTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            topstep_id='dur-4',
            contract_name='NQ',
            entered_at=now,
            exited_at=now + timedelta(minutes=8),
            entry_price=Decimal('100'),
            exit_price=Decimal('102'),
            size=Decimal('1'),
            trade_type='Long',
            trade_day=now.date(),
            trade_duration=timedelta(minutes=8),
            pnl=Decimal('200'),
            net_pnl=Decimal('150'),
        )

    def test_net_pnl_aggregation_matches_database(self) -> None:
        trades = TopStepTrade.objects.filter(trading_account=self.account).order_by('topstep_id')
        rows = aggregate_duration_performance(trades, 'net_pnl')

        bucket_5m = next(r for r in rows if r['label'] == '5m')
        self.assertEqual(bucket_5m['trade_count'], 3)
        self.assertEqual(bucket_5m['winning_count'], 1)
        self.assertEqual(bucket_5m['losing_count'], 1)
        self.assertEqual(bucket_5m['breakeven_count'], 1)
        self.assertAlmostEqual(bucket_5m['avg_pnl'], (80 - 60 + 0) / 3, places=5)
        self.assertAlmostEqual(bucket_5m['win_rate'], (1 / 3) * 100, places=5)

        bucket_5_10 = next(r for r in rows if r['label'] == '5-10m')
        self.assertEqual(bucket_5_10['trade_count'], 1)
        self.assertAlmostEqual(bucket_5_10['avg_pnl'], 150.0, places=5)
        self.assertAlmostEqual(bucket_5_10['win_rate'], 100.0, places=5)

    def test_gross_pnl_field_differs_from_net(self) -> None:
        trades = TopStepTrade.objects.filter(trading_account=self.account)
        net_rows = aggregate_duration_performance(trades, 'net_pnl')
        gross_rows = aggregate_duration_performance(trades, 'pnl')

        net_5m = next(r for r in net_rows if r['label'] == '5m')
        gross_5m = next(r for r in gross_rows if r['label'] == '5m')
        self.assertAlmostEqual(net_5m['avg_pnl'], (80 - 60 + 0) / 3, places=5)
        self.assertAlmostEqual(gross_5m['avg_pnl'], (100 - 50 + 0) / 3, places=5)

    def test_is_profitable_property_miscounts_breakeven_as_loss(self) -> None:
        """Documente l'écart : is_profitable=False pour net_pnl=0 (ne doit plus piloter le graphique)."""
        breakeven = TopStepTrade.objects.get(topstep_id='dur-3')
        self.assertFalse(breakeven.is_profitable)
