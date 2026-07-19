"""R:R réel moyen et respect du plan : gagnants hors break-even."""
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

from accounts.models import User, UserPreferences
from trades.models import ImportedTrade, TradeStrategy, TradingAccount
from trades.services.statistics_calculator import compute_statistics_payload


class StatisticsRrWinnersOnlyTests(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='rr-winners@example.com',
            username='rr_winners',
            password='testpass123',
            first_name='R',
            last_name='R',
            role='admin',
        )
        UserPreferences.objects.get_or_create(user=self.user)
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='RR winners account',
            account_type='other',
            currency='USD',
            initial_capital=Decimal('10000.00'),
            status='active',
        )
        self.factory = APIRequestFactory()
        now = timezone.now()
        # Long: entry 100, SL 90 (risk=10), TP 120 (planned RR=2)
        # Gagnant exit 120 → actual RR = 2.0 (TP atteint)
        win = ImportedTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            external_trade_id='rr-win',
            contract_name='ES',
            entered_at=now,
            exited_at=now + timezone.timedelta(minutes=30),
            entry_price=Decimal('100.000000000'),
            exit_price=Decimal('120.000000000'),
            planned_stop_loss=Decimal('90.000000000'),
            planned_take_profit=Decimal('120.000000000'),
            size=Decimal('1.0000'),
            trade_type='Long',
            trade_day=now.date(),
            pnl=Decimal('200.00'),
            net_pnl=Decimal('200.00'),
        )
        TradeStrategy.objects.create(
            user=self.user,
            trade=win,
            tp1_reached=True,
            tp2_plus_reached=False,
        )
        # Perdant exit 80 → |reward|/risk = 2.0 (aurait faussé moyenne et respect du plan)
        ImportedTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            external_trade_id='rr-loss',
            contract_name='ES',
            entered_at=now + timezone.timedelta(days=1),
            exited_at=now + timezone.timedelta(days=1, minutes=30),
            entry_price=Decimal('100.000000000'),
            exit_price=Decimal('80.000000000'),
            planned_stop_loss=Decimal('90.000000000'),
            planned_take_profit=Decimal('120.000000000'),
            size=Decimal('1.0000'),
            trade_type='Long',
            trade_day=(now + timezone.timedelta(days=1)).date(),
            pnl=Decimal('-200.00'),
            net_pnl=Decimal('-200.00'),
        )
        # Gagnant partiel sans revue stratégie → actual RR = 1.0 (inclus)
        ImportedTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            external_trade_id='rr-win-partial',
            contract_name='ES',
            entered_at=now + timezone.timedelta(days=2),
            exited_at=now + timezone.timedelta(days=2, minutes=30),
            entry_price=Decimal('100.000000000'),
            exit_price=Decimal('110.000000000'),
            planned_stop_loss=Decimal('90.000000000'),
            planned_take_profit=Decimal('120.000000000'),
            size=Decimal('1.0000'),
            trade_type='Long',
            trade_day=(now + timezone.timedelta(days=2)).date(),
            pnl=Decimal('100.00'),
            net_pnl=Decimal('100.00'),
        )
        # BE positif déclaré (PnL > 0, aucun TP) → exclu du R:R réel
        be_trade = ImportedTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            external_trade_id='rr-be-positive',
            contract_name='ES',
            entered_at=now + timezone.timedelta(days=3),
            exited_at=now + timezone.timedelta(days=3, minutes=30),
            entry_price=Decimal('100.000000000'),
            exit_price=Decimal('105.000000000'),
            planned_stop_loss=Decimal('90.000000000'),
            planned_take_profit=Decimal('120.000000000'),
            size=Decimal('1.0000'),
            trade_type='Long',
            trade_day=(now + timezone.timedelta(days=3)).date(),
            pnl=Decimal('50.00'),
            net_pnl=Decimal('50.00'),
        )
        TradeStrategy.objects.create(
            user=self.user,
            trade=be_trade,
            tp1_reached=False,
            tp2_plus_reached=False,
        )

    def _request(self):
        wsgi = self.factory.get(
            '/api/trades/imported/statistics/',
            {'trading_account': str(self.account.id)},
        )
        request = Request(wsgi)
        request.user = self.user
        return request

    def test_avg_actual_rr_excludes_losing_and_positive_be_trades(self) -> None:
        trades = ImportedTrade.objects.filter(trading_account=self.account)
        stats = compute_statistics_payload(self._request(), trades, 'net_pnl')

        # Couverture : les 4 trades ont un R:R réel
        self.assertEqual(stats['trades_with_actual_rr'], 4)
        # Moyenne hors perdant et BE positif : (2.0 + 1.0) / 2 = 1.5
        self.assertAlmostEqual(stats['avg_actual_rr'], 1.5, places=4)
        self.assertAlmostEqual(stats['avg_planned_rr'], 2.0, places=4)

    def test_plan_respect_rate_excludes_losing_and_positive_be(self) -> None:
        trades = ImportedTrade.objects.filter(trading_account=self.account)
        stats = compute_statistics_payload(self._request(), trades, 'net_pnl')

        # 2 comparables (win TP + win partiel) ; BE déclaré et perdant exclus
        self.assertEqual(stats['trades_with_both_rr'], 2)
        self.assertAlmostEqual(stats['plan_respect_rate'], 50.0, places=2)
