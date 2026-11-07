"""Crée un utilisateur de démo fictif pour captures de tutoriels (Playwright).

Données inventées — aucun lien avec un compte réel / clone_user_dataset.

Usage :
    python manage.py seed_tutorial_demo
    python manage.py seed_tutorial_demo --reset
    TUTORIAL_DEMO_PASSWORD=secret python manage.py seed_tutorial_demo
"""
from __future__ import annotations

import os
from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import User, UserPreferences
from trades.models import ImportedTrade, TradingAccount

DEMO_EMAIL = 'tutorial-demo@example.invalid'
DEMO_USERNAME = 'tutorial_demo'


class Command(BaseCommand):
    help = 'Seed utilisateur fictif pour captures tutoriels (email tutorial-demo@example.invalid).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Supprime et recrée le compte démo.',
        )
        parser.add_argument(
            '--password',
            default='',
            help='Mot de passe (sinon TUTORIAL_DEMO_PASSWORD ou TutorialDemo!234).',
        )

    def handle(self, *args, **options):
        password = (
            options['password']
            or os.environ.get('TUTORIAL_DEMO_PASSWORD')
            or 'TutorialDemo!234'
        )

        if options['reset']:
            User.objects.filter(email=DEMO_EMAIL).delete()
            User.objects.filter(username=DEMO_USERNAME).delete()
            self.stdout.write('Ancien compte démo supprimé.')

        user, created = User.objects.get_or_create(
            email=DEMO_EMAIL,
            defaults={
                'username': DEMO_USERNAME,
                'first_name': 'Tutorial',
                'last_name': 'Demo',
                'is_active': True,
                'is_verified': True,
            },
        )
        if not created and user.username != DEMO_USERNAME:
            user.username = DEMO_USERNAME
        user.set_password(password)
        user.is_active = True
        if hasattr(user, 'is_verified'):
            user.is_verified = True
        user.save()

        prefs, _ = UserPreferences.objects.get_or_create(user=user)
        prefs.language = 'fr'
        prefs.tutorials_progress = {}
        prefs.tutorials_auto_prompt_dismissed = True
        prefs.save(update_fields=[
            'language',
            'tutorials_progress',
            'tutorials_auto_prompt_dismissed',
            'updated_at',
        ])

        account, _ = TradingAccount.objects.get_or_create(
            user=user,
            name='Demo Futures Account',
            defaults={
                'account_type': 'other',
                'currency': 'USD',
                'initial_capital': Decimal('50000.00'),
                'status': 'active',
            },
        )

        # Quelques trades inventés pour dashboard / calendrier non vides
        now = timezone.now()
        samples = [
            ('NQH6', Decimal('21500.25'), Decimal('21540.50'), Decimal('1'), 'Long'),
            ('ESH6', Decimal('5800.00'), Decimal('5788.25'), Decimal('2'), 'Short'),
            ('NQH6', Decimal('21480.00'), Decimal('21495.75'), Decimal('1'), 'Long'),
        ]
        for idx, (contract, entry, exit_p, size, side) in enumerate(samples):
            external_id = f'TUTO-DEMO-{idx + 1}'
            entered = now - timedelta(days=idx + 1, hours=2)
            exited = entered + timedelta(minutes=25)
            ImportedTrade.objects.update_or_create(
                user=user,
                trading_account=account,
                external_trade_id=external_id,
                defaults={
                    'contract_name': contract,
                    'entered_at': entered,
                    'exited_at': exited,
                    'entry_price': entry,
                    'exit_price': exit_p,
                    'size': size,
                    'trade_type': side,
                    'fees': Decimal('4.20'),
                    'commissions': Decimal('1.80'),
                    'point_value': Decimal('20') if contract.startswith('NQ') else Decimal('50'),
                },
            )

        action = 'créé' if created else 'mis à jour'
        self.stdout.write(self.style.SUCCESS(
            f'Utilisateur démo {DEMO_EMAIL} {action} (id={user.pk}, account={account.pk}).'
        ))
        self.stdout.write(
            'Mot de passe : valeur fournie / TUTORIAL_DEMO_PASSWORD / TutorialDemo!234'
        )
