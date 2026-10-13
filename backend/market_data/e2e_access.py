"""Lecture marché du compte de test, uniquement sous settings_e2e.

Les écritures sur les tables de barres restent interdites pour ce compte.
En dehors de settings_e2e les réglages sont absents : aucun effet.
"""
from __future__ import annotations

from django.conf import settings
from django.contrib.auth import get_user_model


class MarketDataWriteBlocked(PermissionError):
    """Le compte de test e2e ne peut pas écrire de bougies."""


def market_read_user(user):
    """Retourne l'utilisateur dont les barres sont lues.

    Sous settings_e2e, le compte de test lit les barres de la source
    (csylvanie) sans les copier.
    """
    if user is None:
        return user
    source_name = getattr(settings, 'E2E_MARKET_DATA_SOURCE_USERNAME', '') or ''
    test_name = getattr(settings, 'E2E_TEST_USERNAME', '') or ''
    if not source_name or not test_name:
        return user
    if getattr(user, 'username', None) != test_name:
        return user
    source = get_user_model().objects.filter(username=source_name).first()
    return source or user


def market_writes_blocked(user) -> bool:
    if not getattr(settings, 'E2E_MARKET_DATA_READ_ONLY', False):
        return False
    test_name = getattr(settings, 'E2E_TEST_USERNAME', '') or ''
    return bool(test_name) and getattr(user, 'username', None) == test_name


def reject_market_data_write(user) -> None:
    if market_writes_blocked(user):
        raise MarketDataWriteBlocked(
            'Écriture des données marché interdite pour le compte de test.'
        )
