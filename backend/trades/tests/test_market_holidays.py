"""Tests MarketHolidaysService, cache Redis et en-têtes HTTP."""
from datetime import date
from unittest import skipUnless

from django.core.cache import cache
from django.test import TestCase
from django.urls import reverse

from trades.market_holidays import (
    CALENDARS_AVAILABLE,
    MarketHolidaysService,
    _build_market_year_index,
)
from trades.market_holidays_cache import (
    build_market_holidays_cache_key,
    extract_bundle_cache_params,
    extract_today_cache_params,
    get_cached_market_holidays_response,
    set_cached_market_holidays_response,
)


@skipUnless(CALENDARS_AVAILABLE, 'pandas_market_calendars indisponible')
class MarketHolidaysIndexTests(TestCase):
    def test_july_4th_observed_on_friday_shows_independence_day(self) -> None:
        holidays = MarketHolidaysService.get_market_holidays(
            'XNYS', date(2026, 7, 3), date(2026, 7, 3)
        )
        self.assertEqual(len(holidays), 1)
        self.assertEqual(holidays[0]['name'], 'Independence Day')

    def test_year_index_matches_service_for_nyse_2026(self) -> None:
        start = date(2026, 1, 1)
        end = date(2026, 12, 31)
        service_holidays = {
            h['date']: h['name']
            for h in MarketHolidaysService.get_market_holidays('XNYS', start, end)
        }
        index_holidays, index_early = _build_market_year_index('XNYS', 2026)
        index_map = {hd: name for hd, name in index_holidays}
        self.assertEqual(set(service_holidays), set(index_map))
        for holiday_date, name in service_holidays.items():
            self.assertEqual(index_map[holiday_date], name)

        service_early = MarketHolidaysService.get_early_closes('XNYS', start, end)
        self.assertEqual(set(service_early), set(index_early))

    def test_get_next_holidays_one_per_market(self) -> None:
        markets = ['XNYS', 'XPAR', 'XLON', 'XTKS']
        upcoming = MarketHolidaysService.get_next_holidays(count=1, markets=markets)
        seen = {event['market'] for event in upcoming}
        self.assertEqual(seen, set(markets))
        self.assertEqual(len(upcoming), len(markets))


class MarketHolidaysCacheTests(TestCase):
    def setUp(self) -> None:
        cache.clear()

    def tearDown(self) -> None:
        cache.clear()

    def test_cache_roundtrip_bundle(self) -> None:
        params = extract_bundle_cache_params(['XNYS', 'XPAR'], 1)
        key = build_market_holidays_cache_key('bundle', params)
        self.assertIn('market_holidays:v1:bundle:XNYS,XPAR:1:', key)
        self.assertIsNone(get_cached_market_holidays_response('bundle', params))
        payload = {'markets': {}, 'upcoming': [], 'count': 0}
        set_cached_market_holidays_response('bundle', params, payload)
        self.assertEqual(get_cached_market_holidays_response('bundle', params), payload)

    def test_cache_key_differs_when_markets_change(self) -> None:
        params_a = extract_today_cache_params(['XNYS'])
        params_b = extract_today_cache_params(['XNYS', 'XPAR'])
        self.assertNotEqual(
            build_market_holidays_cache_key('today', params_a),
            build_market_holidays_cache_key('today', params_b),
        )


@skipUnless(CALENDARS_AVAILABLE, 'pandas_market_calendars indisponible')
class MarketHolidaysViewTests(TestCase):
    def setUp(self) -> None:
        cache.clear()

    def tearDown(self) -> None:
        cache.clear()

    def test_bundle_response_has_cache_control_header(self) -> None:
        url = reverse('trades:market-holidays')
        response = self.client.get(f'{url}?bundle=1&count=1&markets=XNYS,XPAR')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Cache-Control'], 'public, max-age=300')
        data = response.json()
        self.assertIn('markets', data)
        self.assertIn('upcoming', data)

    def test_today_response_has_cache_control_header(self) -> None:
        url = reverse('trades:market-holidays-today')
        response = self.client.get(f'{url}?markets=XNYS')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Cache-Control'], 'public, max-age=300')

    def test_upcoming_response_has_cache_control_header(self) -> None:
        url = reverse('trades:market-holidays')
        response = self.client.get(f'{url}?count=1&markets=XNYS,XPAR')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Cache-Control'], 'public, max-age=300')
        data = response.json()
        self.assertIn('upcoming', data)
