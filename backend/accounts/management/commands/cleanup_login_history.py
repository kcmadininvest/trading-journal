"""
Commande Django pour nettoyer l'historique de connexion.

Cette commande supprime les entrées d'historique de connexion selon deux critères :
1. Les entrées plus anciennes que LOGIN_HISTORY_RETENTION_DAYS jours
2. Si LOGIN_HISTORY_MAX_ENTRIES_PER_USER est défini, les entrées excédentaires pour chaque utilisateur

Usage:
    python manage.py cleanup_login_history
    python manage.py cleanup_login_history --dry-run  # Affiche ce qui sera supprimé sans supprimer
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.conf import settings
from datetime import timedelta
from accounts.models import LoginHistory
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = 'Nettoie l\'historique de connexion en supprimant les entrées anciennes ou excédentaires'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Affiche ce qui sera supprimé sans effectuer la suppression',
        )
        parser.add_argument(
            '--retention-days',
            type=int,
            default=None,
            help='Nombre de jours de rétention (prioritaire sur LOGIN_HISTORY_RETENTION_DAYS)',
        )
        parser.add_argument(
            '--max-entries',
            type=int,
            default=None,
            help='Nombre maximum d\'entrées par utilisateur (prioritaire sur LOGIN_HISTORY_MAX_ENTRIES_PER_USER)',
        )
    
    def handle(self, *args, **options):
        dry_run = options['dry_run']
        retention_days = options['retention_days'] or getattr(settings, 'LOGIN_HISTORY_RETENTION_DAYS', 90)
        max_entries = options['max_entries'] or getattr(settings, 'LOGIN_HISTORY_MAX_ENTRIES_PER_USER', None)
        
        total_deleted = 0
        
        # Nettoyage basé sur l'âge (rétention)
        if retention_days > 0:
            cutoff_date = timezone.now() - timedelta(days=retention_days)
            old_entries = LoginHistory.objects.filter(date__lt=cutoff_date)
            old_count = old_entries.count()
            
            if old_count > 0:
                self.stdout.write(
                    self.style.WARNING(
                        f'Suppression de {old_count} entrée(s) plus anciennes que {retention_days} jours (avant le {cutoff_date.strftime("%Y-%m-%d %H:%M:%S")})'
                    )
                )
                if not dry_run:
                    deleted, _ = old_entries.delete()
                    total_deleted += deleted
                    self.stdout.write(
                        self.style.SUCCESS(f'✓ {deleted} entrée(s) supprimée(s) (rétention)')
                    )
                else:
                    self.stdout.write(self.style.WARNING(f'[DRY RUN] {old_count} entrée(s) seraient supprimées (rétention)'))
                    total_deleted += old_count
            else:
                self.stdout.write(
                    self.style.SUCCESS(f'✓ Aucune entrée plus ancienne que {retention_days} jours')
                )
        
        # Nettoyage basé sur le nombre maximum d'entrées par utilisateur
        if max_entries is not None and max_entries > 0:
            self.stdout.write(
                self.style.WARNING(f'Limitation à {max_entries} entrée(s) par utilisateur...')
            )
            
            users_with_excess = []
            for user in User.objects.all():
                user_history = LoginHistory.objects.filter(user=user).order_by('-date')
                total_count = user_history.count()
                
                if total_count > max_entries:
                    excess_count = total_count - max_entries
                    excess_entries = user_history[max_entries:]
                    users_with_excess.append((user, excess_count, excess_entries))
            
            if users_with_excess:
                total_excess = sum(count for _, count, _ in users_with_excess)
                self.stdout.write(
                    self.style.WARNING(
                        f'{len(users_with_excess)} utilisateur(s) avec des entrées excédentaires (total: {total_excess} entrée(s))'
                    )
                )
                
                if not dry_run:
                    for user, count, entries in users_with_excess:
                        deleted, _ = entries.delete()
                        total_deleted += deleted
                        self.stdout.write(
                            self.style.SUCCESS(
                                f'✓ {deleted} entrée(s) supprimée(s) pour {user.email}'
                            )
                        )
                else:
                    for user, count, entries in users_with_excess:
                        self.stdout.write(
                            self.style.WARNING(
                                f'[DRY RUN] {count} entrée(s) seraient supprimées pour {user.email}'
                            )
                        )
                    total_deleted += total_excess
            else:
                self.stdout.write(
                    self.style.SUCCESS(f'✓ Aucun utilisateur avec des entrées excédentaires')
                )
        
        # Résumé
        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f'\n[DRY RUN] Au total, {total_deleted} entrée(s) seraient supprimées. Relancez sans --dry-run pour effectuer la suppression.'
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(f'\n✓ Nettoyage terminé : {total_deleted} entrée(s) supprimée(s)')
            )
            
        # Afficher les statistiques actuelles
        total_remaining = LoginHistory.objects.count()
        self.stdout.write(f'\nStatistiques après nettoyage :')
        self.stdout.write(f'  - Total d\'entrées restantes : {total_remaining}')
        if total_remaining > 0:
            oldest_entry = LoginHistory.objects.order_by('date').first()
            newest_entry = LoginHistory.objects.order_by('-date').first()
            if oldest_entry and newest_entry:
                self.stdout.write(f'  - Plus ancienne entrée : {oldest_entry.date.strftime("%Y-%m-%d %H:%M:%S")}')
                self.stdout.write(f'  - Plus récente entrée : {newest_entry.date.strftime("%Y-%m-%d %H:%M:%S")}')

