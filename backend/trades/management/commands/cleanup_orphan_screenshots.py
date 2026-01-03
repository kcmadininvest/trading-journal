"""
Commande de gestion Django pour nettoyer les fichiers screenshots orphelins.
Un fichier est considéré comme orphelin s'il existe sur le disque mais n'est
référencé dans aucune TradeStrategy ou DayStrategyCompliance.

Usage:
    python manage.py cleanup_orphan_screenshots [--dry-run] [--user-id USER_ID]
"""

from django.core.management.base import BaseCommand
from django.conf import settings
from trades.models import TradeStrategy, DayStrategyCompliance
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Nettoie les fichiers screenshots orphelins (non référencés en base de données)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Affiche les fichiers qui seraient supprimés sans les supprimer réellement',
        )
        parser.add_argument(
            '--user-id',
            type=int,
            help='Nettoie uniquement les fichiers d\'un utilisateur spécifique',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        user_id = options.get('user_id')
        
        self.stdout.write(self.style.SUCCESS('=' * 70))
        self.stdout.write(self.style.SUCCESS('Nettoyage des screenshots orphelins'))
        self.stdout.write(self.style.SUCCESS('=' * 70))
        
        if dry_run:
            self.stdout.write(self.style.WARNING('Mode DRY-RUN : Aucun fichier ne sera supprimé'))
        
        # Récupérer tous les screenshots référencés en base de données
        self.stdout.write('\n📊 Récupération des screenshots référencés en base de données...')
        
        trade_screenshots = set(
            TradeStrategy.objects
            .exclude(screenshot_url='')
            .values_list('screenshot_url', flat=True)
        )
        
        day_screenshots = set(
            DayStrategyCompliance.objects
            .exclude(screenshot_url='')
            .values_list('screenshot_url', flat=True)
        )
        
        referenced_urls = trade_screenshots | day_screenshots
        
        # Extraire les chemins relatifs (sans /media/)
        referenced_paths = set()
        for url in referenced_urls:
            if url.startswith('/media/'):
                path = url[7:]  # Enlever '/media/'
                referenced_paths.add(path)
                # Ajouter aussi le chemin de la miniature
                if path.endswith('.webp'):
                    thumbnail_path = path.replace('.webp', '_thumb.webp')
                    referenced_paths.add(thumbnail_path)
        
        self.stdout.write(f'✅ {len(referenced_paths)} fichiers référencés en base de données')
        
        # Scanner le dossier screenshots
        screenshots_dir = Path(settings.MEDIA_ROOT) / 'screenshots'
        
        if not screenshots_dir.exists():
            self.stdout.write(self.style.WARNING(f'\n⚠️  Le dossier {screenshots_dir} n\'existe pas'))
            return
        
        self.stdout.write(f'\n🔍 Scan du dossier : {screenshots_dir}')
        
        # Si user_id est spécifié, scanner uniquement ce dossier
        if user_id:
            user_dir = screenshots_dir / str(user_id)
            if not user_dir.exists():
                self.stdout.write(self.style.WARNING(f'\n⚠️  Le dossier utilisateur {user_dir} n\'existe pas'))
                return
            scan_dirs = [user_dir]
            self.stdout.write(f'   Filtrage par utilisateur : {user_id}')
        else:
            scan_dirs = [screenshots_dir]
        
        # Compter les fichiers
        orphan_files = []
        total_size = 0
        
        for scan_dir in scan_dirs:
            for file_path in scan_dir.rglob('*.webp'):
                # Calculer le chemin relatif depuis MEDIA_ROOT
                relative_path = str(file_path.relative_to(settings.MEDIA_ROOT))
                
                # Vérifier si le fichier est référencé
                if relative_path not in referenced_paths:
                    orphan_files.append(file_path)
                    total_size += file_path.stat().st_size
        
        # Afficher les résultats
        self.stdout.write('\n' + '=' * 70)
        self.stdout.write(f'📈 Résultats du scan :')
        self.stdout.write(f'   Fichiers orphelins trouvés : {len(orphan_files)}')
        self.stdout.write(f'   Espace disque récupérable : {total_size / (1024 * 1024):.2f} MB')
        self.stdout.write('=' * 70)
        
        if not orphan_files:
            self.stdout.write(self.style.SUCCESS('\n✅ Aucun fichier orphelin trouvé !'))
            return
        
        # Afficher la liste des fichiers (limité aux 20 premiers)
        self.stdout.write('\n📋 Fichiers orphelins :')
        for i, file_path in enumerate(orphan_files[:20], 1):
            size_kb = file_path.stat().st_size / 1024
            self.stdout.write(f'   {i}. {file_path.name} ({size_kb:.1f} KB)')
        
        if len(orphan_files) > 20:
            self.stdout.write(f'   ... et {len(orphan_files) - 20} autres fichiers')
        
        # Supprimer les fichiers si pas en mode dry-run
        if not dry_run:
            self.stdout.write('\n🗑️  Suppression des fichiers orphelins...')
            deleted_count = 0
            
            for file_path in orphan_files:
                try:
                    file_path.unlink()
                    deleted_count += 1
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f'   ❌ Erreur lors de la suppression de {file_path.name}: {e}')
                    )
            
            self.stdout.write(self.style.SUCCESS(f'\n✅ {deleted_count} fichiers supprimés avec succès !'))
            self.stdout.write(self.style.SUCCESS(f'💾 Espace disque récupéré : {total_size / (1024 * 1024):.2f} MB'))
        else:
            self.stdout.write(self.style.WARNING('\n⚠️  Mode DRY-RUN : Aucun fichier n\'a été supprimé'))
            self.stdout.write(self.style.WARNING('   Exécutez sans --dry-run pour supprimer réellement les fichiers'))
        
        self.stdout.write('\n' + '=' * 70)
        self.stdout.write(self.style.SUCCESS('✅ Nettoyage terminé !'))
        self.stdout.write('=' * 70)

