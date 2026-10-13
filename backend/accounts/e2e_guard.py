"""Garde-fous du clone de qualification. Jamais sur une base de production."""
from __future__ import annotations

from django.conf import settings
from django.core.management.base import CommandError
from django.db import connection

FORBIDDEN_DB_NAMES = frozenset({'trading_journal_prod'})


def evaluate_clone_guard(
    *,
    debug: bool,
    stripe_key: str,
    db_name: str,
    schema_options: str,
    expected_name: str | None,
    expected_schema: str | None,
) -> None:
    """Lève CommandError si la cible n'est pas une base de qualification."""
    is_test_database = db_name.startswith('test_')
    if not debug and not is_test_database:
        raise CommandError('Refus : le clone e2e exige DEBUG=True.')
    if stripe_key.startswith('sk_live'):
        raise CommandError('Refus : clé Stripe live.')
    if db_name in FORBIDDEN_DB_NAMES or db_name.endswith('_prod'):
        raise CommandError(f'Refus : base de production ({db_name}).')
    if expected_name and db_name != expected_name:
        raise CommandError(
            f'Refus : base « {db_name} », attendu « {expected_name} ».'
        )
    if expected_schema and f'search_path={expected_schema}' not in schema_options.replace(' ', ''):
        raise CommandError(f'Refus : search_path attendu « {expected_schema} ».')


def assert_clone_allowed() -> None:
    options = connection.settings_dict.get('OPTIONS', {}).get('options', '') or ''
    evaluate_clone_guard(
        debug=bool(settings.DEBUG),
        stripe_key=str(getattr(settings, 'STRIPE_SECRET_KEY', '') or ''),
        db_name=str(connection.settings_dict.get('NAME') or ''),
        schema_options=options,
        expected_name=getattr(settings, 'E2E_EXPECTED_DB_NAME', None),
        expected_schema=getattr(settings, 'E2E_EXPECTED_DB_SCHEMA', None),
    )
