"""Tests résolution contrats bandeau cours."""
from datetime import date
from unittest.mock import patch

from django.test import SimpleTestCase, override_settings

from integrations.market_quotes_config import (
    _expiry_from_contract_id,
    _pick_contract_for_instrument,
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

    def test_pick_front_month_fallback_when_month_expired(self) -> None:
        """En juillet, seul M26 dans l'API : repli sur le contrat le plus récent."""
        contracts = [
            {'id': 'CON.F.US.ENQ.M26', 'symbolId': 'F.US.ENQ', 'name': 'NQM6', 'tickSize': 0.25},
        ]
        chosen = _pick_front_month_contract(
            contracts,
            symbol_id='F.US.ENQ',
            broker_symbol='ENQ',
            today=date(2026, 7, 7),
        )
        self.assertEqual(chosen['id'], 'CON.F.US.ENQ.M26')

    def test_pick_front_month_prefers_u26_over_m26_in_july(self) -> None:
        contracts = [
            {'id': 'CON.F.US.ENQ.M26', 'symbolId': 'F.US.ENQ', 'name': 'NQM6', 'tickSize': 0.25},
            {'id': 'CON.F.US.ENQ.U26', 'symbolId': 'F.US.ENQ', 'name': 'NQU6', 'tickSize': 0.25},
        ]
        chosen = _pick_front_month_contract(
            contracts,
            symbol_id='F.US.ENQ',
            broker_symbol='ENQ',
            today=date(2026, 7, 7),
        )
        self.assertEqual(chosen['id'], 'CON.F.US.ENQ.U26')

    def test_pick_contract_prefers_active_contract_in_july(self) -> None:
        contracts = [
            {
                'id': 'CON.F.US.ENQ.M26',
                'symbolId': 'F.US.ENQ',
                'name': 'NQM6',
                'activeContract': False,
                'tickSize': 0.25,
            },
            {
                'id': 'CON.F.US.ENQ.U26',
                'symbolId': 'F.US.ENQ',
                'name': 'NQU6',
                'activeContract': True,
                'tickSize': 0.25,
            },
        ]
        chosen = _pick_contract_for_instrument(
            contracts,
            symbol_id='F.US.ENQ',
            broker_symbol='ENQ',
            today=date(2026, 7, 7),
        )
        self.assertEqual(chosen['id'], 'CON.F.US.ENQ.U26')

    @override_settings(TOPSTEPX_API_BASE_URL='https://api.example.com')
    def test_resolve_market_quote_contracts_from_available_catalog(self) -> None:
        client = TopStepXApiClient(base_url='https://api.example.com')
        catalog = [
            {
                'id': 'CON.F.US.ENQ.U25',
                'symbolId': 'F.US.ENQ',
                'name': 'NQU5',
                'tickSize': 0.25,
                'activeContract': True,
            },
            {
                'id': 'CON.F.US.EP.U25',
                'symbolId': 'F.US.EP',
                'name': 'ESU5',
                'tickSize': 0.25,
                'activeContract': True,
            },
            {
                'id': 'CON.F.US.MGC.Q25',
                'symbolId': 'F.US.MGC',
                'name': 'MGCQ5',
                'tickSize': 0.1,
                'activeContract': True,
            },
            {
                'id': 'CON.F.US.M6E.U25',
                'symbolId': 'F.US.M6E',
                'name': 'M6EU5',
                'tickSize': 0.0001,
                'activeContract': True,
            },
            {
                'id': 'CON.F.US.MBT.Z25',
                'symbolId': 'F.US.MBT',
                'name': 'MBTZ5',
                'tickSize': 5,
                'activeContract': True,
            },
        ]

        with patch.object(client, 'list_available_contracts', return_value=catalog):
            with patch.object(client, 'search_contracts') as mock_search:
                resolved = resolve_market_quote_contracts(
                    client,
                    'token',
                    today=date(2025, 8, 1),
                )
                mock_search.assert_not_called()

        keys = {item.key for item in resolved}
        self.assertEqual(keys, {'nasdaq', 'sp500', 'gold', 'eurusd', 'bitcoin'})

    @override_settings(TOPSTEPX_API_BASE_URL='https://api.example.com')
    def test_resolve_falls_back_to_search_when_catalog_incomplete(self) -> None:
        client = TopStepXApiClient(base_url='https://api.example.com')

        def fake_search(*_args, search_text, live=True, **_kwargs):
            if search_text == 'MBT':
                return [
                    {
                        'id': 'CON.F.US.MBT.Z25',
                        'symbolId': 'F.US.MBT',
                        'name': 'MBTZ5',
                        'tickSize': 5,
                        'activeContract': True,
                    },
                ]
            return []

        catalog = [
            {
                'id': 'CON.F.US.ENQ.U25',
                'symbolId': 'F.US.ENQ',
                'name': 'NQU5',
                'tickSize': 0.25,
                'activeContract': True,
            },
            {
                'id': 'CON.F.US.EP.U25',
                'symbolId': 'F.US.EP',
                'name': 'ESU5',
                'tickSize': 0.25,
                'activeContract': True,
            },
            {
                'id': 'CON.F.US.MGC.Q25',
                'symbolId': 'F.US.MGC',
                'name': 'MGCQ5',
                'tickSize': 0.1,
                'activeContract': True,
            },
            {
                'id': 'CON.F.US.M6E.U25',
                'symbolId': 'F.US.M6E',
                'name': 'M6EU5',
                'tickSize': 0.0001,
                'activeContract': True,
            },
        ]

        with patch.object(client, 'list_available_contracts', return_value=catalog):
            with patch.object(client, 'search_contracts', side_effect=fake_search):
                resolved = resolve_market_quote_contracts(client, 'token', today=date(2025, 8, 1))

        keys = {item.key for item in resolved}
        self.assertEqual(keys, {'nasdaq', 'sp500', 'gold', 'eurusd', 'bitcoin'})
        bitcoin = next(item for item in resolved if item.key == 'bitcoin')
        self.assertEqual(bitcoin.contract_id, 'CON.F.US.MBT.Z25')

    @override_settings(TOPSTEPX_API_BASE_URL='https://api.example.com')
    def test_resolve_market_quote_contracts(self) -> None:
        client = TopStepXApiClient(base_url='https://api.example.com')

        def fake_search(*_args, search_text, live=True, **_kwargs):
            mapping = {
                'NQ': [{'id': 'CON.F.US.ENQ.U25', 'symbolId': 'F.US.ENQ', 'name': 'NQU5', 'tickSize': 0.25, 'activeContract': True}],
                'ES': [{'id': 'CON.F.US.EP.U25', 'symbolId': 'F.US.EP', 'name': 'ESU5', 'tickSize': 0.25, 'activeContract': True}],
                'MGC': [{'id': 'CON.F.US.MGC.Q25', 'symbolId': 'F.US.MGC', 'name': 'MGCQ5', 'tickSize': 0.1, 'activeContract': True}],
                'M6E': [{'id': 'CON.F.US.M6E.U25', 'symbolId': 'F.US.M6E', 'name': 'M6EU5', 'tickSize': 0.0001, 'activeContract': True}],
                'MBT': [{'id': 'CON.F.US.MBT.Z25', 'symbolId': 'F.US.MBT', 'name': 'MBTZ5', 'tickSize': 5, 'activeContract': True}],
            }
            return mapping.get(search_text, [])

        with patch.object(client, 'list_available_contracts', return_value=[]):
            with patch.object(client, 'search_contracts', side_effect=fake_search):
                resolved = resolve_market_quote_contracts(
                    client,
                    'token',
                    today=date(2025, 8, 1),
                )
        keys = {item.key for item in resolved}
        self.assertEqual(keys, {'nasdaq', 'sp500', 'gold', 'eurusd', 'bitcoin'})
