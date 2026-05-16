from django.test import SimpleTestCase
from django.http import QueryDict

from trades.views import parse_contract_query_params


class ParseContractQueryParamsTests(SimpleTestCase):
    def test_empty(self):
        self.assertEqual(parse_contract_query_params(QueryDict()), [])

    def test_single_value(self):
        q = QueryDict('contract=NQZ5')
        self.assertEqual(parse_contract_query_params(q), ['NQZ5'])

    def test_comma_separated(self):
        q = QueryDict('contract=NQZ5,ESH5')
        self.assertEqual(parse_contract_query_params(q), ['NQZ5', 'ESH5'])

    def test_repeated_params(self):
        q = QueryDict('contract=NQZ5&contract=ESH5')
        self.assertEqual(parse_contract_query_params(q), ['NQZ5', 'ESH5'])
