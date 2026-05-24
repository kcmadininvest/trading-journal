"""Tests cache et normalisation cours marché."""
from django.test import TestCase, override_settings

from integrations.market_quotes_service import (
    build_empty_snapshot,
    format_price,
    load_snapshot,
    normalize_gateway_quote,
    save_snapshot,
    snapshot_cache_key,
    update_quote_in_snapshot,
)


@override_settings(
    CACHES={
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        }
    },
    CHANNEL_LAYERS={'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'}},
)
class MarketQuotesServiceTests(TestCase):
    def test_format_price_respects_tick(self) -> None:
        self.assertEqual(format_price(21045.25, 0.25), '21045.25')
        self.assertEqual(format_price(1.08452, 0.0001), '1.0845')

    def test_normalize_gateway_quote(self) -> None:
        quote = normalize_gateway_quote(
            {
                'lastPrice': 21000.5,
                'change': 50.25,
                'changePercent': 0.24,
                'timestamp': '2025-08-01T12:00:00Z',
            },
            instrument_key='nasdaq',
            contract_id='CON.F.US.ENQ.U25',
            label='Nasdaq',
            tick_size=0.25,
        )
        self.assertEqual(quote['key'], 'nasdaq')
        self.assertEqual(quote['last_price_display'], '21000.5')
        self.assertEqual(quote['change_percent'], 0.24)

    def test_snapshot_roundtrip_per_user(self) -> None:
        user_a, user_b = 101, 202
        save_snapshot(build_empty_snapshot(connected=True), user_a)
        update_quote_in_snapshot(
            normalize_gateway_quote(
                {'lastPrice': 100, 'change': 1, 'changePercent': 1.0},
                instrument_key='nasdaq',
                contract_id='CON.F.US.ENQ.U25',
                label='Nasdaq',
                tick_size=0.25,
            ),
            user_a,
        )
        save_snapshot(build_empty_snapshot(connected=True), user_b)
        update_quote_in_snapshot(
            normalize_gateway_quote(
                {'lastPrice': 200, 'change': 2, 'changePercent': 2.0},
                instrument_key='nasdaq',
                contract_id='CON.F.US.ENQ.U25',
                label='Nasdaq',
                tick_size=0.25,
            ),
            user_b,
        )
        snap_a = load_snapshot(user_a)
        snap_b = load_snapshot(user_b)
        nasdaq_a = next(q for q in snap_a['quotes'] if q['key'] == 'nasdaq')
        nasdaq_b = next(q for q in snap_b['quotes'] if q['key'] == 'nasdaq')
        self.assertEqual(nasdaq_a['last_price'], 100)
        self.assertEqual(nasdaq_b['last_price'], 200)
        self.assertNotEqual(snapshot_cache_key(user_a), snapshot_cache_key(user_b))
