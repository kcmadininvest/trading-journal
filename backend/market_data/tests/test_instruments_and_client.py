"""Tests client retrieve_bars conserve extra_raw + instruments catalogue."""
from datetime import datetime, timezone
from unittest.mock import patch

from django.test import SimpleTestCase, TestCase, override_settings

from integrations.topstepx_client import TopStepXApiClient
from market_data.services.instruments import instruments_from_contract_rows, list_instruments_from_catalog


@override_settings(TOPSTEPX_API_BASE_URL='https://api.example.com')
class RetrieveBarsExtraRawTests(SimpleTestCase):
    def test_extra_fields_preserved(self):
        client = TopStepXApiClient(base_url='https://api.example.com')
        mock_response = {
            'success': True,
            'errorCode': 0,
            'bars': [{
                't': '2025-03-10T14:00:00+00:00',
                'o': 1.0, 'h': 2.0, 'l': 0.5, 'c': 1.5, 'v': 10,
                'tradeCount': 3,
            }],
        }
        with patch.object(client, '_request_json', return_value=mock_response):
            bars = client.retrieve_bars(
                'token',
                contract_id='CON.F.US.ENQ.H25',
                live=False,
                start_time=datetime(2025, 3, 10, 14, 0, tzinfo=timezone.utc),
                end_time=datetime(2025, 3, 10, 15, 0, tzinfo=timezone.utc),
                unit=2,
                unit_number=1,
                limit=100,
            )
        self.assertEqual(bars[0]['tradeCount'], 3)


class InstrumentsCatalogTests(TestCase):
    def test_catalog_includes_multiple_roots(self):
        instruments = list_instruments_from_catalog()
        roots = {i.instrument for i in instruments}
        self.assertIn('NQ', roots)
        self.assertIn('MNQ', roots)
        self.assertIn('ES', roots)

    def test_not_hardcoded_nq_only(self):
        rows = [
            {'id': 'CON.F.US.MGC.Z25', 'name': 'MGCZ5', 'symbolId': 'F.US.MGC', 'tickSize': 0.1},
            {'id': 'CON.F.US.EP.U25', 'name': 'ESU5', 'symbolId': 'F.US.EP', 'tickSize': 0.25},
        ]
        infos = instruments_from_contract_rows(rows)
        roots = {i.instrument for i in infos}
        self.assertIn('MGC', roots)
        self.assertIn('ES', roots)
