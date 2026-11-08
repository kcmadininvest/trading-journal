"""Whitelist d'ordonnancement pour les listes ledger trading-activity."""

from __future__ import annotations

from typing import Mapping

from django.db.models import QuerySet

# Clé API (prefs / query) → champ ORM. Tie-break toujours -created_at.
EXPENSE_ORDERING_FIELDS: Mapping[str, str] = {
    'date': 'date',
    'category': 'category__name',
    'label': 'label',
    'total': 'total',
    'invoice_reference': 'invoice_reference',
}

CREDIT_ORDERING_FIELDS: Mapping[str, str] = {
    'date': 'date',
    'amount': 'amount',
}

TAX_PAYMENT_ORDERING_FIELDS: Mapping[str, str] = {
    'date': 'date',
    'payment_type': 'payment_type',
    'label': 'label',
    'amount': 'amount',
    'reference': 'reference',
}

DEFAULT_ORDERING = '-date'


def parse_ordering_param(raw: str | None, allowed: Mapping[str, str]) -> list[str]:
    """
    Interprète `?ordering=` style DRF (ex. `-total`, `label`).
    Champ inconnu / vide → défaut -date + -created_at.
    """
    value = (raw or '').strip()
    if not value:
        return [DEFAULT_ORDERING, '-created_at']

    descending = value.startswith('-')
    key = value[1:] if descending else value
    orm_field = allowed.get(key)
    if not orm_field:
        return [DEFAULT_ORDERING, '-created_at']

    primary = f'-{orm_field}' if descending else orm_field
    if orm_field == 'created_at':
        return [primary]
    return [primary, '-created_at']


def apply_ledger_ordering(qs: QuerySet, raw: str | None, allowed: Mapping[str, str]) -> QuerySet:
    return qs.order_by(*parse_ordering_param(raw, allowed))
