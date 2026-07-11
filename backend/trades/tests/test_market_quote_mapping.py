"""Tests mappage contract_name → instrument bandeau marché."""
from django.test import SimpleTestCase

from trades.contract_utils.market_quote_mapping import (
    instruments_from_contract_names,
    resolve_market_quote_instrument_key,
)


class MarketQuoteMappingTests(SimpleTestCase):
    def test_nqm6_resolves_to_nasdaq(self):
        self.assertEqual(resolve_market_quote_instrument_key('NQM6'), 'nasdaq')

    def test_es_resolves_to_sp500(self):
        self.assertEqual(resolve_market_quote_instrument_key('ES'), 'sp500')

    def test_enq_contract_id_resolves_to_nasdaq(self):
        self.assertEqual(resolve_market_quote_instrument_key('CON.F.US.ENQ.M26'), 'nasdaq')

    def test_ep_contract_id_resolves_to_sp500(self):
        self.assertEqual(resolve_market_quote_instrument_key('CON.F.US.EP.M26'), 'sp500')

    def test_mnq_maps_to_nasdaq_family(self):
        self.assertEqual(resolve_market_quote_instrument_key('CON.F.US.MNQ.M26'), 'nasdaq')

    def test_instruments_from_contract_names_dedupes(self):
        items = instruments_from_contract_names(['NQM6', 'ENQ', 'ESM6'])
        keys = [item['key'] for item in items]
        self.assertEqual(set(keys), {'nasdaq', 'sp500'})
        nasdaq = next(item for item in items if item['key'] == 'nasdaq')
        self.assertEqual(nasdaq['label'], 'Nasdaq')
