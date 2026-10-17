"""Ratio Win/Loss : payoff en devise, pas un décompte de trades."""
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

from accounts.models import User, UserPreferences
from trades.models import ImportedTrade, TradingAccount
from trades.services.statistics_calculator import compute_statistics_payload


class StatisticsWinLossRatioTests(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='wl-ratio@example.com',
            username='wl_ratio',
            password='testpass123',
            first_name='W',
            last_name='L',
            role='admin',
        )
        UserPreferences.objects.get_or_create(user=self.user)
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='WL ratio account',
            account_type='other',
            currency='EUR',
            initial_capital=Decimal('10000.00'),
            status='active',
        )
        self.factory = APIRequestFactory()

    def _request(self):
        wsgi = self.factory.get(
            '/api/trades/imported/statistics/',
            {'trading_account': str(self.account.id)},
        )
        request = Request(wsgi)
        request.user = self.user
        return request

    def _trade(self, external_id: str, size: str, pnl: str, day_offset: int) -> None:
        now = timezone.now() + timezone.timedelta(days=day_offset)
        ImportedTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            external_trade_id=external_id,
            contract_name='EURUSD',
            entered_at=now,
            exited_at=now + timezone.timedelta(minutes=15),
            entry_price=Decimal('1.100000000'),
            exit_price=Decimal('1.100000000'),
            size=Decimal(size),
            trade_type='Long',
            trade_day=now.date(),
            pnl=Decimal(pnl),
        )

    def test_payoff_uses_pnl_not_trade_count_or_lot_size(self) -> None:
        # Lot gagnant à petit montant, micro-lot perdant à gros montant.
        # Le décompte vaudrait 1 ; le payoff en devise vaut 8 / 80 = 0,10.
        self._trade('wl-win-lot', '1.0000', '8.00', 0)
        self._trade('wl-loss-micro', '0.0100', '-80.00', 1)

        trades = ImportedTrade.objects.filter(trading_account=self.account)
        stats = compute_statistics_payload(self._request(), trades, 'net_pnl')

        self.assertEqual(stats['winning_trades'], 1)
        self.assertEqual(stats['losing_trades'], 1)
        self.assertAlmostEqual(stats['win_loss_ratio'], 0.10, places=2)

    def test_several_small_wins_do_not_inflate_the_ratio(self) -> None:
        # Deux gains de 8 € (lot et micro-lot) contre une perte de 80 €.
        # Le décompte vaudrait 2 ; la moyenne reste 8 / 80 = 0,10.
        self._trade('wl-win-lot', '1.0000', '8.00', 0)
        self._trade('wl-win-micro', '0.0100', '8.00', 1)
        self._trade('wl-loss-micro', '0.0100', '-80.00', 2)

        trades = ImportedTrade.objects.filter(trading_account=self.account)
        stats = compute_statistics_payload(self._request(), trades, 'net_pnl')

        self.assertEqual(stats['winning_trades'], 2)
        self.assertEqual(stats['losing_trades'], 1)
        self.assertAlmostEqual(stats['win_loss_ratio'], 0.10, places=2)
