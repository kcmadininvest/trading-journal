"""Tests correctifs signalrcore Market Hub."""
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from integrations.signalrcore_patches import apply_signalrcore_patches, set_rate_limited_callback


class SignalrcorePatchesTests(SimpleTestCase):
    def tearDown(self) -> None:
        set_rate_limited_callback(None)

    def test_websocket_transport_gets_connection_alive(self) -> None:
        apply_signalrcore_patches()
        from signalrcore.transport.websockets.websocket_transport import WebsocketTransport

        transport = WebsocketTransport(keep_alive_interval=15)
        self.assertFalse(transport.connection_alive)

    def test_evaluate_handshake_starts_keepalive_without_reconnect_handler(self) -> None:
        apply_signalrcore_patches()
        from signalrcore.transport.websockets.websocket_transport import WebsocketTransport
        from unittest.mock import MagicMock

        transport = WebsocketTransport(keep_alive_interval=15)
        transport.logger = MagicMock()
        transport.reconnection_handler = None
        transport._set_state = MagicMock()
        transport.protocol = MagicMock()
        transport.protocol.decode_handshake.return_value = (MagicMock(error=''), [])
        transport.connection_checker = MagicMock()
        transport.connection_checker.running = False

        transport.evaluate_handshake('{}')

        transport.connection_checker.start.assert_called_once()

    def test_handle_reconnect_backoff_on_429(self) -> None:
        apply_signalrcore_patches()
        from signalrcore.transport.base_transport import BaseTransport, TransportState
        from signalrcore.transport.reconnection import RawReconnectionHandler

        callback = MagicMock()
        set_rate_limited_callback(callback)

        transport = BaseTransport.__new__(BaseTransport)
        transport.logger = MagicMock()
        transport.manually_closing = False
        transport.reconnection_handler = RawReconnectionHandler(5, None)
        transport._client = MagicMock()
        transport._client.is_connection_closed.return_value = True
        transport.is_reconnecting = lambda: False
        transport._set_state = MagicMock()
        transport._client.dispose = MagicMock()
        transport.start = MagicMock(side_effect=Exception('Handshake failed: HTTP/1.1 429 Too Many Requests'))
        transport.deferred_reconnect = MagicMock()

        result = transport.handle_reconnect()

        self.assertTrue(result)
        callback.assert_called_once()
        transport.deferred_reconnect.assert_called_once()
        sleep_time = transport.deferred_reconnect.call_args[0][0]
        self.assertGreaterEqual(sleep_time, 120)

    @patch('integrations.topstepx_market_hub.apply_signalrcore_patches')
    @patch('integrations.topstepx_market_hub.set_rate_limited_callback')
    @patch('signalrcore.hub_connection_builder.HubConnectionBuilder')
    def test_build_hub_uses_projectx_connection_options(
        self,
        mock_builder_cls,
        mock_set_callback,
        mock_apply_patches,
    ) -> None:
        from integrations.market_quotes_config import ResolvedMarketContract
        from integrations.topstepx_market_hub import TopStepXMarketHubRunner
        from signalrcore.types import HttpTransportType

        mock_builder = MagicMock()
        mock_builder_cls.return_value = mock_builder
        mock_builder.with_url.return_value = mock_builder
        mock_builder.configure_logging.return_value = mock_builder
        mock_builder.build.return_value = MagicMock()

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
        runner = TopStepXMarketHubRunner(user_id=1, auth_token='jwt-token', contracts=contracts)
        runner._build_hub()

        mock_apply_patches.assert_called_once()
        mock_set_callback.assert_called_once_with(runner._on_rate_limited)
        url_args, url_kwargs = mock_builder.with_url.call_args
        self.assertIn('access_token=jwt-token', url_args[0])
        options = url_kwargs.get('options') or url_args[1]
        self.assertTrue(options['skip_negotiation'])
        self.assertEqual(options['transport'], HttpTransportType.web_sockets)
        self.assertNotIn('access_token_factory', options)
        mock_builder.with_automatic_reconnect.assert_not_called()

    def test_rate_limited_stops_runner_after_three_hits(self) -> None:
        from integrations.market_quotes_config import ResolvedMarketContract
        from integrations.topstepx_market_hub import TopStepXMarketHubRunner

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
        runner = TopStepXMarketHubRunner(user_id=1, auth_token='token', contracts=contracts)
        runner._on_rate_limited()
        runner._on_rate_limited()
        self.assertFalse(runner._stop_event.is_set())
        runner._on_rate_limited()
        self.assertTrue(runner._stop_event.is_set())
