from django.core.management.base import BaseCommand

from trades.services.trade_day_service import recalculate_trade_days_for_user


class Command(BaseCommand):
    help = (
        "Aligne trade_day sur la date d'entrée dans le fuseau de chaque utilisateur "
        '(puis recalcule rollups, métriques MLL et cache de statistiques)'
    )

    def add_arguments(self, parser):
        parser.add_argument('--user-id', type=int, help='ID utilisateur spécifique (optionnel)')
        parser.add_argument('--all', action='store_true', help='Tous les utilisateurs ayant des trades')
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help="Compter les trades à corriger sans rien modifier",
        )

    def handle(self, *args, **options):
        if options['user_id']:
            user_ids = [options['user_id']]
        elif options['all']:
            from trades.models import ImportedTrade

            # order_by() vide : sans ça, Meta.ordering (-entered_at) casse DISTINCT
            user_ids = sorted(
                {
                    uid
                    for uid in ImportedTrade.objects.order_by().values_list('user_id', flat=True).distinct()
                    if uid is not None
                }
            )
        else:
            self.stdout.write(self.style.ERROR('Spécifiez --user-id ou --all'))
            return

        dry_run = options['dry_run']
        total = 0
        for user_id in user_ids:
            count = recalculate_trade_days_for_user(user_id, dry_run=dry_run)
            total += count
            if count:
                self.stdout.write(f'User {user_id}: {count} trade(s) {"à corriger" if dry_run else "corrigé(s)"}')

        verb = 'à corriger' if dry_run else 'corrigé(s)'
        self.stdout.write(self.style.SUCCESS(f'Terminé — {total} trade(s) {verb}'))
