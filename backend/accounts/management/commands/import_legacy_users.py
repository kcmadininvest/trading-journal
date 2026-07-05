"""
Importe les utilisateurs depuis portfolio_management.users vers trading_journal.auth_user.

Utile lorsque le schéma Django a été (re)créé vide alors que les comptes
existent encore dans l'ancienne table legacy sur la même base PostgreSQL.

Usage:
    python manage.py import_legacy_users
    python manage.py import_legacy_users --dry-run
    python manage.py import_legacy_users --schema portfolio_management
"""
from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.utils import timezone

from accounts.models import User, UserPreferences


class Command(BaseCommand):
    help = 'Importe les comptes legacy (portfolio_management.users) vers auth_user Django'

    def add_arguments(self, parser):
        parser.add_argument(
            '--schema',
            default='portfolio_management',
            help='Schéma PostgreSQL source (défaut: portfolio_management)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Affiche les actions sans écrire en base',
        )

    def handle(self, *args, **options):
        source_schema = options['schema']
        dry_run = options['dry_run']

        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT id, email, name, password, is_locked, role_id, last_login, created_at
                FROM "{source_schema}".users
                WHERE email IS NOT NULL AND email <> ''
                ORDER BY id
                """
            )
            rows = cursor.fetchall()

        if not rows:
            self.stdout.write(self.style.WARNING(f'Aucun utilisateur dans {source_schema}.users'))
            return

        created = 0
        updated = 0
        skipped = 0

        with transaction.atomic():
            for legacy_id, email, name, password, is_locked, role_id, last_login, created_at in rows:
                email = (email or '').strip().lower()
                if not email or email == 'anonymoususer':
                    skipped += 1
                    continue

                role = 'admin' if role_id == 1 else 'user'
                is_admin = role_id == 1
                username = (name or email.split('@')[0])[:150]
                is_active = not bool(is_locked)

                defaults = {
                    'username': username,
                    'first_name': username,
                    'last_name': '',
                    'password': password,
                    'is_active': is_active,
                    'is_staff': is_admin,
                    'is_superuser': is_admin,
                    'role': role,
                    'is_verified': True,
                    'last_login': last_login,
                }
                if created_at:
                    defaults['date_joined'] = created_at
                else:
                    defaults['date_joined'] = timezone.now()

                if dry_run:
                    self.stdout.write(
                        f'[dry-run] {email} -> role={role}, active={is_active}, username={username}'
                    )
                    continue

                profile_defaults = {
                    k: v for k, v in defaults.items() if k != 'password'
                }
                user, was_created = User.objects.update_or_create(
                    email=email,
                    defaults=profile_defaults,
                )
                # Hash pré-calculé legacy : mise à jour SQL directe (évite tout re-hash Django).
                User.objects.filter(pk=user.pk).update(password=password)
                user.refresh_from_db(fields=['password'])
                UserPreferences.objects.get_or_create(user=user)

                if was_created:
                    created += 1
                    self.stdout.write(self.style.SUCCESS(f'Créé: {email}'))
                else:
                    updated += 1
                    self.stdout.write(self.style.WARNING(f'Mis à jour: {email}'))

        if dry_run:
            self.stdout.write(self.style.NOTICE(f'{len(rows)} ligne(s) legacy analysée(s) (dry-run)'))
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f'Import terminé — créés: {created}, mis à jour: {updated}, ignorés: {skipped}'
                )
            )
