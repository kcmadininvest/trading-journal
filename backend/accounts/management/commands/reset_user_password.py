"""
Réinitialise le mot de passe d'un utilisateur (dev / support local).

Usage:
    python manage.py reset_user_password csylvanie@gmail.com
    python manage.py reset_user_password csylvanie@gmail.com --password 'MonNouveauMotDePasse'
"""
from __future__ import annotations

import getpass

from django.core.management.base import BaseCommand, CommandError

from accounts.models import User


class Command(BaseCommand):
    help = 'Réinitialise le mot de passe d\'un compte (email)'

    def add_arguments(self, parser):
        parser.add_argument('email', type=str, help='Email du compte')
        parser.add_argument(
            '--password',
            type=str,
            default='',
            help='Nouveau mot de passe (sinon saisie interactive)',
        )

    def handle(self, *args, **options):
        email = options['email'].strip().lower()
        password = options['password']

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist as exc:
            raise CommandError(f'Aucun compte pour {email}') from exc

        if not password:
            password = getpass.getpass('Nouveau mot de passe: ')
            confirm = getpass.getpass('Confirmer: ')
            if password != confirm:
                raise CommandError('Les mots de passe ne correspondent pas')
        if not password:
            raise CommandError('Mot de passe vide')

        user.set_password(password)
        user.is_active = True
        user.is_verified = True
        user.save(update_fields=['password', 'is_active', 'is_verified'])

        self.stdout.write(self.style.SUCCESS(f'Mot de passe mis à jour pour {user.email}'))
