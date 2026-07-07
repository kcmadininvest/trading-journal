"""Client SignalR Market Hub TopStepX pour les quotes temps réel."""
from __future__ import annotations

import logging
import threading
import time
from typing import Any, Callable
from urllib.error import HTTPError

from django.conf import settings

from integrations.market_quotes_config import ResolvedMarketContract
from integrations.market_quotes_service import (
    build_empty_snapshot,
    get_quotes_credentials_env,
    get_user_quotes_integration,
    load_snapshot,
    normalize_gateway_quote,
    save_snapshot,
    update_quote_in_snapshot,
    user_has_quotes_credentials,
)
from integrations.topstepx_client import TopStepXApiClient, TopStepXApiError
from integrations.topstepx_auth import get_valid_session_token
from integrations.services import apply_test_result

logger = logging.getLogger(__name__)

QuoteHandler = Callable[[dict[str, Any]], None]
TokenFactory = Callable[[], str]


def extract_gateway_quote_payload(*args: Any) -> tuple[dict[str, Any] | None, str | None]:
    """Extrait le dict quote depuis les arguments SignalR TopStepX.

    Formats observés :
    - (dict,) — payload seul
    - ([contract_id, dict],) — format actuel du hub Market
    - (contract_id, dict) — variante deux arguments
    """
    contract_id_hint: str | None = None
    if len(args) == 1:
        first = args[0]
        if isinstance(first, dict):
            return first, None
        if isinstance(first, (list, tuple)) and len(first) >= 2:
            if isinstance(first[0], str):
                contract_id_hint = first[0]
            if isinstance(first[1], dict):
                return first[1], contract_id_hint
    if len(args) >= 2:
        if isinstance(args[0], str):
            contract_id_hint = args[0]
        if isinstance(args[1], dict):
            return args[1], contract_id_hint
        if isinstance(args[0], dict):
            return args[0], None
    return None, None


class TopStepXMarketHubRunner:
    """Maintient une connexion Market Hub et met à jour le cache des quotes."""

    def __init__(
        self,
        *,
        user_id: int,
        auth_token: str,
        contracts: list[ResolvedMarketContract],
        hub_url: str | None = None,
        token_factory: TokenFactory | None = None,
        on_connected: Callable[[], None] | None = None,
        on_disconnected: Callable[[], None] | None = None,
    ) -> None:
        self.user_id = user_id
        self.auth_token = auth_token
        self._token_factory = token_factory
        self.contracts = contracts
        self.hub_url = hub_url or getattr(
            settings,
            'TOPSTEPX_RTC_MARKET_HUB_URL',
            'https://rtc.topstepx.com/hubs/market',
        )
        self.on_connected = on_connected
        self.on_disconnected = on_disconnected
        self._hub: Any = None
        self._stop_event = threading.Event()
        self._contract_by_id: dict[str, ResolvedMarketContract] = {
            c.contract_id: c for c in contracts
        }
        self._symbol_to_key: dict[str, str] = {
            c.symbol_id.upper(): c.key for c in contracts
        }

    def _resolve_access_token(self) -> str:
        if self._token_factory is not None:
            return self._token_factory()
        return self.auth_token

    def _mark_integration_connected(self) -> None:
        from django.contrib.auth import get_user_model

        from integrations.market_quotes_service import get_user_quotes_integration

        try:
            user = get_user_model().objects.get(id=self.user_id)
        except get_user_model().DoesNotExist:
            return
        integration = get_user_quotes_integration(user)
        if integration is not None and not integration.is_connected:
            apply_test_result(integration, True)

    def _build_hub(self) -> Any:
        from signalrcore.hub_connection_builder import HubConnectionBuilder

        hub = (
            HubConnectionBuilder()
            .with_url(
                self.hub_url,
                options={
                    'access_token_factory': self._resolve_access_token,
                    'verify_ssl': True,
                },
            )
            .configure_logging(logging.WARNING)
            .with_automatic_reconnect(
                {
                    'type': 'raw',
                    'keep_alive_interval': 10,
                    'reconnect_interval': 5,
                    'max_attempts': 0,
                }
            )
            .build()
        )
        hub.on('GatewayQuote', self._on_gateway_quote)
        hub.on_open(self._on_open)
        hub.on_close(self._on_close)
        return hub

    def _resolve_contract_for_quote(
        self,
        payload: dict[str, Any],
        *,
        contract_id_hint: str | None = None,
    ) -> ResolvedMarketContract | None:
        symbol = str(payload.get('symbol') or payload.get('symbolId') or '').upper()
        contract_id = str(
            payload.get('contractId') or payload.get('contract') or contract_id_hint or ''
        )
        if contract_id and contract_id in self._contract_by_id:
            return self._contract_by_id[contract_id]
        if symbol and symbol in self._symbol_to_key:
            key = self._symbol_to_key[symbol]
            for contract in self.contracts:
                if contract.key == key:
                    return contract
        return None

    def _on_gateway_quote(self, *args: Any) -> None:
        payload, contract_id_hint = extract_gateway_quote_payload(*args)
        if not payload:
            return

        contract = self._resolve_contract_for_quote(payload, contract_id_hint=contract_id_hint)
        if contract is None:
            return

        quote = normalize_gateway_quote(
            payload,
            instrument_key=contract.key,
            contract_id=contract.contract_id,
            label=contract.label,
            tick_size=contract.tick_size,
        )
        update_quote_in_snapshot(quote, self.user_id)

    def _on_open(self) -> None:
        logger.info('Market Hub TopStepX connecté user_id=%s', self.user_id)
        self._mark_integration_connected()
        if self._hub is None:
            return
        for contract in self.contracts:
            try:
                self._hub.send('SubscribeContractQuotes', [contract.contract_id])
                logger.debug('Subscribed quotes %s user_id=%s', contract.contract_id, self.user_id)
            except Exception:
                logger.exception('Échec subscribe %s', contract.contract_id)
        snapshot = load_snapshot_with_connected(self.user_id, True)
        save_snapshot(snapshot, self.user_id)
        if self.on_connected:
            self.on_connected()

    def _on_close(self) -> None:
        logger.warning('Market Hub TopStepX déconnecté user_id=%s', self.user_id)
        # Pas de diffusion « disconnected » : reconnexion SignalR fréquente ; conserver
        # les derniers cours évite le clignotement « en attente des cotations ».
        if self.on_disconnected:
            self.on_disconnected()

    def start(self) -> None:
        existing = load_snapshot(self.user_id)
        has_prices = any(
            q.get('last_price_display') for q in (existing.get('quotes') or [])
        )
        if has_prices:
            initial = existing
            initial['connected'] = False
            initial['message'] = 'connecting'
        else:
            initial = build_empty_snapshot(connected=False, message='connecting')
        for contract in self.contracts:
            for row in initial['quotes']:
                if row['key'] == contract.key:
                    row['contract_id'] = contract.contract_id
                    row['label'] = contract.label
        save_snapshot(initial, self.user_id)

        self._hub = self._build_hub()
        try:
            started = self._hub.start()
        except HTTPError as exc:
            if exc.code == 401:
                logger.warning(
                    'Market Hub negotiate 401 user_id=%s',
                    self.user_id,
                )
                raise TopStepXApiError(
                    'Session TopStep expirée ou invalide (Market Hub).',
                    error_code='session_expired',
                ) from exc
            raise TopStepXApiError(
                f'Connexion Market Hub TopStepX impossible (HTTP {exc.code}).',
                error_code='market_hub_start_failed',
            ) from exc
        if not started:
            logger.warning('Market Hub TopStepX start() a échoué user_id=%s', self.user_id)
            raise TopStepXApiError(
                'Connexion Market Hub TopStepX impossible.',
                error_code='market_hub_start_failed',
            )
        while not self._stop_event.is_set():
            time.sleep(1)

    def stop(self, *, reason: str = 'unknown') -> None:
        logger.info('Arrêt Market Hub user_id=%s raison=%s', self.user_id, reason)
        self._stop_event.set()
        if self._hub is not None:
            try:
                for contract in self.contracts:
                    try:
                        self._hub.send('UnsubscribeContractQuotes', [contract.contract_id])
                    except Exception:
                        pass
                self._hub.stop()
            except Exception:
                logger.exception('Erreur arrêt Market Hub user_id=%s', self.user_id)
            self._hub = None
        snapshot = load_snapshot(self.user_id)
        snapshot['connected'] = False
        if snapshot.get('message') == 'connecting':
            snapshot['message'] = 'market_quotes_disconnected'
        save_snapshot(snapshot, self.user_id)


def load_snapshot_with_connected(user_id: int, connected: bool) -> dict[str, Any]:
    snapshot = load_snapshot(user_id)
    snapshot['connected'] = connected
    if not connected:
        snapshot['message'] = 'market_quotes_disconnected'
    else:
        snapshot['message'] = None
    return snapshot


def login_quotes_session_for_user(user) -> str:
    integration = get_user_quotes_integration(user)
    if integration is not None:
        return get_valid_session_token(integration)

    if getattr(settings, 'MARKET_QUOTES_ENV_FALLBACK', False):
        creds = get_quotes_credentials_env()
        if creds is None:
            raise TopStepXApiError(
                'Identifiants TopStep manquants.',
                error_code='missing_quotes_credentials',
            )
        username, api_key = creds
        client = TopStepXApiClient()
        auth = client.login_key(username, api_key)
        return auth.token

    raise TopStepXApiError(
        'Configurez TopStep dans Paramètres → Intégrations.',
        error_code='missing_credentials',
    )


def login_quotes_session() -> str:
    """Déprécié : utiliser login_quotes_session_for_user."""
    creds = get_quotes_credentials_env()
    if creds is None:
        raise TopStepXApiError(
            'Identifiants TOPSTEPX_QUOTES manquants.',
            error_code='missing_quotes_credentials',
        )
    username, api_key = creds
    client = TopStepXApiClient()
    auth = client.login_key(username, api_key)
    return auth.token
