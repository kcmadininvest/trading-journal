from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

from trades.services.rollup_service import rebuild_rollups_for_user

User = get_user_model()


class Command(BaseCommand):
    help = 'Recalcule les rollups journaliers TradeDailyRollup (backfill historique)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--user-id',
            type=int,
            help='ID utilisateur spécifique (optionnel)',
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Recalculer pour tous les utilisateurs ayant des trades',
        )

    def handle(self, *args, **options):
        if options['user_id']:
            user_ids = [options['user_id']]
        elif options['all']:
            from trades.models import ImportedTrade

            # order_by() vide : sans ça, Meta.ordering (-entered_at) casse DISTINCT
            # → un user_id par trade au lieu d'un par utilisateur.
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

        total_rows = 0
        user_count = len(user_ids)
        for index, user_id in enumerate(user_ids, start=1):
            self.stdout.write(f'[{index}/{user_count}] Rebuild rollups user {user_id}…')
            count = rebuild_rollups_for_user(user_id)
            total_rows += count
            self.stdout.write(f'User {user_id}: {count} rollups')

        self.stdout.write(self.style.SUCCESS(f'Terminé — {total_rows} lignes rollup au total'))
