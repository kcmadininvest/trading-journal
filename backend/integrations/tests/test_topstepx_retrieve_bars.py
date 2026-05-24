"""Tests client TopStepX retrieve_bars."""
from datetime import datetime, timezone
from unittest.mock import patch

from django.test import TestCase, override_settings

from integrations.topstepx_client import TopStepXApiClient, TopStepXApiError


@override_settings(TOPSTEPX_API_BASE_URL='https://api.example.com')
class TopStepXRetrieveBarsTests(TestCase):
    def test_retrieve_bars_parses_list(self) -> None:
        client = TopStepXApiClient(base_url='https://api.example.com')
        mock_response = {
            'success': True,
            'errorCode': 0,
            'bars': [
                {
                    't': '2025-08-10T16:00:00+00:00',
                    'o': 25250.0,
                    'h': 25260.0,
                    'l': 25240.0,
                    'c': 25255.0,
                    'v': 120,
                },
            ],
        }
        start = datetime(2025, 8, 10, 14, 0, tzinfo=timezone.utc)
        end = datetime(2025, 8, 10, 18, 0, tzinfo=timezone.utc)
        with patch.object(client, '_request_json', return_value=mock_response) as mock_req:
            bars = client.retrieve_bars(
                'token',
                contract_id='CON.F.US.GC.Z25',
                live=False,
                start_time=start,
                end_time=end,
                unit=2,
                unit_number=5,
                limit=100,
            )
        self.assertEqual(len(bars), 1)
        self.assertEqual(bars[0]['t'], '2025-08-10T16:00:00+00:00')
        self.assertEqual(bars[0]['o'], 25250.0)
        self.assertEqual(bars[0]['c'], 25255.0)
        mock_req.assert_called_once()
        body = mock_req.call_args.kwargs.get('body') or mock_req.call_args[1].get('body')
        self.assertEqual(body['contractId'], 'CON.F.US.GC.Z25')
        self.assertFalse(body['live'])

    def test_retrieve_bars_raises_on_failure(self) -> None:
        client = TopStepXApiClient(base_url='https://api.example.com')
        with patch.object(
            client,
            '_request_json',
            return_value={'success': False, 'errorCode': 1, 'errorMessage': 'fail'},
        ):
            with self.assertRaises(TopStepXApiError):
                client.retrieve_bars(
                    'token',
                    contract_id='CON.F.US.CL.U25',
                    live=False,
                    start_time=datetime(2025, 8, 10, tzinfo=timezone.utc),
                    end_time=datetime(2025, 8, 10, 12, 0, tzinfo=timezone.utc),
                    unit=2,
                    unit_number=1,
                    limit=50,
                )
