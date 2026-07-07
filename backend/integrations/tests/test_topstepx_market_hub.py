"""Tests parsing GatewayQuote SignalR TopStepX."""
from unittest.mock import patch

from django.test import TestCase, override_settings

from integrations.market_quotes_config import ResolvedMarketContract
from integrations.topstepx_client import TopStepXApiError
from integrations.topstepx_market_hub import (
    TopStepXMarketHubRunner,
    extract_gateway_quote_payload,
)


class ExtractGatewayQuotePayloadTests(TestCase):
    def test_dict_only(self) -> None:
        payload = {'lastPrice': 100.0, 'symbol': 'F.US.ENQ'}
        result, hint = extract_gateway_quote_payload(payload)
        self.assertEqual(result, payload)
        self.assertIsNone(hint)

    def test_list_contract_and_dict(self) -> None:
        quote = {'lastPrice': 29977.5, 'symbol': 'F.US.ENQ', 'contract': 'CON.F.US.ENQ.M26'}
        result, hint = extract_gateway_quote_payload(['CON.F.US.ENQ.M26', quote])
        self.assertEqual(result, quote)
        self.assertEqual(hint, 'CON.F.US.ENQ.M26')

    def test_two_positional_args(self) -> None:
        quote = {'bestBid': 1.0, 'contract': 'CON.F.US.EP.M26'}
        result, hint = extract_gateway_quote_payload('CON.F.US.EP.M26', quote)
        self.assertEqual(result, quote)
        self.assertEqual(hint, 'CON.F.US.EP.M26')

    def test_unrecognized_returns_none(self) -> None:
        result, hint = extract_gateway_quote_payload('invalid')
        self.assertIsNone(result)
        self.assertIsNone(hint)


@override_settings(
    CACHES={
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        }
    },
    CHANNEL_LAYERS={'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'}},
)
class TopStepXMarketHubRunnerQuoteTests(TestCase):
    def _runner(self) -> TopStepXMarketHubRunner:
        contracts = [
            ResolvedMarketContract(
                key='nasdaq',
                label='Nasdaq',
                contract_id='CON.F.US.ENQ.M26',
                symbol_id='F.US.ENQ',
                tick_size=0.25,
                name='NQ',
            ),
        ]
        return TopStepXMarketHubRunner(
            user_id=42,
            auth_token='token',
            contracts=contracts,
        )

    @patch('integrations.topstepx_market_hub.update_quote_in_snapshot')
    def test_on_gateway_quote_list_format_updates_snapshot(self, mock_update) -> None:
        runner = self._runner()
        runner._on_gateway_quote(
            [
                'CON.F.US.ENQ.M26',
                {
                    'symbol': 'F.US.ENQ',
                    'lastPrice': 29977.5,
                    'change': 418.75,
                    'changePercent': 0.0142,
                    'lastUpdated': '2026-05-25T05:52:43.0164386+00:00',
                    'contract': 'CON.F.US.ENQ.M26',
                },
            ],
        )
        mock_update.assert_called_once()
        quote = mock_update.call_args[0][0]
        self.assertEqual(quote['key'], 'nasdaq')
        self.assertEqual(quote['last_price'], 29977.5)
        self.assertAlmostEqual(quote['change_percent'], 1.42, places=2)
        self.assertEqual(mock_update.call_args[0][1], 42)

    @patch('integrations.topstepx_market_hub.save_snapshot')
    @patch('integrations.topstepx_market_hub.load_snapshot')
    def test_start_preserves_existing_prices(self, mock_load, mock_save) -> None:
        mock_load.return_value = {
            'connected': True,
            'message': None,
            'quotes': [
                {
                    'key': 'nasdaq',
                    'label': 'Nasdaq',
                    'contract_id': 'CON.F.US.ENQ.M26',
                    'last_price': 30000.0,
                    'last_price_display': '30000',
                    'change': None,
                    'change_percent': None,
                    'timestamp': None,
                },
            ],
        }
        runner = self._runner()
        runner._stop_event.set()
        with patch.object(runner, '_build_hub') as mock_build:
            mock_hub = mock_build.return_value
            mock_hub.start.return_value = True
            runner.start()
        saved = mock_save.call_args[0][0]
        nasdaq = next(q for q in saved['quotes'] if q['key'] == 'nasdaq')
        self.assertEqual(nasdaq['last_price_display'], '30000')
        self.assertEqual(saved['message'], 'connecting')
        mock_hub.start.assert_called_once()

    @patch('integrations.topstepx_market_hub.save_snapshot')
    @patch('integrations.topstepx_market_hub.load_snapshot')
    def test_start_raises_when_hub_start_returns_false(self, mock_load, mock_save) -> None:
        mock_load.return_value = {
            'connected': False,
            'message': None,
            'quotes': [],
        }
        runner = self._runner()
        with patch.object(runner, '_build_hub') as mock_build:
            mock_hub = mock_build.return_value
            mock_hub.start.return_value = False
            with self.assertRaises(TopStepXApiError) as ctx:
                runner.start()
        self.assertEqual(ctx.exception.error_code, 'market_hub_start_failed')

    @patch('integrations.topstepx_market_hub.update_quote_in_snapshot')
    def test_on_gateway_quote_resolves_contract_from_list_hint(self, mock_update) -> None:
        """Quote partiel sans champ contract : résolution via contract_id en tête de liste."""
        runner = self._runner()
        runner._on_gateway_quote(
            [
                'CON.F.US.ENQ.M26',
                {
                    'symbol': 'F.US.ENQ',
                    'bestBid': 29977.25,
                    'bestAsk': 29978.25,
                    'lastUpdated': '2026-05-25T05:52:45.5242382+00:00',
                },
            ],
        )
        mock_update.assert_called_once()
        quote = mock_update.call_args[0][0]
        self.assertEqual(quote['key'], 'nasdaq')
        self.assertNotIn('last_price', quote)
