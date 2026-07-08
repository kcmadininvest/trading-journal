"""Tests client TopStepX search_orders."""
import io
import urllib.error
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings

from integrations.topstepx_client import TopStepXApiClient, TopStepXApiError


@override_settings(TOPSTEPX_API_BASE_URL='https://api.example.com')
class TopStepXOrderSearchTests(TestCase):
    def test_search_orders_parses_list(self) -> None:
        client = TopStepXApiClient(base_url='https://api.example.com')
        mock_response = {
            'success': True,
            'errorCode': 0,
            'orders': [{'id': 1, 'contractId': 'CON.NQ'}],
        }
        with patch.object(client, '_request_json', return_value=mock_response):
            orders = client.search_orders(
                'token',
                704,
                datetime(2025, 7, 18, 21, 0, 1, tzinfo=timezone.utc),
                datetime(2025, 7, 18, 22, 0, 0, tzinfo=timezone.utc),
            )
        self.assertEqual(len(orders), 1)
        self.assertEqual(orders[0]['id'], 1)

    def test_search_orders_raises_on_failure(self) -> None:
        client = TopStepXApiClient(base_url='https://api.example.com')
        with patch.object(
            client,
            '_request_json',
            return_value={'success': False, 'errorCode': 1, 'errorMessage': 'fail'},
        ):
            with self.assertRaises(TopStepXApiError):
                client.search_orders(
                    'token',
                    704,
                    datetime(2025, 7, 18, tzinfo=timezone.utc),
                )

    def test_http_401_maps_to_session_expired(self) -> None:
        client = TopStepXApiClient(base_url='https://api.example.com')
        err = urllib.error.HTTPError(
            url='https://api.example.com/api/Contract/available',
            code=401,
            msg='Unauthorized',
            hdrs={},
            fp=io.BytesIO(b''),
        )
        with patch('urllib.request.urlopen', side_effect=err):
            with self.assertRaises(TopStepXApiError) as ctx:
                client._request_json('POST', '/api/Contract/available', auth_token='bad')
        self.assertEqual(ctx.exception.error_code, 'session_expired')
