"""Processus long : manager Market Hub TopStepX (un hub par utilisateur actif)."""
from __future__ import annotations

import logging
import os
import subprocess

from django.conf import settings
from django.core.management.base import BaseCommand

from integrations.market_quotes_hub_manager import MarketQuotesHubManager
from integrations.market_quotes_service import get_quotes_credentials_env

logger = logging.getLogger(__name__)


def _git_revision() -> str:
    root = settings.BASE_DIR.parent
    try:
        result = subprocess.run(
            ['git', '-C', str(root), 'rev-parse', '--short', 'HEAD'],
            capture_output=True,
            text=True,
            timeout=2,
            check=False,
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
    except Exception:
        pass
    return 'unknown'


class Command(BaseCommand):
    help = (
        'Maintient les connexions SignalR Market Hub TopStepX par utilisateur '
        '(activation via WebSocket dashboard).'
    )

    def handle(self, *args, **options):
        if get_quotes_credentials_env() is not None:
            logger.warning(
                'TOPSTEPX_QUOTES_* est défini : ne lancez pas un ancien worker '
                'market-quotes en parallèle (conflit de session TopStep RTC).'
            )
        logger.info(
            'Market Quotes Hub Manager pid=%s revision=%s',
            os.getpid(),
            _git_revision(),
        )
        manager = MarketQuotesHubManager()
        manager.run()
