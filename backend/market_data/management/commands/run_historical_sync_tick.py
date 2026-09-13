"""
Tick de synchronisation historique quotidienne.

Appelé par le timer systemd ``trading-journal-historical-sync.timer``
toutes les 15 minutes (pas de Celery Beat).
"""
from django.core.management.base import BaseCommand

from market_data.services.sync_schedule import dispatch_due_historical_syncs


class Command(BaseCommand):
    help = 'Enqueue les syncs historiques dues (profils utilisateurs enabled).'

    def handle(self, *args, **options):
        result = dispatch_due_historical_syncs()
        self.stdout.write(
            self.style.SUCCESS(
                f"historical sync tick: ran={result['ran']} "
                f"not_due={result['skipped_not_due']}"
            ),
        )
