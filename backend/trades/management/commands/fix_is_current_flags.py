"""
Commande Django pour corriger les flags is_current des stratégies de position.

Cette commande s'assure qu'une seule version par groupe de stratégies
(parent + versions enfants) a is_current=True.

Usage:
    python manage.py fix_is_current_flags
    python manage.py fix_is_current_flags --dry-run
    python manage.py fix_is_current_flags --user-id 27
"""
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q
from trades.models import PositionStrategy


class Command(BaseCommand):
    help = 'Corrige les flags is_current pour s\'assurer qu\'une seule version est actuelle par groupe'
    
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
    
    def handle(self, *args, **options):
        dry_run = options['dry_run']
        user_id = options.get('user_id')
        
        if dry_run:
            self.stdout.write(self.style.WARNING('Mode DRY-RUN : aucune modification ne sera effectuée'))
        
        # Construire le queryset de base
        queryset = PositionStrategy.objects.all()
        
        if user_id:
            queryset = queryset.filter(user_id=user_id)
            self.stdout.write(f'Filtrage par utilisateur ID: {user_id}')
        
        # Grouper les stratégies par parent (ou par elles-mêmes si elles sont parents)
        strategy_groups = {}
        
        for strategy in queryset.select_related('parent_strategy', 'user'):
            # Identifier le groupe : utiliser parent_strategy si existe, sinon l'ID de la stratégie elle-même
            group_id = strategy.parent_strategy_id if strategy.parent_strategy_id else strategy.id
            
            if group_id not in strategy_groups:
                strategy_groups[group_id] = []
            strategy_groups[group_id].append(strategy)
        
        total_corrected = 0
        total_groups = len(strategy_groups)
        
        self.stdout.write(f'\nTraitement de {total_groups} groupe(s) de stratégies...\n')
        
        with transaction.atomic():
            for group_id, strategies in strategy_groups.items():
                # Identifier la stratégie parente
                parent_strategy = None
                for strategy in strategies:
                    if not strategy.parent_strategy_id:
                        parent_strategy = strategy
                        break
                
                if not parent_strategy:
                    parent_strategy = strategies[0]
                
                # Compter combien de versions ont is_current=True
                current_versions = [s for s in strategies if s.is_current]
                
                if len(current_versions) == 0:
                    # Aucune version actuelle, marquer la dernière version comme actuelle
                    latest = max(strategies, key=lambda s: s.version)
                    if not dry_run:
                        PositionStrategy.objects.filter(  # type: ignore
                            Q(id=parent_strategy.id) | Q(parent_strategy=parent_strategy),
                            user=parent_strategy.user
                        ).update(is_current=False)
                        latest.is_current = True
                        latest.save(update_fields=['is_current'])
                    self.stdout.write(
                        self.style.WARNING(
                            f'Groupe {group_id} ({parent_strategy.title}): '
                            f'Aucune version actuelle, marquage de la v{latest.version} comme actuelle'
                        )
                    )
                    total_corrected += 1
                elif len(current_versions) == 1:
                    # Parfait, une seule version actuelle
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'✓ Groupe {group_id} ({parent_strategy.title}): '
                            f'OK - v{current_versions[0].version} est actuelle'
                        )
                    )
                else:
                    # Plusieurs versions actuelles, garder seulement la plus récente
                    # Trier par version décroissante et garder la première
                    current_versions.sort(key=lambda s: s.version, reverse=True)
                    keep_current = current_versions[0]
                    to_fix = current_versions[1:]
                    
                    self.stdout.write(
                        f'\nGroupe {group_id}: {parent_strategy.title}'
                    )
                    self.stdout.write(
                        f'  ⚠️  {len(current_versions)} version(s) marquée(s) comme actuelle(s): '
                        f'{", ".join([f"v{v.version}" for v in current_versions])}'
                    )
                    self.stdout.write(
                        f'  → Conservation de v{keep_current.version} comme actuelle'
                    )
                    
                    if not dry_run:
                        # Mettre toutes les versions à False
                        PositionStrategy.objects.filter(  # type: ignore
                            Q(id=parent_strategy.id) | Q(parent_strategy=parent_strategy),
                            user=parent_strategy.user
                        ).update(is_current=False)
                        # Puis marquer la bonne version comme actuelle
                        keep_current.is_current = True
                        keep_current.save(update_fields=['is_current'])
                        self.stdout.write(
                            self.style.SUCCESS(f'  ✓ {len(to_fix)} version(s) corrigée(s)')
                        )
                    else:
                        self.stdout.write(
                            self.style.WARNING(f'  [DRY-RUN] {len(to_fix)} version(s) seraient corrigée(s)')
                        )
                    
                    total_corrected += len(to_fix)
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f'\n[DRY-RUN] {total_corrected} groupe(s) seraient corrigé(s)'
                )
            )
            self.stdout.write(self.style.WARNING('Exécutez sans --dry-run pour appliquer les corrections'))
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f'\n✓ Correction terminée: {total_corrected} groupe(s) corrigé(s)'
                )
            )

