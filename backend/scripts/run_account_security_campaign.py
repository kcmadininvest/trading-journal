#!/usr/bin/env python3
"""Campagne de tests sécurité — settings SQLite autonomes (pas de lecture .env).

Usage:
  backend/venv/bin/python backend/scripts/run_account_security_campaign.py
  backend/venv/bin/python backend/scripts/run_account_security_campaign.py --serve
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '--serve',
        action='store_true',
        help='Démarre runserver 127.0.0.1:8100 après migrate (pour Playwright).',
    )
    parser.add_argument(
        'test_labels',
        nargs='*',
        default=['accounts.tests.test_account_security'],
    )
    args = parser.parse_args()

    os.chdir(BACKEND_DIR)
    sys.path.insert(0, str(BACKEND_DIR))
    os.environ['DJANGO_SETTINGS_MODULE'] = 'trading_journal_api.settings_security_campaign'

    import django
    from django.core.management import call_command, execute_from_command_line

    django.setup()
    # Schéma créé depuis les modèles (migrations PG historiques incompatibles SQLite).
    call_command('migrate', '--run-syncdb', verbosity=1, interactive=False)

    if args.serve:
        from django.contrib.auth import get_user_model

        User = get_user_model()
        user, created = User.objects.get_or_create(
            email='security-e2e@localhost',
            defaults={
                'username': 'securitye2e',
                'first_name': 'Sec',
                'last_name': 'E2E',
                'is_active': True,
                'is_verified': True,
            },
        )
        user.set_password('SecurityE2E-Pass123!')
        user.is_active = True
        user.is_verified = True
        user.save()
        print(
            'CAMPAIGN_USER ready email=security-e2e@localhost '
            f'password=SecurityE2E-Pass123! created={created}',
            flush=True,
        )
        execute_from_command_line(['manage.py', 'runserver', '127.0.0.1:8100', '--noreload'])
        return 0

    from django.conf import settings
    from django.test.utils import get_runner

    TestRunner = get_runner(settings)
    runner = TestRunner(verbosity=2, interactive=False, keepdb=False)
    failures = runner.run_tests(args.test_labels)
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
