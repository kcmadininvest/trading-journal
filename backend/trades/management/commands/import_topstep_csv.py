"""
Commande Django pour importer un fichier CSV TopStep.

Usage:
    python manage.py import_topstep_csv <username> <csv_file_path>
    python manage.py import_topstep_csv john /path/to/topstep_trades.csv
"""
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.models import User
from trades.utils import TopStepCSVImporter
import os


class Command(BaseCommand):
    help = 'Importe les trades depuis un fichier CSV TopStep'
    
    def add_arguments(self, parser):
        parser.add_argument(
            'username',
            type=str,
            help='Nom d\'utilisateur pour lequel importer les trades'
        )
        parser.add_argument(
            'csv_file',
            type=str,
            help='Chemin vers le fichier CSV TopStep'
        )
        parser.add_argument(
            '--skip-duplicates',
            action='store_true',
            help='Ignorer silencieusement les doublons'
        )
    
    def handle(self, *args, **options):
        username = options['username']
        csv_file = options['csv_file']
        
        # Vérifier que le fichier existe
        if not os.path.exists(csv_file):
            raise CommandError(f'Le fichier "{csv_file}" n\'existe pas')
        
        # Récupérer l'utilisateur
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            raise CommandError(f'L\'utilisateur "{username}" n\'existe pas')
        
        # Importer le fichier
        self.stdout.write(self.style.WARNING(f'Import des trades pour {username}...'))
        self.stdout.write(f'Fichier: {csv_file}')
        
        importer = TopStepCSVImporter(user)
        result = importer.import_from_file(csv_file, os.path.basename(csv_file))
        
        # Afficher les résultats
        if result['success']:
            self.stdout.write(self.style.SUCCESS('\n✓ Import terminé avec succès!'))
            self.stdout.write(f'  Total de lignes: {result["total_rows"]}')
            self.stdout.write(self.style.SUCCESS(f'  ✓ Importés: {result["success_count"]}'))
            
            if result['skipped_count'] > 0:
                self.stdout.write(self.style.WARNING(f'  ⊘ Ignorés (doublons): {result["skipped_count"]}'))
            
            if result['error_count'] > 0:
                self.stdout.write(self.style.ERROR(f'  ✗ Erreurs: {result["error_count"]}'))
                self.stdout.write('\nDétails des erreurs:')
                for error in result['errors'][:10]:  # Afficher max 10 erreurs
                    self.stdout.write(self.style.ERROR(
                        f'  Ligne {error["row"]}: {error["error"]}'
                    ))
                if len(result['errors']) > 10:
                    self.stdout.write(
                        f'  ... et {len(result["errors"]) - 10} autres erreurs'
                    )
        else:
            self.stdout.write(self.style.ERROR(f'\n✗ Erreur: {result["error"]}'))
            raise CommandError('Import échoué')


