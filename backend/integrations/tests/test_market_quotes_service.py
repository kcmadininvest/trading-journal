"""Tests cache et normalisation cours marché."""
from django.test import TestCase, override_settings

from integrations.market_quotes_service import (
    build_empty_snapshot,
    change_percent_from_topstep_ratio,
    compute_change_percent,
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
    def test_change_percent_from_topstep_ratio(self) -> None:
        self.assertAlmostEqual(change_percent_from_topstep_ratio(0.0137), 1.37, places=2)
        self.assertAlmostEqual(change_percent_from_topstep_ratio(0.0092), 0.92, places=2)

    def test_compute_change_percent_prefers_open(self) -> None:
        self.assertAlmostEqual(compute_change_percent(69.0, 7519.0), 0.9176752227689853, places=3)
        self.assertAlmostEqual(
            compute_change_percent(405.0, 29676.25, change_percent_ratio=0.0137),
            1.364727686281117,
            places=2,
        )

    def test_load_snapshot_does_not_inflate_change_percent(self) -> None:
        user_id = 305
        save_snapshot(
            {
                **build_empty_snapshot(connected=True),
                'quotes': [
                    {
                        'key': 'sp500',
                        'label': 'S&P 500',
                        'contract_id': 'CON.F.US.EP.M26',
                        'last_price': 7557.75,
                        'last_price_display': '7557.75',
                        'change_percent': 0.92,
                    },
                ],
            },
            user_id,
        )
        sp = next(q for q in load_snapshot(user_id)['quotes'] if q['key'] == 'sp500')
        self.assertEqual(sp['change_percent'], 0.92)

    def test_normalize_uses_open_for_change_percent(self) -> None:
        quote = normalize_gateway_quote(
            {
                'lastPrice': 7560.0,
                'change': 69.0,
                'changePercent': 0.0092,
                'open': 7519.0,
            },
            instrument_key='sp500',
            contract_id='CON.F.US.EP.M26',
            label='S&P 500',
            tick_size=0.25,
        )
        self.assertAlmostEqual(quote['change_percent'], 0.9176752227689853, places=2)

    def test_format_price_respects_tick(self) -> None:
        self.assertEqual(format_price(21045.25, 0.25), '21045.25')
        self.assertEqual(format_price(21045.25, 0.25, min_decimal_places=2), '21045.25')
        self.assertEqual(format_price(4556.3, 0.1, min_decimal_places=2), '4556.30')
        self.assertEqual(format_price(77405, 5.0, min_decimal_places=2), '77405.00')
        self.assertEqual(format_price(1.08452, 0.0001), '1.0845')
        self.assertEqual(format_price(1.1650, 0.0001), '1.1650')
        self.assertEqual(format_price(1.1651, 0.0001), '1.1651')
        # Tick API parfois 0.001 : forcer 4 décimales pour l'EUR/USD.
        self.assertEqual(format_price(1.165, 0.001, min_decimal_places=4), '1.1650')

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
        self.assertEqual(quote['last_price_display'], '21000.50')
        self.assertAlmostEqual(quote['change_percent'], 24.0, places=2)

    def test_normalize_partial_quote_omits_last_price(self) -> None:
        quote = normalize_gateway_quote(
            {
                'bestBid': 29977.25,
                'bestAsk': 29978.25,
                'lastUpdated': '2026-05-25T05:52:45+00:00',
            },
            instrument_key='nasdaq',
            contract_id='CON.F.US.ENQ.M26',
            label='Nasdaq',
            tick_size=0.25,
        )
        self.assertNotIn('last_price', quote)
        self.assertNotIn('last_price_display', quote)
        self.assertIn('timestamp', quote)

    def test_partial_update_preserves_last_price(self) -> None:
        user_id = 303
        save_snapshot(build_empty_snapshot(connected=True), user_id)
        update_quote_in_snapshot(
            normalize_gateway_quote(
                {
                    'lastPrice': 29977.5,
                    'change': 10.0,
                    'changePercent': 0.1,
                },
                instrument_key='nasdaq',
                contract_id='CON.F.US.ENQ.M26',
                label='Nasdaq',
                tick_size=0.25,
            ),
            user_id,
        )
        update_quote_in_snapshot(
            normalize_gateway_quote(
                {'bestBid': 29977.0, 'lastUpdated': '2026-05-25T06:00:00+00:00'},
                instrument_key='nasdaq',
                contract_id='CON.F.US.ENQ.M26',
                label='Nasdaq',
                tick_size=0.25,
            ),
            user_id,
        )
        snap = load_snapshot(user_id)
        nasdaq = next(q for q in snap['quotes'] if q['key'] == 'nasdaq')
        self.assertEqual(nasdaq['last_price'], 29977.5)
        self.assertEqual(nasdaq['last_price_display'], '29977.50')

    def test_eurusd_display_always_four_decimals(self) -> None:
        user_id = 304
        save_snapshot(build_empty_snapshot(connected=True), user_id)
        update_quote_in_snapshot(
            {
                'key': 'eurusd',
                'label': 'EUR/USD',
                'contract_id': 'CON.F.US.M6E.M26',
                'last_price': 1.165,
                'tick_size': 0.001,
            },
            user_id,
        )
        eur = next(q for q in load_snapshot(user_id)['quotes'] if q['key'] == 'eurusd')
        self.assertEqual(eur['last_price_display'], '1.1650')

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
        self.assertEqual(nasdaq_a['last_price_display'], '100.00')
        self.assertEqual(nasdaq_b['last_price_display'], '200.00')
        self.assertNotEqual(snapshot_cache_key(user_a), snapshot_cache_key(user_b))
