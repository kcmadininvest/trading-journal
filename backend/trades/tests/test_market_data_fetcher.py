"""Tests market_data_fetcher (multi-actif, session-only)."""
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from django.test import TestCase

from trades.replay.market_data_fetcher import (
    collect_session_contract_ids,
    count_fills_per_contract,
    estimate_bar_limit,
    fetch_market_data_for_session,
    pick_bar_interval,
    session_time_bounds,
)


class MarketDataFetcherTests(TestCase):
    def test_collect_session_contract_ids_from_fills_and_orders(self) -> None:
        events = [
            {
                'event_type': 'fill',
                'payload': {
                    'fill': {'contractId': 'CON.F.US.GC.Z25'},
                },
            },
            {
                'event_type': 'order_created',
                'payload': {
                    'order': {'contractId': 'CON.F.US.CL.U25'},
                },
            },
            {
                'event_type': 'fill',
                'payload': {
                    'fill': {'contractId': 'CON.F.US.GC.Z25'},
                },
            },
        ]
        contracts = collect_session_contract_ids(events)
        self.assertEqual(set(contracts.keys()), {
            'CON.F.US.GC.Z25',
            'CON.F.US.CL.U25',
        })
        self.assertEqual(contracts['CON.F.US.GC.Z25'], 'GC')
        self.assertEqual(contracts['CON.F.US.CL.U25'], 'CL')

    def test_collect_empty_when_no_contract_ids(self) -> None:
        self.assertEqual(collect_session_contract_ids([]), {})

    def test_pick_bar_interval(self) -> None:
        self.assertEqual(pick_bar_interval(timedelta(minutes=30)), (2, 1))
        self.assertEqual(pick_bar_interval(timedelta(hours=2)), (2, 5))
        self.assertEqual(pick_bar_interval(timedelta(hours=5)), (2, 15))

    def test_count_fills_per_contract(self) -> None:
        events = [
            {'event_type': 'fill', 'payload': {'fill': {'contractId': 'CON.F.US.GC.Z25'}}},
            {'event_type': 'fill', 'payload': {'fill': {'contractId': 'CON.F.US.GC.Z25'}}},
            {'event_type': 'fill', 'payload': {'fill': {'contractId': 'CON.F.US.CL.U25'}}},
        ]
        counts = count_fills_per_contract(events)
        self.assertEqual(counts['CON.F.US.GC.Z25'], 2)
        self.assertEqual(counts['CON.F.US.CL.U25'], 1)

    def test_fetch_market_data_no_contracts(self) -> None:
        client = MagicMock()
        result = fetch_market_data_for_session(
            client,
            'token',
            [],
            started_at=None,
            ended_at=None,
        )
        self.assertEqual(result['status'], 'no_contracts')
        self.assertEqual(result['contracts'], [])
        client.retrieve_bars.assert_not_called()

    def test_fetch_market_data_ok_gc(self) -> None:
        client = MagicMock()
        client.retrieve_bars.return_value = [
            {
                't': '2025-08-10T16:00:00+00:00',
                'o': 2400.0,
                'h': 2410.0,
                'l': 2395.0,
                'c': 2405.0,
                'v': 50,
            },
        ]
        start = datetime(2025, 8, 10, 14, 0, tzinfo=timezone.utc)
        end = datetime(2025, 8, 10, 16, 0, tzinfo=timezone.utc)
        events = [
            {
                'event_type': 'fill',
                'payload': {'fill': {'contractId': 'CON.F.US.GC.Z25'}},
            },
        ]
        result = fetch_market_data_for_session(
            client,
            'token',
            events,
            started_at=start,
            ended_at=end,
        )
        self.assertEqual(result['status'], 'ok')
        self.assertEqual(len(result['contracts']), 1)
        self.assertEqual(result['contracts'][0]['label'], 'GC')
        self.assertEqual(len(result['contracts'][0]['bars']), 1)

    def test_estimate_bar_limit_capped(self) -> None:
        start = datetime(2025, 1, 1, tzinfo=timezone.utc)
        end = start + timedelta(days=365)
        limit = estimate_bar_limit(start, end, 2, 1)
        self.assertLessEqual(limit, 20000)

    def test_session_time_bounds_adds_buffer(self) -> None:
        start = datetime(2025, 8, 10, 10, 0, tzinfo=timezone.utc)
        end = datetime(2025, 8, 10, 12, 0, tzinfo=timezone.utc)
        fetch_start, fetch_end = session_time_bounds(start, end)
        self.assertEqual(fetch_start, start - timedelta(minutes=30))
        self.assertEqual(fetch_end, end + timedelta(minutes=15))
