"""
Utilitaire pour gérer les jours fériés et demi-journées des marchés boursiers (NYSE et Euronext).
"""
import logging
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from typing import Dict, FrozenSet, List, Any, Optional, Tuple
from zoneinfo import ZoneInfo

import pandas as pd

logger = logging.getLogger(__name__)

MARKET_TIMEZONES: Dict[str, str] = {
    'XNYS': 'America/New_York',
    'XPAR': 'Europe/Paris',
    'XLON': 'Europe/London',
    'XTKS': 'Asia/Tokyo',
}

# Import conditionnel pour gérer l'incompatibilité avec Python 3.9
try:
    import pandas_market_calendars as mcal
    import exchange_calendars as xcals
    CALENDARS_AVAILABLE = True
except (TypeError, ImportError):
    # pandas_market_calendars n'est pas compatible avec Python 3.9 (union types)
    CALENDARS_AVAILABLE = False
    mcal = None
    xcals = None


@lru_cache(maxsize=16)
def _get_cached_trading_calendar(market: str):
    """Calendrier pandas_market_calendars mis en cache (instanciation lourde au premier usage)."""
    if not CALENDARS_AVAILABLE or mcal is None:
        raise RuntimeError('pandas_market_calendars indisponible')
    return mcal.get_calendar(market)


# Libellés bruts exchange_calendars (souvent basés sur la date) → noms usuels affichés.
_CALENDAR_HOLIDAY_ALIASES = {
    'July 4th': 'Independence Day',
    'Christmas': 'Christmas Day',
}

# holidays: frozenset[(date, name)], early_closes: frozenset[date]
MarketYearIndex = Tuple[FrozenSet[Tuple[date, str]], FrozenSet[date]]


def _years_for_range(start_date: date, end_date: date) -> List[int]:
    return list(range(start_date.year, end_date.year + 1))


@lru_cache(maxsize=32)
def _build_market_year_index(market: str, year: int) -> MarketYearIndex:
    """
    Index annuel : jours fériés (date, nom) + demi-journées, construit une fois par (marché, année).
    """
    if not CALENDARS_AVAILABLE:
        return frozenset(), frozenset()

    try:
        calendar = _get_cached_trading_calendar(market)
        start = date(year, 1, 1)
        end = date(year, 12, 31)
        schedule = calendar.schedule(start_date=start, end_date=end)

        all_business_days = pd.date_range(start=start, end=end, freq='B')
        market_open_days = pd.to_datetime(schedule.index.date)
        holiday_dates = [
            d.date() for d in all_business_days if d.date() not in market_open_days.date
        ]

        name_map = _build_holiday_name_map_for_year(calendar, year)

        holidays: FrozenSet[Tuple[date, str]] = frozenset(
            (
                holiday_date,
                MarketHolidaysService._normalize_holiday_name(
                    name_map.get(holiday_date)
                    or MarketHolidaysService._guess_holiday_name(holiday_date)
                ),
            )
            for holiday_date in holiday_dates
        )

        early_close_dates: FrozenSet[date] = frozenset()
        if schedule is not None and not schedule.empty:
            early_closes = calendar.early_closes(schedule=schedule)
            if early_closes is not None and len(early_closes) > 0:
                early_close_dates = frozenset(d.date() for d in early_closes.index)

        return holidays, early_close_dates
    except Exception as e:
        logger.error(
            'Erreur lors de la construction de l\'index annuel %s %s: %s',
            market,
            year,
            e,
            exc_info=True,
        )
        return frozenset(), frozenset()


def _build_holiday_name_map_for_year(calendar, year: int) -> Dict[date, str]:
    """Construit date → nom brut depuis regular_holidays et adhoc_holidays pour une année."""
    xcal = calendar.calendar if hasattr(calendar, 'calendar') else calendar
    year_start = pd.Timestamp(year, 1, 1)
    year_end = pd.Timestamp(year, 12, 31)
    name_map: Dict[date, str] = {}

    if hasattr(xcal, 'regular_holidays'):
        rh = xcal.regular_holidays
        rules = rh.rules if hasattr(rh, 'rules') else rh
        for rule in rules:
            try:
                rule_dates = rule.dates(year_start, year_end, return_name=True)
                for rule_date, name in MarketHolidaysService._iter_holiday_rule_dates(rule_dates):
                    rd = rule_date.date() if hasattr(rule_date, 'date') else rule_date
                    name_map[rd] = str(name)
            except (AttributeError, ValueError, KeyError):
                continue
            except Exception as e:
                logger.debug('Erreur lors de la lecture d\'une règle de férié: %s', e)

    if hasattr(xcal, 'adhoc_holidays'):
        for entry in xcal.adhoc_holidays:
            if isinstance(entry, tuple) and len(entry) >= 2:
                adhoc_date, name = entry[0], entry[1]
            else:
                adhoc_date, name = entry, None
            ad = adhoc_date.date() if hasattr(adhoc_date, 'date') else adhoc_date
            if date(year, 1, 1) <= ad <= date(year, 12, 31):
                name_map[ad] = str(name) if name else 'Special Market Closure'

    return name_map


def _holidays_from_index(
    market: str, start_date: date, end_date: date
) -> List[Dict[str, Any]]:
    result: List[Dict[str, Any]] = []
    for year in _years_for_range(start_date, end_date):
        holidays, _ = _build_market_year_index(market, year)
        for holiday_date, holiday_name in holidays:
            if start_date <= holiday_date <= end_date:
                result.append({'date': holiday_date, 'name': holiday_name})
    result.sort(key=lambda item: item['date'])
    return result


def _early_closes_from_index(market: str, start_date: date, end_date: date) -> List[date]:
    dates: List[date] = []
    for year in _years_for_range(start_date, end_date):
        _, early_closes = _build_market_year_index(market, year)
        dates.extend(d for d in early_closes if start_date <= d <= end_date)
    return sorted(set(dates))


class MarketHolidaysService:
    """Service pour récupérer les jours fériés et demi-journées des marchés boursiers."""

    @staticmethod
    def get_market_holidays(market: str, start_date: date, end_date: date) -> List[Dict[str, Any]]:
        """
        Retourne la liste des jours fériés pour un marché donné avec leurs noms.
        """
        if not CALENDARS_AVAILABLE:
            return []

        try:
            return _holidays_from_index(market, start_date, end_date)
        except ValueError as e:
            logger.warning(f"Calendrier de marché invalide pour {market}: {str(e)}")
            return []
        except Exception as e:
            logger.error(
                f"Erreur inattendue lors de la récupération des jours fériés: {str(e)}",
                exc_info=True,
            )
            return []

    @staticmethod
    def _normalize_holiday_name(name: str) -> str:
        """Aligne les libellés exchange_calendars avec des noms lisibles."""
        if name.startswith('Weekend '):
            name = name[len('Weekend '):]
        return _CALENDAR_HOLIDAY_ALIASES.get(name, name)

    @staticmethod
    def _iter_holiday_rule_dates(rule_dates):
        """Itère (date, nom) quelle que soit la forme renvoyée par exchange_calendars."""
        if hasattr(rule_dates, 'items'):
            yield from rule_dates.items()
            return
        for rule_date, name in rule_dates:
            yield rule_date, name

    @staticmethod
    def _get_holiday_name(calendar, holiday_date: date) -> str:
        """
        Récupère le nom d'un jour férié depuis le calendrier.
        """
        try:
            name_map = _build_holiday_name_map_for_year(calendar, holiday_date.year)
            if holiday_date in name_map:
                return MarketHolidaysService._normalize_holiday_name(name_map[holiday_date])
            return MarketHolidaysService._guess_holiday_name(holiday_date)
        except (AttributeError, ValueError) as e:
            logger.warning(f"Erreur lors de la récupération du nom du jour férié: {str(e)}")
            return MarketHolidaysService._guess_holiday_name(holiday_date)
        except Exception as e:
            logger.error(
                f"Erreur inattendue lors de la récupération du nom du jour férié: {str(e)}",
                exc_info=True,
            )
            return MarketHolidaysService._guess_holiday_name(holiday_date)

    @staticmethod
    def _guess_holiday_name(holiday_date: date) -> str:
        """
        Devine le nom d'un jour férié basé sur la date.
        """
        month = holiday_date.month
        day = holiday_date.day

        if month == 1 and day == 1:
            return "New Year's Day"
        elif month == 6 and day == 19:
            return "Juneteenth National Independence Day"
        elif month == 7 and day == 4:
            return "Independence Day"
        elif month == 7 and day == 3 and holiday_date.weekday() == 4:
            return "Independence Day"
        elif month == 12 and day == 25:
            return "Christmas Day"
        elif month == 12 and day == 24:
            return "Christmas Eve"
        elif month == 11 and 22 <= day <= 28 and holiday_date.weekday() == 3:
            return "Thanksgiving"
        elif month == 1 and 15 <= day <= 21 and holiday_date.weekday() == 0:
            return "Martin Luther King Jr. Day"
        elif month == 2 and 15 <= day <= 21 and holiday_date.weekday() == 0:
            return "Presidents' Day"
        elif month == 5 and day >= 25 and holiday_date.weekday() == 0:
            return "Memorial Day"
        elif month == 9 and day <= 7 and holiday_date.weekday() == 0:
            return "Labor Day"
        elif month == 4 and 1 <= day <= 30:
            return "Good Friday"
        elif month == 5 and day == 1:
            return "Labour Day"
        elif month == 5 and day == 8:
            return "Victory in Europe Day"
        elif month == 7 and day == 14:
            return "Bastille Day"
        elif month == 8 and day == 15:
            return "Assumption of Mary"
        elif month == 11 and day == 1:
            return "All Saints' Day"
        elif month == 11 and day == 11:
            return "Armistice Day"
        elif month == 1 and 1 <= day <= 3 and holiday_date.weekday() == 0:
            return "New Year's Day (observed)"
        elif month == 5 and day >= 25 and holiday_date.weekday() == 0:
            return "Spring Bank Holiday"
        elif month == 8 and day >= 25 and holiday_date.weekday() == 0:
            return "Summer Bank Holiday"
        elif month == 12 and 26 <= day <= 28:
            return "Boxing Day"

        return "Market Holiday"

    @staticmethod
    def get_early_closes(market: str, start_date: date, end_date: date) -> List[date]:
        """
        Retourne la liste des demi-journées (early closes) pour un marché donné.
        """
        if not CALENDARS_AVAILABLE:
            return []

        try:
            return _early_closes_from_index(market, start_date, end_date)
        except ValueError as e:
            logger.warning(f"Calendrier de marché invalide pour {market}: {str(e)}")
            return []
        except Exception as e:
            logger.error(
                f"Erreur inattendue lors de la récupération des early closes: {str(e)}",
                exc_info=True,
            )
            return []

    @staticmethod
    def _session_close_local_hhmm(market_code: str, local_date: date, tz_name: str) -> Optional[str]:
        """Heure de clôture de la séance (HH:MM) dans le fuseau du marché, d'après le schedule."""
        if not CALENDARS_AVAILABLE:
            return None
        try:
            calendar = _get_cached_trading_calendar(market_code)
            sched = calendar.schedule(start_date=local_date, end_date=local_date)
            if sched is None or len(sched) == 0:
                return None
            mc = sched.iloc[0]['market_close']
            tz = ZoneInfo(tz_name)
            ts = pd.Timestamp(mc)
            if ts.tzinfo is None:
                ts = ts.tz_localize(tz)
            else:
                ts = ts.tz_convert(tz)
            return ts.strftime('%H:%M')
        except Exception as e:
            logger.debug('_session_close_local_hhmm %s %s: %s', market_code, local_date, e)
        return None

    @staticmethod
    def get_local_today_market_info(market_code: str) -> Dict[str, Any]:
        """
        Date locale du marché, jour férié journée entière, early close, heure de clôture session (HH:MM local).
        """
        tz_name = MARKET_TIMEZONES.get(market_code)
        if not tz_name:
            return {
                'date': None,
                'is_full_day_holiday': False,
                'is_early_close_day': False,
                'regular_session_close_local': None,
            }
        tz = ZoneInfo(tz_name)
        local_date = datetime.now(timezone.utc).astimezone(tz).date()
        iso = local_date.isoformat()
        base: Dict[str, Any] = {
            'date': iso,
            'is_full_day_holiday': False,
            'is_early_close_day': False,
            'regular_session_close_local': None,
        }
        if not CALENDARS_AVAILABLE:
            return base
        try:
            holidays, early_closes = _build_market_year_index(market_code, local_date.year)
            holiday_dates = {hd for hd, _ in holidays}
            is_full = local_date in holiday_dates
            base['is_full_day_holiday'] = is_full
            if is_full:
                return base
            base['is_early_close_day'] = local_date in early_closes
            base['regular_session_close_local'] = MarketHolidaysService._session_close_local_hhmm(
                market_code, local_date, tz_name
            )
            return base
        except Exception as e:
            logger.warning('get_local_today_market_info %s: %s', market_code, e)
            return base

    @staticmethod
    def get_next_holidays(count: int = 2, markets: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """
        Retourne les N prochains jours fériés ou demi-journées pour les marchés spécifiés.
        """
        if markets is None:
            markets = ['XNYS', 'XPAR']

        today = date.today()
        if count <= 2:
            search_days = 400
        elif count <= 5:
            search_days = 550
        else:
            search_days = 730
        end_date = today + timedelta(days=search_days)

        market_names = {
            'XNYS': 'NYSE',
            'XPAR': 'Euronext Paris',
            'XLON': 'LSE',
            'XTKS': 'Tokyo SE',
        }

        upcoming = []

        for market_code in markets:
            market_name = market_names.get(market_code, market_code)

            holidays_data = MarketHolidaysService.get_market_holidays(market_code, today, end_date)
            holiday_dates = {h['date'] for h in holidays_data}

            for holiday_info in holidays_data:
                holiday_date = holiday_info['date']
                if holiday_date >= today:
                    upcoming.append({
                        'date': holiday_date.isoformat(),
                        'name': holiday_info['name'],
                        'type': 'holiday',
                        'market': market_code,
                    })

            early_closes = MarketHolidaysService.get_early_closes(market_code, today, end_date)
            for early_date in early_closes:
                if early_date >= today and early_date not in holiday_dates:
                    upcoming.append({
                        'date': early_date.isoformat(),
                        'name': f'{market_name} Early Close',
                        'type': 'early_close',
                        'market': market_code,
                    })

        upcoming.sort(key=lambda x: x['date'])

        result = []
        market_counts = {m: 0 for m in markets}

        for event in upcoming:
            market = event['market']
            if market_counts[market] < count:
                result.append(event)
                market_counts[market] += 1

            if all(c >= count for c in market_counts.values()):
                break

        return result
