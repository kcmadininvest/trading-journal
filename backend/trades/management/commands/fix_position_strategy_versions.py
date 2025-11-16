"""
Commande Django pour corriger les numéros de version des stratégies de position.

Cette commande corrige les numéros de version en double en réassignant
les numéros de version de manière séquentielle pour chaque groupe de stratégies
(parent + versions enfants).

Usage:
    python manage.py fix_position_strategy_versions
    python manage.py fix_position_strategy_versions --dry-run
    python manage.py fix_position_strategy_versions --user-id 27
"""
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Max, Q
from trades.models import PositionStrategy
from collections import defaultdict


class Command(BaseCommand):
    help = 'Corrige les numéros de version en double pour les stratégies de position'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Affiche les corrections qui seraient effectuées sans les appliquer'
        )
        parser.add_argument(
            '--user-id',
            type=int,
            help='Corriger uniquement les stratégies d\'un utilisateur spécifique'
        )
        parser.add_argument(
            '--strategy-id',
            type=int,
            help='Corriger uniquement une stratégie spécifique et ses versions'
        )
    
    def handle(self, *args, **options):
        dry_run = options['dry_run']
        user_id = options.get('user_id')
        strategy_id = options.get('strategy_id')
        
        if dry_run:
            self.stdout.write(self.style.WARNING('Mode DRY-RUN : aucune modification ne sera effectuée'))
        
        # Construire le queryset de base
        queryset = PositionStrategy.objects.all()
        
        if user_id:
            queryset = queryset.filter(user_id=user_id)
            self.stdout.write(f'Filtrage par utilisateur ID: {user_id}')
        
        if strategy_id:
            strategy = PositionStrategy.objects.filter(id=strategy_id).first()
            if not strategy:
                raise CommandError(f'Stratégie avec ID {strategy_id} introuvable')
            
            # Récupérer toutes les stratégies du même groupe (parent + versions)
            parent = strategy.parent_strategy or strategy
            strategy_ids = [parent.id] + list(
                PositionStrategy.objects.filter(parent_strategy=parent).values_list('id', flat=True)
            )
            queryset = queryset.filter(id__in=strategy_ids)
            self.stdout.write(f'Filtrage par stratégie ID: {strategy_id}')
        
        # Grouper les stratégies par parent (ou par elles-mêmes si elles sont parents)
        strategy_groups = defaultdict(list)
        
        for strategy in queryset.select_related('parent_strategy', 'user'):
            # Identifier le groupe : utiliser parent_strategy si existe, sinon l'ID de la stratégie elle-même
            group_id = strategy.parent_strategy_id if strategy.parent_strategy_id else strategy.id
            strategy_groups[group_id].append(strategy)
        
        total_corrected = 0
        total_groups = len(strategy_groups)
        
        self.stdout.write(f'\nTraitement de {total_groups} groupe(s) de stratégies...\n')
        
        with transaction.atomic():
            for group_id, strategies in strategy_groups.items():
                # Trier les stratégies par date de création pour maintenir l'ordre chronologique
                strategies.sort(key=lambda s: s.created_at)
                
                # Identifier la stratégie parente (celle sans parent_strategy ou la plus ancienne)
                parent_strategy = None
                child_strategies = []
                
                for strategy in strategies:
                    if not strategy.parent_strategy_id:
                        parent_strategy = strategy
                    else:
                        child_strategies.append(strategy)
                
                # Si pas de parent trouvé, utiliser la première comme parent
                if not parent_strategy:
                    parent_strategy = strategies[0]
                    child_strategies = strategies[1:]
                
                # Vérifier s'il y a des doublons
                versions = [s.version for s in strategies]
                has_duplicates = len(versions) != len(set(versions))
                
                if not has_duplicates:
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'✓ Groupe {group_id} ({parent_strategy.title}): '
                            f'Pas de doublons détectés'
                        )
                    )
                    continue
                
                # Afficher l'état actuel
                self.stdout.write(
                    f'\nGroupe {group_id}: {parent_strategy.title}'
                )
                self.stdout.write(f'  Versions actuelles: {sorted(versions)}')
                
                # Réassigner les numéros de version de manière séquentielle
                # La stratégie parente garde la version 1, les autres sont numérotées séquentiellement
                corrections = []
                
                # Version 1 pour le parent
                if parent_strategy.version != 1:
                    corrections.append((parent_strategy, 1))
                
                # Versions suivantes pour les enfants (triés par date de création)
                version_num = 2
                for child in sorted(child_strategies, key=lambda s: s.created_at):
                    if child.version != version_num:
                        corrections.append((child, version_num))
                    version_num += 1
                
                if corrections:
                    self.stdout.write(f'  Corrections à effectuer:')
                    for strategy, new_version in corrections:
                        self.stdout.write(
                            f'    - ID {strategy.id} ({strategy.title}): '
                            f'v{strategy.version} → v{new_version}'
                        )
                    
                    if not dry_run:
                        # Approche en deux passes pour éviter les conflits de contrainte unique
                        # Pass 1: Mettre toutes les versions à des valeurs temporaires très élevées
                        temp_version = 999999
                        for strategy, new_version in corrections:
                            strategy.version = temp_version
                            strategy.save(update_fields=['version'])
                            temp_version -= 1
                        
                        # Pass 2: Réassigner les bonnes versions
                        for strategy, new_version in corrections:
                            strategy.version = new_version
                            strategy.save(update_fields=['version'])
                        
                        self.stdout.write(
                            self.style.SUCCESS(f'  ✓ {len(corrections)} version(s) corrigée(s)')
                        )
                    else:
                        self.stdout.write(
                            self.style.WARNING(f'  [DRY-RUN] {len(corrections)} version(s) seraient corrigée(s)')
                        )
                    
                    total_corrected += len(corrections)
                else:
                    self.stdout.write(
                        self.style.SUCCESS('  ✓ Aucune correction nécessaire')
                    )
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f'\n[DRY-RUN] {total_corrected} version(s) seraient corrigée(s) dans {total_groups} groupe(s)'
                )
            )
            self.stdout.write(self.style.WARNING('Exécutez sans --dry-run pour appliquer les corrections'))
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f'\n✓ Correction terminée: {total_corrected} version(s) corrigée(s) dans {total_groups} groupe(s)'
                )
            )

