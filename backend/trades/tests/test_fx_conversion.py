from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from trades.fx_conversion import (
    FxPnlResolver,
    aggregate_monetary_from_trades,
    resolve_fx_pnl_resolver,
)


class FxConversionTests(SimpleTestCase):
    def test_pnl_decimal_converts_via_rate(self):
        resolver = FxPnlResolver(base_currency='USD', rates={'EUR': 0.92})
        trade = SimpleNamespace(
            pnl=Decimal('92'),
            net_pnl=Decimal('90'),
            trading_account=SimpleNamespace(currency='EUR'),
        )
        converted = resolver.pnl_decimal(trade, 'pnl')
        self.assertAlmostEqual(float(converted), 100.0, places=2)

    def test_resolve_skips_single_account_param(self):
        request = MagicMock()
        request.query_params = {'convert_to': 'USD', 'trading_account': '3'}
        trades_qs = MagicMock()
        self.assertIsNone(resolve_fx_pnl_resolver(request, trades_qs))

    @patch('trades.fx_conversion.fetch_latest_rates')
    def test_resolve_multi_currency(self, mock_fetch):
        mock_fetch.return_value = {'EUR': 0.92}
        request = MagicMock()
        request.query_params = {'convert_to': 'USD'}
        trades_qs = MagicMock()
        trades_qs.select_related.return_value.values_list.return_value.distinct.return_value = [
            (1, 'EUR'),
            (2, 'GBP'),
        ]
        resolver = resolve_fx_pnl_resolver(request, trades_qs)
        self.assertIsNotNone(resolver)
        self.assertEqual(resolver.base_currency, 'USD')

    def test_aggregate_monetary_from_trades(self):
        resolver = FxPnlResolver(base_currency='USD', rates={'EUR': 0.92})
        trades = [
            SimpleNamespace(
                pnl=Decimal('92'),
                net_pnl=None,
                trading_account=SimpleNamespace(currency='EUR'),
            ),
            SimpleNamespace(
                pnl=Decimal('-50'),
                net_pnl=None,
                trading_account=SimpleNamespace(currency='USD'),
            ),
        ]
        result = aggregate_monetary_from_trades(
            trades, lambda t: resolver.pnl_decimal(t, 'pnl')
        )
        self.assertEqual(result['total_trades'], 2)
        self.assertEqual(result['winning_trades'], 1)
        self.assertEqual(result['losing_trades'], 1)
        self.assertAlmostEqual(float(result['total_pnl']), 50.0, places=2)
