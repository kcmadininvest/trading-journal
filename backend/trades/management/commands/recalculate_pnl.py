"""
Commande Django pour recalculer le PnL de tous les trades.

Cette commande recalcule le PnL, Net PnL et PnL percentage pour tous les trades
en utilisant la logique du modèle (qui prend en compte point_value correctement).

Usage:
    python manage.py recalculate_pnl
    python manage.py recalculate_pnl --account 16  # Pour un compte spécifique
    python manage.py recalculate_pnl --dry-run     # Pour voir les changements sans les appliquer
"""
from django.core.management.base import BaseCommand
from trades.models import TopStepTrade
from decimal import Decimal


class Command(BaseCommand):
    help = 'Recalcule le PnL de tous les trades en utilisant la logique du modèle'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--account',
            type=int,
            help='ID du compte de trading (optionnel, recalcule tous les comptes si non spécifié)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Affiche les changements sans les appliquer',
        )
    
    def handle(self, *args, **options):
        account_id = options.get('account')
        dry_run = options.get('dry_run', False)
        
        # Filtrer les trades
        trades = TopStepTrade.objects.all()
        if account_id:
            trades = trades.filter(trading_account_id=account_id)
            self.stdout.write(f'Recalcul du PnL pour le compte {account_id}...')
        else:
            self.stdout.write('Recalcul du PnL pour tous les trades...')
        
        if dry_run:
            self.stdout.write(self.style.WARNING('MODE DRY-RUN: Aucune modification ne sera appliquée'))
        
        total_trades = trades.count()
        self.stdout.write(f'Nombre total de trades à traiter: {total_trades}')
        
        updated_count = 0
        error_count = 0
        
        for trade in trades:
            try:
                # Sauvegarder les anciennes valeurs pour comparaison
                old_pnl = trade.pnl
                old_net_pnl = trade.net_pnl
                
                # Forcer le recalcul en mettant pnl à None temporairement
                # puis en appelant save() qui recalculera automatiquement
                if not dry_run:
                    trade.pnl = None
                    trade.save()
                    new_pnl = trade.pnl
                    new_net_pnl = trade.net_pnl
                else:
                    # En mode dry-run, calculer sans sauvegarder
                    if trade.entry_price and trade.exit_price and trade.size and trade.trade_type:
                        if trade.trade_type == 'Long':
                            price_diff = trade.exit_price - trade.entry_price
                        else:  # Short
                            price_diff = trade.entry_price - trade.exit_price
                        
                        if trade.point_value:
                            new_pnl = price_diff * trade.point_value * trade.size
                        else:
                            new_pnl = price_diff * trade.size
                        
                        new_net_pnl = new_pnl - trade.fees - trade.commissions
                    else:
                        new_pnl = old_pnl
                        new_net_pnl = old_net_pnl
                
                # Vérifier si le PnL a changé
                if old_pnl != new_pnl or old_net_pnl != new_net_pnl:
                    updated_count += 1
                    self.stdout.write(
                        f'Trade {trade.id} ({trade.contract_name}): '
                        f'PnL {old_pnl} -> {new_pnl}, '
                        f'Net PnL {old_net_pnl} -> {new_net_pnl}'
                    )
            
            except Exception as e:
                error_count += 1
                self.stdout.write(
                    self.style.ERROR(f'Erreur pour le trade {trade.id}: {str(e)}')
                )
        
        # Résumé
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=== RÉSUMÉ ==='))
        self.stdout.write(f'Total de trades traités: {total_trades}')
        self.stdout.write(f'Trades mis à jour: {updated_count}')
        self.stdout.write(f'Trades inchangés: {total_trades - updated_count - error_count}')
        if error_count > 0:
            self.stdout.write(self.style.ERROR(f'Erreurs: {error_count}'))
        
        if dry_run:
            self.stdout.write(self.style.WARNING('MODE DRY-RUN: Aucune modification appliquée'))
        else:
            self.stdout.write(self.style.SUCCESS('Recalcul terminé avec succès!'))
