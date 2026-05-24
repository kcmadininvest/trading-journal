"""Processus long : manager Market Hub TopStepX (un hub par utilisateur actif)."""
from __future__ import annotations

from django.core.management.base import BaseCommand

from integrations.market_quotes_hub_manager import MarketQuotesHubManager


class Command(BaseCommand):
    help = (
        'Maintient les connexions SignalR Market Hub TopStepX par utilisateur '
        '(activation via WebSocket dashboard).'
    )

    def handle(self, *args, **options):
        manager = MarketQuotesHubManager()
        manager.run()
