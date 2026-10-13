"""Recrée le compte de test e2e à partir d'un utilisateur source.

Usage :
    DJANGO_SETTINGS_MODULE=trading_journal_api.settings_e2e \\
        python manage.py clone_user_dataset
    python manage.py clone_user_dataset --reset
"""
from __future__ import annotations

import os

from django.conf import settings
from django.core.management.base import BaseCommand

from accounts.clone_dataset import TARGET_USERNAME, clone_user_dataset


class Command(BaseCommand):
    help = 'Clone le métier d\'un utilisateur vers le compte de test e2e.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--source',
            default=getattr(settings, 'E2E_SOURCE_USERNAME', 'csylvanie'),
            help='Nom d\'utilisateur source (défaut : csylvanie).',
        )
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Supprime le compte de test et le reconstruit.',
        )

    def handle(self, *args, **options):
        password = os.environ.get('E2E_TEST_PASSWORD', '')
        target = clone_user_dataset(
            source_username=options['source'],
            password=password,
            reset=options['reset'],
        )
        self.stdout.write(self.style.SUCCESS(
            f'Compte de test {TARGET_USERNAME} prêt (id={target.pk}).'
        ))
