"""Tests construction alias symboles TopStepX / ProjectX."""
from django.test import SimpleTestCase

from trades.contract_utils.topstep_aliases import (
    DEFAULT_BROKER_SYMBOL_ALIASES,
    broker_symbol_from_contract_id,
    build_broker_symbol_aliases_from_contracts,
    spec_symbol_from_topstep_name,
)
from trades.contract_utils.contract_family import (
    get_base_symbol,
    get_contract_family_key,
    trade_risk_units,
)
from trades.contract_utils.topstep_contract_catalog import TOPSTEP_LIVE_CONTRACTS
from decimal import Decimal


class TopStepAliasBuilderTests(SimpleTestCase):
    def test_spec_from_topstep_name(self) -> None:
        self.assertEqual(spec_symbol_from_topstep_name('NQU5'), 'NQ')
        self.assertEqual(spec_symbol_from_topstep_name('6BU5'), '6B')
        self.assertEqual(spec_symbol_from_topstep_name('MNQU5'), 'MNQ')

    def test_build_from_api_sample(self) -> None:
        contracts = [
            {'id': 'CON.F.US.ENQ.U25', 'name': 'NQU5'},
            {'id': 'CON.F.US.EP.U25', 'name': 'ESU5'},
            {'id': 'CON.F.US.MNQ.U25', 'name': 'MNQU5'},
            {'id': 'CON.F.US.BP6.U25', 'name': '6BU5'},
        ]
        aliases = build_broker_symbol_aliases_from_contracts(contracts)
        self.assertEqual(aliases['ENQ'], 'NQ')
        self.assertEqual(aliases['EP'], 'ES')
        self.assertNotIn('MNQ', aliases)
        self.assertEqual(aliases['BP6'], '6B')

    def test_default_aliases_cover_enq_and_ep(self) -> None:
        self.assertEqual(DEFAULT_BROKER_SYMBOL_ALIASES['ENQ'], 'NQ')
        self.assertEqual(DEFAULT_BROKER_SYMBOL_ALIASES['EP'], 'ES')
        self.assertEqual(DEFAULT_BROKER_SYMBOL_ALIASES['EEU'], 'E7')
        self.assertEqual(DEFAULT_BROKER_SYMBOL_ALIASES['GMCD'], 'MCD')
        self.assertEqual(get_base_symbol('CON.F.US.ENQ.M26'), 'NQ')
        self.assertEqual(get_contract_family_key('CON.F.US.EP.M26'), 'ES')
        self.assertEqual(get_base_symbol('CON.F.US.EEU.M26'), 'E7')
        self.assertEqual(get_contract_family_key('CON.F.US.EEU.M26'), '6E')

    def test_all_topstep_live_catalog_contracts_resolve(self) -> None:
        unresolved = []
        for row in TOPSTEP_LIVE_CONTRACTS:
            contract_id = row['id']
            broker = broker_symbol_from_contract_id(contract_id)
            base = get_base_symbol(contract_id)
            if base is None:
                unresolved.append(contract_id)
        self.assertEqual(unresolved, [], f'Contrats non résolus: {unresolved}')

    def test_enq_risk_units(self) -> None:
        class T:
            contract_name = 'CON.F.US.ENQ.M26'
            size = Decimal('1')
            point_value = None

        self.assertEqual(trade_risk_units(T()), Decimal('20'))
