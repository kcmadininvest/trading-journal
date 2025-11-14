from django.core.management.base import BaseCommand
from trades.models import TradingAccount
from trades.services import AccountMetricsCalculator


class Command(BaseCommand):
    help = 'Recalcule le Maximum Loss Limit (MLL) pour tous les comptes de trading'

    def add_arguments(self, parser):
        parser.add_argument(
            '--account-id',
            type=int,
            help='ID d\'un compte spécifique à recalculer (optionnel)',
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Recalculer pour tous les comptes avec MLL activé',
        )

    def handle(self, *args, **options):
        calculator = AccountMetricsCalculator()
        
        if options['account_id']:
            # Recalculer pour un compte spécifique
            try:
                account = TradingAccount.objects.get(pk=options['account_id'])
                if not account.mll_enabled:
                    self.stdout.write(
                        self.style.WARNING(
                            f'Le MLL est désactivé pour le compte "{account.name}" (ID: {account.id})'
                        )
                    )
                    return
                
                self.stdout.write(f'Recalcul du MLL pour le compte "{account.name}" (ID: {account.id})...')
                count = calculator.recalculate_all_metrics(account)
                self.stdout.write(
                    self.style.SUCCESS(
                        f'✓ {count} métriques recalculées pour le compte "{account.name}"'
                    )
                )
            except TradingAccount.DoesNotExist:
                self.stdout.write(
                    self.style.ERROR(f'Compte avec ID {options["account_id"]} introuvable')
                )
        elif options['all']:
            # Recalculer pour tous les comptes avec MLL activé
            accounts = TradingAccount.objects.filter(mll_enabled=True)
            total_accounts = accounts.count()
            
            if total_accounts == 0:
                self.stdout.write(
                    self.style.WARNING('Aucun compte avec MLL activé trouvé')
                )
                return
            
            self.stdout.write(f'Recalcul du MLL pour {total_accounts} compte(s)...')
            self.stdout.write('')
            
            total_metrics = 0
            for account in accounts:
                self.stdout.write(f'  - Compte "{account.name}" (ID: {account.id})...', ending=' ')
                try:
                    count = calculator.recalculate_all_metrics(account)
                    total_metrics += count
                    self.stdout.write(self.style.SUCCESS(f'✓ {count} métriques'))
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f'✗ Erreur: {str(e)}'))
            
            self.stdout.write('')
            self.stdout.write(
                self.style.SUCCESS(
                    f'✓ Recalcul terminé: {total_metrics} métriques recalculées pour {total_accounts} compte(s)'
                )
            )
        else:
            self.stdout.write(
                self.style.ERROR(
                    'Veuillez spécifier --account-id=<id> ou --all pour recalculer les métriques'
                )
            )

