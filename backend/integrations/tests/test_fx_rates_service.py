from unittest.mock import patch

from django.test import SimpleTestCase

from integrations.fx_rates_service import convert_amount_to_base, fetch_latest_rates


class FxRatesServiceTests(SimpleTestCase):
    @patch('integrations.fx_rates_service.requests.get')
    def test_fetch_latest_rates_parses_response(self, mock_get):
        mock_get.return_value.json.return_value = {
            'amount': 1.0,
            'base': 'USD',
            'rates': {'EUR': 0.92, 'GBP': 0.79},
        }
        mock_get.return_value.raise_for_status = lambda: None

        rates = fetch_latest_rates('USD', ['EUR', 'GBP'])
        self.assertIsNotNone(rates)
        self.assertAlmostEqual(rates['EUR'], 0.92)
        self.assertAlmostEqual(rates['GBP'], 0.79)

    def test_convert_amount_to_base(self):
        rates = {'EUR': 0.92}
        converted = convert_amount_to_base(92, 'EUR', 'USD', rates)
        self.assertAlmostEqual(converted, 100.0)
