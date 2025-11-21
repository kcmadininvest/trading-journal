"""
Commande Django pour recalculer les Risk/Reward Ratios (R:R) réels.

Cette commande recalcule les R:R réels pour tous les trades en utilisant
la valeur absolue du reward, évitant ainsi les R:R négatifs qui faussent
les statistiques.

Usage:
    python manage.py recalculate_rr
    python manage.py recalculate_rr --dry-run
    python manage.py recalculate_rr --user-id 27
"""
from typing import Protocol, cast, ContextManager
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import QuerySet
from decimal import Decimal
from trades.models import TopStepTrade


class StyleProtocol(Protocol):
    """Protocol pour typer les méthodes de style de Django BaseCommand."""
    def WARNING(self, text: str) -> str: ...
    def SUCCESS(self, text: str) -> str: ...
    def ERROR(self, text: str) -> str: ...


class Command(BaseCommand):
    help = 'Recalcule les Risk/Reward Ratios réels pour corriger les valeurs négatives'
    
    def __init__(self, *args, **kwargs):
        """Initialise la commande et type correctement self.style."""
        super().__init__(*args, **kwargs)
        # Type le style pour le linter
        self.style: StyleProtocol = cast(StyleProtocol, self.style)  # type: ignore[assignment]
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Affiche les corrections qui seraient effectuées sans les appliquer'
        )
        parser.add_argument(
            '--user-id',
            type=int,
            help='Recalculer uniquement les trades d\'un utilisateur spécifique'
        )
    
    def handle(self, *args, **options):
        dry_run = options['dry_run']
        user_id = options.get('user_id')
        
        if dry_run:
            self.stdout.write(self.style.WARNING('Mode DRY-RUN : aucune modification ne sera effectuée'))
        
        # Construire le queryset de base
        trades_manager = getattr(TopStepTrade, 'objects')
        queryset: QuerySet[TopStepTrade] = trades_manager.filter(
            entry_price__isnull=False,
            exit_price__isnull=False,
            planned_stop_loss__isnull=False,
            trade_type__isnull=False
        )
        
        if user_id:
            queryset = queryset.filter(user_id=user_id)
            self.stdout.write(f'Filtrage par utilisateur ID: {user_id}')
        
        total_trades = queryset.count()
        self.stdout.write(f'\nTraitement de {total_trades} trade(s)...\n')
        
        trades_to_update = []
        trades_with_negative_rr = 0
        trades_recalculated = 0
        
        for trade in queryset.select_related('user'):
            # Calculer le nouveau R:R réel
            risk = Decimal('0')
            reward = Decimal('0')
            
            if trade.trade_type == 'Long':
                # Long: risk = entry - stop_loss, reward = exit - entry
                risk = trade.entry_price - trade.planned_stop_loss
                reward = trade.exit_price - trade.entry_price
            else:  # Short
                # Short: risk = stop_loss - entry, reward = entry - exit
                risk = trade.planned_stop_loss - trade.entry_price
                reward = trade.entry_price - trade.exit_price
            
            if risk > 0:
                # Nouveau R:R avec valeur absolue du reward
                new_rr = abs(reward) / risk
                
                # Vérifier si le R:R actuel est différent (négatif ou différent)
                current_rr = trade.actual_risk_reward_ratio
                
                if current_rr is None or current_rr != new_rr:
                    # Vérifier si l'ancien R:R était négatif
                    was_negative = current_rr is not None and current_rr < 0
                    
                    if was_negative:
                        trades_with_negative_rr += 1
                    
                    trades_to_update.append({
                        'trade': trade,
                        'old_rr': current_rr,
                        'new_rr': new_rr,
                        'was_negative': was_negative
                    })
                    trades_recalculated += 1
        
        if not trades_to_update:
            self.stdout.write(self.style.SUCCESS('✓ Aucun trade à mettre à jour'))
            return
        
        self.stdout.write(f'\n{len(trades_to_update)} trade(s) à mettre à jour:')
        self.stdout.write(f'  - {trades_with_negative_rr} trade(s) avec R:R négatif')
        self.stdout.write(f'  - {trades_recalculated} trade(s) à recalculer\n')
        
        if dry_run:
            # Afficher quelques exemples
            for i, item in enumerate(trades_to_update[:10]):
                trade = item['trade']
                old_rr = item['old_rr']
                new_rr = item['new_rr']
                was_negative = item['was_negative']
                
                status = '⚠️  NÉGATIF' if was_negative else 'ℹ️  '
                self.stdout.write(
                    f'{status} Trade #{trade.id} (User: {trade.user.username}): '
                    f'R:R {old_rr} → {new_rr:.2f}'
                )
            
            if len(trades_to_update) > 10:
                self.stdout.write(f'  ... et {len(trades_to_update) - 10} autre(s) trade(s)')
            
            self.stdout.write(
                self.style.WARNING(
                    f'\n[DRY-RUN] {len(trades_to_update)} trade(s) seraient mis à jour'
                )
            )
            self.stdout.write(self.style.WARNING('Exécutez sans --dry-run pour appliquer les corrections'))
        else:
            # Appliquer les corrections
            updated_count = 0
            atomic_context: ContextManager[None] = cast(ContextManager[None], transaction.atomic())
            with atomic_context:
                for item in trades_to_update:
                    trade = item['trade']
                    new_rr = item['new_rr']
                    
                    # Recalculer en appelant save() pour utiliser la logique du modèle
                    # Cela garantit que tous les autres calculs (PnL, etc.) sont aussi à jour
                    trade.save()
                    updated_count += 1
                    
                    if updated_count % 100 == 0:
                        self.stdout.write(f'  Traité {updated_count}/{len(trades_to_update)} trades...')
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'\n✓ Correction terminée: {updated_count} trade(s) mis à jour'
                )
            )
            if trades_with_negative_rr > 0:
                self.stdout.write(
                    self.style.SUCCESS(
                        f'  ✓ {trades_with_negative_rr} trade(s) avec R:R négatif corrigé(s)'
                    )
                )

