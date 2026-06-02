"""Codes de type de paiement fiscal : valeurs système + custom_{id} utilisateur."""

from __future__ import annotations

from .constants import TAX_PAYMENT_TYPE_CODES

CUSTOM_TAX_PAYMENT_TYPE_PREFIX = 'custom_'


def custom_tax_payment_type_code(type_id: int) -> str:
    return f'{CUSTOM_TAX_PAYMENT_TYPE_PREFIX}{type_id}'


def parse_custom_tax_payment_type_id(code: str) -> int | None:
    if not code or not code.startswith(CUSTOM_TAX_PAYMENT_TYPE_PREFIX):
        return None
    suffix = code[len(CUSTOM_TAX_PAYMENT_TYPE_PREFIX) :]
    if not suffix.isdigit():
        return None
    return int(suffix)


def is_builtin_tax_payment_type(code: str) -> bool:
    return code in TAX_PAYMENT_TYPE_CODES


def tax_payment_type_exists_for_user(user, code: str) -> bool:
    if is_builtin_tax_payment_type(code):
        return True
    type_id = parse_custom_tax_payment_type_id(code)
    if type_id is None:
        return False
    from .models import TradingActivityTaxPaymentType

    return TradingActivityTaxPaymentType.objects.filter(user=user, pk=type_id).exists()
