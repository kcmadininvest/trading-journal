"""
Commande Django pour recalculer les Risk/Reward Ratios (R:R) réels et prévus.

Cette commande recalcule les R:R réels et prévus pour tous les trades en utilisant
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
    help = 'Recalcule les Risk/Reward Ratios réels et prévus pour corriger les valeurs négatives'
    
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
        
        # Construire le queryset de base pour les R:R réels
        trades_manager = getattr(TopStepTrade, 'objects')
        queryset_real: QuerySet[TopStepTrade] = trades_manager.filter(
            entry_price__isnull=False,
            exit_price__isnull=False,
            planned_stop_loss__isnull=False,
            trade_type__isnull=False
        )
        
        # Construire le queryset pour les R:R prévus
        queryset_planned: QuerySet[TopStepTrade] = trades_manager.filter(
            entry_price__isnull=False,
            planned_stop_loss__isnull=False,
            planned_take_profit__isnull=False,
            trade_type__isnull=False
        )
        
        if user_id:
            queryset_real = queryset_real.filter(user_id=user_id)
            queryset_planned = queryset_planned.filter(user_id=user_id)
            self.stdout.write(f'Filtrage par utilisateur ID: {user_id}')
        
        # Combiner les deux querysets (union)
        all_trade_ids = set(queryset_real.values_list('id', flat=True)) | set(queryset_planned.values_list('id', flat=True))
        queryset: QuerySet[TopStepTrade] = trades_manager.filter(id__in=all_trade_ids)
        
        total_trades = queryset.count()
        self.stdout.write(f'\nTraitement de {total_trades} trade(s)...\n')
        
        trades_to_update = []
        trades_with_negative_rr = 0
        trades_with_negative_planned_rr = 0
        trades_recalculated = 0
        
        for trade in queryset.select_related('user'):
            old_actual_rr = trade.actual_risk_reward_ratio
            old_planned_rr = trade.planned_risk_reward_ratio
            was_negative_actual = old_actual_rr is not None and old_actual_rr < 0
            was_negative_planned = old_planned_rr is not None and old_planned_rr < 0
            
            # Calculer les nouveaux R:R avec la nouvelle logique pour vérifier s'il y a des changements
            needs_update = False
            new_actual_rr = None
            new_planned_rr = None
            
            # Calculer le nouveau R:R réel si exit_price est disponible
            if trade.exit_price and trade.planned_stop_loss:
                risk = Decimal('0')
                reward = Decimal('0')
                
                if trade.trade_type == 'Long':
                    risk = trade.entry_price - trade.planned_stop_loss
                    reward = trade.exit_price - trade.entry_price
                else:  # Short
                    risk = trade.planned_stop_loss - trade.entry_price
                    reward = trade.entry_price - trade.exit_price
                
                if risk > 0:
                    new_actual_rr = abs(reward) / risk
                    # Comparer avec une tolérance pour les arrondis
                    if old_actual_rr is None or abs(float(old_actual_rr) - float(new_actual_rr)) > 0.0001:
                        needs_update = True
                        if was_negative_actual:
                            trades_with_negative_rr += 1
            
            # Calculer le nouveau R:R prévu si planned_take_profit est disponible
            if trade.planned_take_profit and trade.planned_stop_loss:
                planned_risk = Decimal('0')
                planned_reward = Decimal('0')
                
                if trade.trade_type == 'Long':
                    planned_risk = trade.entry_price - trade.planned_stop_loss
                    planned_reward = trade.planned_take_profit - trade.entry_price
                else:  # Short
                    planned_risk = trade.planned_stop_loss - trade.entry_price
                    planned_reward = trade.entry_price - trade.planned_take_profit
                
                if planned_risk > 0:
                    new_planned_rr = abs(planned_reward) / planned_risk
                    # Comparer avec une tolérance pour les arrondis
                    if old_planned_rr is None or abs(float(old_planned_rr) - float(new_planned_rr)) > 0.0001:
                        needs_update = True
                        if was_negative_planned:
                            trades_with_negative_planned_rr += 1
            
            if needs_update:
                trades_to_update.append({
                    'trade': trade,
                    'old_actual_rr': old_actual_rr,
                    'new_actual_rr': new_actual_rr,
                    'old_planned_rr': old_planned_rr,
                    'new_planned_rr': new_planned_rr,
                    'was_negative_actual': was_negative_actual,
                    'was_negative_planned': was_negative_planned
                })
                trades_recalculated += 1
        
        if not trades_to_update:
            self.stdout.write(self.style.SUCCESS('✓ Aucun trade à mettre à jour'))
            return
        
        self.stdout.write(f'\n{len(trades_to_update)} trade(s) à mettre à jour:')
        self.stdout.write(f'  - {trades_with_negative_rr} trade(s) avec R:R réel négatif')
        self.stdout.write(f'  - {trades_with_negative_planned_rr} trade(s) avec R:R prévu négatif')
        self.stdout.write(f'  - {trades_recalculated} trade(s) à recalculer\n')
        
        if dry_run:
            # Afficher quelques exemples
            for i, item in enumerate(trades_to_update[:10]):
                trade = item['trade']
                old_actual_rr = item['old_actual_rr']
                new_actual_rr = item['new_actual_rr']
                old_planned_rr = item['old_planned_rr']
                new_planned_rr = item['new_planned_rr']
                was_negative_actual = item['was_negative_actual']
                was_negative_planned = item['was_negative_planned']
                
                status = '⚠️  NÉGATIF' if (was_negative_actual or was_negative_planned) else 'ℹ️  '
                changes = []
                if old_actual_rr != new_actual_rr:
                    changes.append(f'R:R réel: {old_actual_rr} → {new_actual_rr:.4f}' if new_actual_rr else f'R:R réel: {old_actual_rr} → None')
                if old_planned_rr != new_planned_rr:
                    changes.append(f'R:R prévu: {old_planned_rr} → {new_planned_rr:.4f}' if new_planned_rr else f'R:R prévu: {old_planned_rr} → None')
                
                self.stdout.write(
                    f'{status} Trade #{trade.id} (User: {trade.user.username}): {", ".join(changes)}'
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
                        f'  ✓ {trades_with_negative_rr} trade(s) avec R:R réel négatif corrigé(s)'
                    )
                )
            if trades_with_negative_planned_rr > 0:
                self.stdout.write(
                    self.style.SUCCESS(
                        f'  ✓ {trades_with_negative_planned_rr} trade(s) avec R:R prévu négatif corrigé(s)'
                    )
                )

