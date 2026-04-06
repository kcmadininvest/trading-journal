"""
Commande Django pour restaurer le PnL depuis les données raw_data du CSV.

Cette commande restaure les valeurs PnL originales du CSV qui ont été modifiées
par erreur lors du recalcul.

Usage:
    python manage.py restore_pnl_from_csv
    python manage.py restore_pnl_from_csv --dry-run
"""
from django.core.management.base import BaseCommand
from trades.models import TopStepTrade
from decimal import Decimal


class Command(BaseCommand):
    help = 'Restaure le PnL depuis les données raw_data du CSV'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Affiche les changements sans les appliquer',
        )
    
    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        
        if dry_run:
            self.stdout.write(self.style.WARNING('MODE DRY-RUN: Aucune modification ne sera appliquée'))
        
        # Récupérer tous les trades qui ont des raw_data
        trades = TopStepTrade.objects.exclude(raw_data__isnull=True)
        total_trades = trades.count()
        
        self.stdout.write(f'Nombre total de trades à traiter: {total_trades}')
        
        updated_count = 0
        error_count = 0
        
        for trade in trades:
            try:
                if not trade.raw_data or 'PnL' not in trade.raw_data:
                    continue
                
                # Récupérer le PnL original du CSV
                csv_pnl = Decimal(str(trade.raw_data.get('PnL')))
                csv_fees = Decimal(str(trade.raw_data.get('Fees', '0')))
                
                # Calculer le Net PnL attendu
                expected_net_pnl = csv_pnl - csv_fees - trade.commissions
                
                # Sauvegarder les anciennes valeurs
                old_pnl = trade.pnl
                old_net_pnl = trade.net_pnl
                
                # Vérifier si les valeurs ont changé
                if old_pnl != csv_pnl or abs(old_net_pnl - expected_net_pnl) > Decimal('0.01'):
                    updated_count += 1
                    
                    if not dry_run:
                        # Restaurer les valeurs du CSV
                        trade.pnl = csv_pnl
                        trade.net_pnl = expected_net_pnl
                        
                        # Recalculer le pourcentage
                        if trade.entry_price and trade.size:
                            investment = trade.entry_price * trade.size
                            if investment > 0:
                                trade.pnl_percentage = (trade.net_pnl / investment) * Decimal('100')
                        
                        # Sauvegarder sans déclencher le recalcul automatique
                        TopStepTrade.objects.filter(pk=trade.pk).update(
                            pnl=trade.pnl,
                            net_pnl=trade.net_pnl,
                            pnl_percentage=trade.pnl_percentage
                        )
                    
                    self.stdout.write(
                        f'Trade {trade.id}: PnL {old_pnl} -> {csv_pnl}, '
                        f'Net PnL {old_net_pnl} -> {expected_net_pnl}'
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
        self.stdout.write(f'Trades restaurés: {updated_count}')
        self.stdout.write(f'Trades inchangés: {total_trades - updated_count - error_count}')
        if error_count > 0:
            self.stdout.write(self.style.ERROR(f'Erreurs: {error_count}'))
        
        if dry_run:
            self.stdout.write(self.style.WARNING('MODE DRY-RUN: Aucune modification appliquée'))
        else:
            self.stdout.write(self.style.SUCCESS('Restauration terminée avec succès!'))
