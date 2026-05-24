"""Processus long : connexion Market Hub TopStepX et alimentation du cache Redis."""
from __future__ import annotations

import logging
import signal
import time
from datetime import date, datetime, timedelta, timezone

from django.core.management.base import BaseCommand

from integrations.market_quotes_config import resolve_market_quote_contracts
from integrations.market_quotes_service import (
    build_empty_snapshot,
    get_quotes_credentials,
    load_contracts_resolved,
    save_contracts_resolved,
    save_snapshot,
)
from integrations.topstepx_client import TopStepXApiClient, TopStepXApiError
from integrations.topstepx_market_hub import TopStepXMarketHubRunner, login_quotes_session

logger = logging.getLogger(__name__)

CONTRACT_REFRESH_INTERVAL = timedelta(hours=12)


class Command(BaseCommand):
    help = 'Maintient la connexion SignalR Market Hub TopStepX et met à jour les cours du bandeau.'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._runner: TopStepXMarketHubRunner | None = None
        self._last_contract_refresh: datetime | None = None

    def handle(self, *args, **options):
        if get_quotes_credentials() is None:
            self.stderr.write(
                self.style.ERROR(
                    'Définir TOPSTEPX_QUOTES_USERNAME et TOPSTEPX_QUOTES_API_KEY dans .env'
                )
            )
            save_snapshot(build_empty_snapshot(connected=False, message='missing_credentials'))
            return

        signal.signal(signal.SIGINT, self._shutdown)
        signal.signal(signal.SIGTERM, self._shutdown)

        while True:
            try:
                self._run_cycle()
            except TopStepXApiError as exc:
                logger.error('TopStepX Market Hub: %s', exc)
                save_snapshot(build_empty_snapshot(connected=False, message=str(exc.error_code or 'api_error')))
                time.sleep(30)
            except Exception:
                logger.exception('Market Hub cycle error')
                save_snapshot(build_empty_snapshot(connected=False, message='hub_error'))
                time.sleep(30)

    def _shutdown(self, signum, frame) -> None:
        self.stdout.write('Arrêt du Market Hub…')
        if self._runner is not None:
            self._runner.stop()
        raise SystemExit(0)

    def _should_refresh_contracts(self) -> bool:
        if self._last_contract_refresh is None:
            return True
        return datetime.now(timezone.utc) - self._last_contract_refresh >= CONTRACT_REFRESH_INTERVAL

    def _resolve_and_cache_contracts(self, client: TopStepXApiClient, token: str):
        contracts = resolve_market_quote_contracts(client, token, today=date.today())
        if not contracts:
            raise TopStepXApiError(
                'Aucun contrat résolu pour le bandeau cours.',
                error_code='no_contracts',
            )
        save_contracts_resolved(contracts)
        self._last_contract_refresh = datetime.now(timezone.utc)
        self.stdout.write(
            self.style.SUCCESS(
                f'{len(contracts)} contrat(s) résolu(s): '
                + ', '.join(f"{c.key}={c.contract_id}" for c in contracts)
            )
        )
        return contracts

    def _run_cycle(self) -> None:
        token = login_quotes_session()
        client = TopStepXApiClient()

        cached = load_contracts_resolved()
        if cached and not self._should_refresh_contracts():
            contracts = cached
        else:
            contracts = self._resolve_and_cache_contracts(client, token)

        self._runner = TopStepXMarketHubRunner(
            auth_token=token,
            contracts=contracts,
        )
        self.stdout.write(self.style.SUCCESS('Démarrage Market Hub…'))
        self._runner.start()

    def _shutdown_handler(self):
        if self._runner:
            self._runner.stop()
