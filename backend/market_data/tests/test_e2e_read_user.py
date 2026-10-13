from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from market_data.e2e_access import (
    MarketDataWriteBlocked,
    market_read_user,
    reject_market_data_write,
)
from market_data.services.ingester import bulk_insert_bars

User = get_user_model()


@override_settings(
    E2E_MARKET_DATA_READ_ONLY=True,
    E2E_MARKET_DATA_SOURCE_USERNAME='bar-source',
    E2E_TEST_USERNAME='e2e',
)
class MarketReadUserTests(TestCase):
    def setUp(self):
        self.source = User.objects.create_user(
            username='bar-source',
            email='bar-source@example.com',
            password='source-pass-123',
        )
        self.target = User.objects.create_user(
            username='e2e',
            email='e2e-bars@example.com',
            password='e2e-pass-123',
        )
        self.other = User.objects.create_user(
            username='other-bars',
            email='other-bars@example.com',
            password='other-pass-123',
        )

    def test_test_user_reads_source_bars(self):
        self.assertEqual(market_read_user(self.target).pk, self.source.pk)

    def test_other_user_reads_own_bars(self):
        self.assertEqual(market_read_user(self.other).pk, self.other.pk)

    def test_test_user_cannot_write_bars(self):
        with self.assertRaises(MarketDataWriteBlocked):
            reject_market_data_write(self.target)
        with self.assertRaises(MarketDataWriteBlocked):
            bulk_insert_bars(
                [],
                user=self.target,
                instrument='NQ',
                symbol='NQ',
                contract_id='CON.NQ',
            )
