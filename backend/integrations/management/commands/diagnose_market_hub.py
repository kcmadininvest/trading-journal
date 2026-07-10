"""Diagnostic explicite de la connexion Market Hub TopStepX (une session isolée)."""
from __future__ import annotations

import logging
import subprocess
import threading
import time
from dataclasses import dataclass, field
from datetime import date

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from integrations.market_quotes_config import ResolvedMarketContract, resolve_market_quote_contracts
from integrations.topstepx_client import TopStepXApiClient, TopStepXApiError
from integrations.topstepx_market_hub import TopStepXMarketHubRunner, login_quotes_session_for_user

logger = logging.getLogger(__name__)


@dataclass
class DiagnosticReport:
    connected_at: float | None = None
    disconnected_at: float | None = None
    subscribe_sent: list[str] = field(default_factory=list)
    subscribe_acks: list[str] = field(default_factory=list)
    subscribe_errors: list[tuple[str, str]] = field(default_factory=list)
    quotes_received: int = 0
    hub_errors: list[str] = field(default_factory=list)
    close_errors: list[str] = field(default_factory=list)

    @property
    def connection_ms(self) -> int | None:
        if self.connected_at is None or self.disconnected_at is None:
            return None
        return int((self.disconnected_at - self.connected_at) * 1000)

    @property
    def still_connected(self) -> bool:
        return self.connected_at is not None and self.disconnected_at is None


class DiagnosticMarketHubRunner(TopStepXMarketHubRunner):
    """Runner instrumenté pour le diagnostic (logs structurés)."""

    def __init__(self, *args, report: DiagnosticReport, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self._report = report

    def _on_server_close_message(
        self,
        error_text: str | None,
        allow_reconnect: bool | None,
    ) -> None:
        detail = error_text or '(aucune)'
        self._report.close_errors.append(
            f'{detail} (allowReconnect={allow_reconnect})',
        )
        super()._on_server_close_message(error_text, allow_reconnect)

    def _on_hub_error(self, error) -> None:
        invocation_id = getattr(error, 'invocation_id', None)
        error_text = getattr(error, 'error', None) or str(error)
        self._report.hub_errors.append(
            f'invocationId={invocation_id or "-"}: {error_text}',
        )
        super()._on_hub_error(error)

    def _on_open(self) -> None:
        self._report.connected_at = time.monotonic()
        super()._on_open()

    def _on_close(self) -> None:
        self._report.disconnected_at = time.monotonic()
        super()._on_close()

    def _on_gateway_quote(self, *args) -> None:
        self._report.quotes_received += 1
        super()._on_gateway_quote(*args)

    def _subscribe_all_contracts(self) -> None:
        if not self._hub_is_connected():
            return
        for contract in self.contracts:
            contract_id = contract.contract_id
            self._report.subscribe_sent.append(contract_id)

            def _on_subscribe_done(
                completion,
                *,
                cid: str = contract_id,
            ) -> None:
                err = getattr(completion, 'error', None)
                if err:
                    self._report.subscribe_errors.append((cid, str(err)))
                else:
                    self._report.subscribe_acks.append(cid)

            try:
                self._hub.send(
                    'SubscribeContractQuotes',
                    [contract_id],
                    on_invocation=_on_subscribe_done,
                )
                logger.info(
                    'SubscribeContractQuotes %s user_id=%s',
                    contract_id,
                    self.user_id,
                )
            except Exception as exc:
                self._report.subscribe_errors.append((contract_id, str(exc)))
                logger.exception(
                    'Échec subscribe %s user_id=%s',
                    contract_id,
                    self.user_id,
                )


class Command(BaseCommand):
    help = (
        'Teste une connexion Market Hub TopStep isolée avec journal explicite '
        '(arrêter trading-journal-market-quotes avant exécution).'
    )

    def add_arguments(self, parser) -> None:
        parser.add_argument('--user-id', type=int, default=3)
        parser.add_argument('--hold-seconds', type=int, default=10)
        parser.add_argument(
            '--max-contracts',
            type=int,
            default=0,
            help='0 = tous les contrats, 1 = un seul (test minimal)',
        )
        parser.add_argument(
            '--verbose-signalr',
            action='store_true',
            help='Active les logs DEBUG signalrcore',
        )

    def handle(self, *args, **options) -> None:
        user_id = int(options['user_id'])
        hold_seconds = max(1, int(options['hold_seconds']))
        max_contracts = int(options['max_contracts'])
        verbose_signalr = bool(options['verbose_signalr'])

        logging.getLogger('integrations.topstepx_market_hub').setLevel(logging.INFO)
        logging.getLogger('signalrcore').setLevel(
            logging.DEBUG if verbose_signalr else logging.INFO,
        )

        self.stdout.write(self.style.MIGRATE_HEADING('=== Diagnostic Market Hub TopStep ==='))
        self._step(1, 'Vérification des processus concurrents')
        self._check_no_other_hub_worker()

        self._step(2, f'Chargement utilisateur id={user_id}')
        user = self._load_user(user_id)

        self._step(3, 'Authentification REST TopStep (loginKey / session cache)')
        try:
            token = login_quotes_session_for_user(user)
        except TopStepXApiError as exc:
            raise CommandError(f'Authentification échouée: {exc}') from exc
        self.stdout.write(self.style.SUCCESS(f'  OK — jeton obtenu ({len(token)} caractères)'))

        self._step(4, 'Résolution des contrats marché')
        client = TopStepXApiClient()
        try:
            contracts = resolve_market_quote_contracts(client, token, today=date.today())
        except TopStepXApiError as exc:
            raise CommandError(f'Résolution contrats échouée: {exc}') from exc
        if not contracts:
            raise CommandError('Aucun contrat résolu.')
        if max_contracts > 0:
            contracts = contracts[:max_contracts]
        self._print_contracts(contracts)

        report = DiagnosticReport()
        runner = DiagnosticMarketHubRunner(
            user_id=user.id,
            auth_token=token,
            contracts=contracts,
            report=report,
        )

        self._step(5, 'Connexion WebSocket Market Hub (SignalR)')
        self.stdout.write('  En attente du handshake…')

        def _run_hub() -> None:
            try:
                runner._start_hub_once()
                if not runner._wait_for_hub_connection():
                    return
                time.sleep(hold_seconds)
            finally:
                runner.stop(reason='diagnose')

        thread = threading.Thread(target=_run_hub, name='diagnose-market-hub')
        thread.start()
        thread.join()

        self._step(6, 'Résultat du test')
        self._print_report(report, hold_seconds)

    def _step(self, number: int, title: str) -> None:
        self.stdout.write('')
        self.stdout.write(self.style.HTTP_INFO(f'[{number}/6] {title}'))

    def _check_no_other_hub_worker(self) -> None:
        try:
            proc = subprocess.run(
                ['pgrep', '-af', 'run_market_quotes_hub'],
                capture_output=True,
                text=True,
                check=False,
            )
        except FileNotFoundError:
            self.stdout.write(self.style.WARNING('  pgrep indisponible — vérification processus ignorée'))
            return

        lines = [line.strip() for line in proc.stdout.splitlines() if line.strip()]
        others = [
            line for line in lines
            if 'diagnose_market_hub' not in line
        ]
        if others:
            self.stdout.write(self.style.ERROR('  ERREUR — worker market-quotes déjà actif :'))
            for line in others:
                self.stdout.write(f'    {line}')
            raise CommandError(
                'Arrêtez trading-journal-market-quotes avant le diagnostic '
                '(systemctl stop trading-journal-market-quotes).',
            )
        self.stdout.write(self.style.SUCCESS('  OK — aucun worker market-quotes concurrent'))

    def _load_user(self, user_id: int):
        User = get_user_model()
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist as exc:
            raise CommandError(f'Utilisateur id={user_id} introuvable.') from exc

    def _print_contracts(self, contracts: list[ResolvedMarketContract]) -> None:
        for contract in contracts:
            self.stdout.write(f'  • {contract.key} = {contract.contract_id}')

    def _print_report(self, report: DiagnosticReport, hold_seconds: int) -> None:
        if report.connected_at is None:
            self.stdout.write(self.style.ERROR('  ÉCHEC — handshake non reçu (pas de on_open)'))
            return

        self.stdout.write(self.style.SUCCESS('  Handshake OK (on_open reçu)'))

        if report.subscribe_sent:
            self.stdout.write(f'  Subscribe envoyés ({len(report.subscribe_sent)}):')
            for contract_id in report.subscribe_sent:
                self.stdout.write(f'    → {contract_id}')
        else:
            self.stdout.write(self.style.WARNING('  Aucun SubscribeContractQuotes envoyé'))

        if report.subscribe_acks:
            self.stdout.write(self.style.SUCCESS(
                f'  Subscribe acquittés ({len(report.subscribe_acks)}): '
                + ', '.join(report.subscribe_acks),
            ))

        for contract_id, err in report.subscribe_errors:
            self.stdout.write(self.style.ERROR(
                f'  Subscribe ERREUR {contract_id}: {err}',
            ))

        for err in report.hub_errors:
            self.stdout.write(self.style.ERROR(f'  Erreur SignalR: {err}'))

        for err in report.close_errors:
            self.stdout.write(self.style.ERROR(f'  CloseMessage serveur: {err}'))

        if report.disconnected_at is None:
            self.stdout.write(self.style.SUCCESS(
                f'  Connexion maintenue pendant {hold_seconds}s '
                f'({report.quotes_received} quote(s) reçue(s))',
            ))
            return

        duration = report.connection_ms
        self.stdout.write(self.style.WARNING(
            f'  Déconnexion après {duration}ms '
            f'({report.quotes_received} quote(s) reçue(s))',
        ))

        if duration is not None and duration < 500 and not report.subscribe_acks:
            self.stdout.write(self.style.WARNING(
                '  Cause probable: subscribe trop tardif ou rejeté avant ack '
                '(MARKET_QUOTES_HUB_SUBSCRIBE_DELAY_MS doit être 0).',
            ))
        elif duration is not None and duration < 500 and report.subscribe_sent and not report.quotes_received:
            self.stdout.write(self.style.WARNING(
                '  Cause probable: TopStep ferme après subscribe — vérifiez droits '
                'cours temps réel, contrats invalides, ou session RTC concurrente '
                '(plateforme TopStep ouverte).',
            ))
        elif report.quotes_received > 0:
            self.stdout.write(self.style.SUCCESS(
                '  Des quotes ont été reçues avant la coupure — la connexion RTC fonctionne.',
            ))
