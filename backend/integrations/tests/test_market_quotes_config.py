"""Tests résolution contrats bandeau cours."""
from datetime import date
from unittest.mock import patch

from django.test import SimpleTestCase, override_settings

from integrations.market_quotes_config import (
    _expiry_from_contract_id,
    _pick_front_month_contract,
    resolve_market_quote_contracts,
)
from integrations.topstepx_client import TopStepXApiClient


class MarketQuotesConfigTests(SimpleTestCase):
    def test_expiry_from_contract_id(self) -> None:
        expiry = _expiry_from_contract_id('CON.F.US.ENQ.U25', today=date(2025, 8, 1))
        self.assertEqual(expiry, date(2025, 9, 28))

    def test_pick_front_month_prefers_nearest(self) -> None:
        contracts = [
            {'id': 'CON.F.US.ENQ.Z25', 'symbolId': 'F.US.ENQ', 'name': 'NQZ5', 'tickSize': 0.25},
            {'id': 'CON.F.US.ENQ.U25', 'symbolId': 'F.US.ENQ', 'name': 'NQU5', 'tickSize': 0.25},
        ]
        chosen = _pick_front_month_contract(
            contracts,
            symbol_id='F.US.ENQ',
            broker_symbol='ENQ',
            today=date(2025, 8, 1),
        )
        self.assertEqual(chosen['id'], 'CON.F.US.ENQ.U25')

    @override_settings(TOPSTEPX_API_BASE_URL='https://api.example.com')
    def test_resolve_market_quote_contracts(self) -> None:
        client = TopStepXApiClient(base_url='https://api.example.com')

        def fake_search(*_args, search_text, live=True, **_kwargs):
            mapping = {
                'NQ': [{'id': 'CON.F.US.ENQ.U25', 'symbolId': 'F.US.ENQ', 'name': 'NQU5', 'tickSize': 0.25}],
                'ES': [{'id': 'CON.F.US.EP.U25', 'symbolId': 'F.US.EP', 'name': 'ESU5', 'tickSize': 0.25}],
                'MGC': [{'id': 'CON.F.US.MGC.Q25', 'symbolId': 'F.US.MGC', 'name': 'MGCQ5', 'tickSize': 0.1}],
                'M6E': [{'id': 'CON.F.US.M6E.U25', 'symbolId': 'F.US.M6E', 'name': 'M6EU5', 'tickSize': 0.0001}],
                'MBT': [{'id': 'CON.F.US.MBT.Z25', 'symbolId': 'F.US.MBT', 'name': 'MBTZ5', 'tickSize': 5}],
            }
            return mapping.get(search_text, [])

        with patch.object(client, 'search_contracts', side_effect=fake_search):
            resolved = resolve_market_quote_contracts(
                client,
                'token',
                today=date(2025, 8, 1),
            )
        keys = {item.key for item in resolved}
        self.assertEqual(keys, {'nasdaq', 'sp500', 'gold', 'eurusd', 'bitcoin'})
