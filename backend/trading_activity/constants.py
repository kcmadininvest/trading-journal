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

TAX_PAYMENT_TYPE_SOCIAL_CONTRIBUTIONS = 'social_contributions'
TAX_PAYMENT_TYPE_INCOME_TAX = 'income_tax'
TAX_PAYMENT_TYPE_BUSINESS_TAX = 'business_tax'
TAX_PAYMENT_TYPE_LOCAL_TAX = 'local_tax'
TAX_PAYMENT_TYPE_CONSUMPTION_TAX = 'consumption_tax'
TAX_PAYMENT_TYPE_OTHER = 'other'

TAX_PAYMENT_TYPE_CHOICES = [
    (TAX_PAYMENT_TYPE_SOCIAL_CONTRIBUTIONS, 'Social contributions'),
    (TAX_PAYMENT_TYPE_INCOME_TAX, 'Income tax'),
    (TAX_PAYMENT_TYPE_BUSINESS_TAX, 'Business tax'),
    (TAX_PAYMENT_TYPE_LOCAL_TAX, 'Local tax'),
    (TAX_PAYMENT_TYPE_CONSUMPTION_TAX, 'Consumption tax'),
    (TAX_PAYMENT_TYPE_OTHER, 'Other'),
]

TAX_PAYMENT_TYPE_CODES = frozenset(c[0] for c in TAX_PAYMENT_TYPE_CHOICES)

# Ordre d’affichage des listes déroulantes : majors d’abord, puis le reste alphabétique.
_PRIMARY_CURRENCY_ORDER = ('USD', 'EUR', 'GBP')


def ordered_common_currency_codes() -> list[str]:
    first = [c for c in _PRIMARY_CURRENCY_ORDER if c in COMMON_CURRENCY_CODES]
    rest = sorted(COMMON_CURRENCY_CODES - set(first))
    return first + rest
