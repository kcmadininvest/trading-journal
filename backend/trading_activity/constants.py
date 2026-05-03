"""Devises autorisées pour primary_currency / secondary_currency (ISO 4217, usage courant)."""

COMMON_CURRENCY_CODES = frozenset(
    {
        'USD',
        'EUR',
        'GBP',
        'CHF',
        'CAD',
        'AUD',
        'JPY',
        'CNY',
        'SEK',
        'NOK',
        'DKK',
        'PLN',
        'HKD',
        'SGD',
        'NZD',
        'MXN',
        'ZAR',
    }
)

DEFAULT_PRIMARY_CURRENCY = 'USD'

# Ordre d’affichage des listes déroulantes : majors d’abord, puis le reste alphabétique.
_PRIMARY_CURRENCY_ORDER = ('USD', 'EUR', 'GBP')


def ordered_common_currency_codes() -> list[str]:
    first = [c for c in _PRIMARY_CURRENCY_ORDER if c in COMMON_CURRENCY_CODES]
    rest = sorted(COMMON_CURRENCY_CODES - set(first))
    return first + rest
