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
from integrations.signalrcore_patches import apply_signalrcore_patches, set_rate_limited_callback
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
        self._rate_limit_count = 0
        self._reconnect_attempt = 0
        self._subscribe_timer: threading.Timer | None = None
        self._connected_event = threading.Event()

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

    def _hub_url_with_access_token(self, token: str) -> str:
        """URL conforme à la doc ProjectX : token JWT en query string."""
        base = self.hub_url.split('?')[0].rstrip('/')
        return f'{base}?access_token={token}'

    def _cancel_subscribe_timer(self) -> None:
        if self._subscribe_timer is not None:
            self._subscribe_timer.cancel()
            self._subscribe_timer = None

    def _hub_is_connected(self) -> bool:
        if self._hub is None:
            return False
        transport = getattr(self._hub, 'transport', None)
        return transport is not None and transport.is_connected()

    def _handshake_timeout_seconds(self) -> float:
        return float(
            getattr(settings, 'MARKET_QUOTES_HUB_HANDSHAKE_TIMEOUT_SECONDS', 30),
        )

    def _wait_for_hub_connection(self) -> bool:
        """Attend le callback on_open (start SignalR est asynchrone)."""
        if self._hub_is_connected():
            return True
        return self._connected_event.wait(self._handshake_timeout_seconds())

    def _subscribe_all_contracts(self) -> None:
        if not self._hub_is_connected():
            return
        for contract in self.contracts:
            try:
                self._hub.send('SubscribeContractQuotes', [contract.contract_id])
                logger.info(
                    'SubscribeContractQuotes %s user_id=%s',
                    contract.contract_id,
                    self.user_id,
                )
            except Exception:
                logger.exception(
                    'Échec subscribe %s user_id=%s',
                    contract.contract_id,
                    self.user_id,
                )

    def _schedule_subscribe_after_open(self) -> None:
        """Subscribe après le handshake complet (évite invoke pendant l'ouverture WS)."""
        self._cancel_subscribe_timer()

        def _run() -> None:
            self._subscribe_timer = None
            if self._stop_event.is_set() or not self._hub_is_connected():
                return
            self._subscribe_all_contracts()
            snapshot = load_snapshot_with_connected(self.user_id, True)
            save_snapshot(snapshot, self.user_id)

        self._subscribe_timer = threading.Timer(0.25, _run)
        self._subscribe_timer.daemon = True
        self._subscribe_timer.start()

    def _on_hub_error(self, error: Any) -> None:
        error_text = getattr(error, 'error', None) or str(error)
        if error_text:
            logger.warning(
                'Market Hub erreur SignalR user_id=%s: %s',
                self.user_id,
                error_text,
            )

    def _on_rate_limited(self) -> None:
        self._rate_limit_count += 1
        logger.warning(
            'Market Hub TopStepX rate limited (429) user_id=%s tentative=%s',
            self.user_id,
            self._rate_limit_count,
        )
        if self._rate_limit_count >= 3:
            logger.warning(
                'Market Hub TopStepX arrêt après rate limit répété user_id=%s',
                self.user_id,
            )
            self._stop_event.set()

    def _build_hub(self) -> Any:
        apply_signalrcore_patches()
        set_rate_limited_callback(self._on_rate_limited)
        from signalrcore.hub_connection_builder import HubConnectionBuilder
        from signalrcore.types import HttpTransportType

        token = self._resolve_access_token()
        hub_url = self._hub_url_with_access_token(token)

        # Doc ProjectX : token JWT uniquement en query string (pas de header Authorization
        # sur le WebSocket — access_token_factory activerait AuthHubConnection).
        hub = (
            HubConnectionBuilder()
            .with_url(
                hub_url,
                options={
                    'verify_ssl': True,
                    'skip_negotiation': True,
                    'transport': HttpTransportType.web_sockets,
                },
            )
            .configure_logging(logging.WARNING)
            .build()
        )
        hub.on('GatewayQuote', self._on_gateway_quote)
        hub.on_open(self._on_open)
        hub.on_close(self._on_close)
        hub.on_error(self._on_hub_error)
        hub.on_reconnect(self._on_reconnect)
        return hub

    def _on_reconnect(self) -> None:
        logger.info('Market Hub TopStepX reconnecté user_id=%s, re-subscribe', self.user_id)
        self._subscribe_all_contracts()

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
        self._connected_event.set()
        self._rate_limit_count = 0
        self._reconnect_attempt = 0
        self._mark_integration_connected()
        self._schedule_subscribe_after_open()
        if self.on_connected:
            self.on_connected()

    def _on_close(self) -> None:
        logger.warning('Market Hub TopStepX déconnecté user_id=%s', self.user_id)
        self._connected_event.clear()
        self._cancel_subscribe_timer()
        if self.on_disconnected:
            self.on_disconnected()

    def _reconnect_delay_seconds(self) -> int:
        intervals = getattr(
            settings,
            'MARKET_QUOTES_HUB_RECONNECT_INTERVALS',
            [30, 60, 120, 300, 600],
        )
        if not intervals:
            return 30
        index = min(self._reconnect_attempt, len(intervals) - 1)
        return int(intervals[index])

    def _dispose_hub(self) -> None:
        self._cancel_subscribe_timer()
        if self._hub is None:
            return
        try:
            for contract in self.contracts:
                try:
                    self._hub.send('UnsubscribeContractQuotes', [contract.contract_id])
                except Exception:
                    pass
            self._hub.stop()
        except Exception:
            logger.exception('Erreur fermeture Market Hub user_id=%s', self.user_id)
        self._hub = None

    def _start_hub_once(self) -> None:
        self._connected_event.clear()
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
        except Exception as exc:
            if '401' in str(exc):
                logger.warning(
                    'Market Hub handshake 401 user_id=%s',
                    self.user_id,
                )
                raise TopStepXApiError(
                    'Session TopStep expirée ou invalide (Market Hub).',
                    error_code='session_expired',
                ) from exc
            raise
        if not started:
            logger.warning('Market Hub TopStepX start() a échoué user_id=%s', self.user_id)
            raise TopStepXApiError(
                'Connexion Market Hub TopStepX impossible.',
                error_code='market_hub_start_failed',
            )

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

        while not self._stop_event.is_set():
            self._start_hub_once()
            if not self._wait_for_hub_connection():
                if self._stop_event.is_set():
                    break
                logger.warning(
                    'Market Hub handshake timeout user_id=%s (pas de connexion en %ss)',
                    self.user_id,
                    self._handshake_timeout_seconds(),
                )
            else:
                while not self._stop_event.is_set() and self._hub_is_connected():
                    time.sleep(1)
                if self._stop_event.is_set():
                    break
            self._dispose_hub()
            delay = self._reconnect_delay_seconds()
            self._reconnect_attempt += 1
            logger.info(
                'Market Hub reconnexion user_id=%s dans %ss (tentative %s)',
                self.user_id,
                delay,
                self._reconnect_attempt,
            )
            if self._stop_event.wait(delay):
                break

        self._dispose_hub()

    def stop(self, *, reason: str = 'unknown') -> None:
        logger.info('Arrêt Market Hub user_id=%s raison=%s', self.user_id, reason)
        set_rate_limited_callback(None)
        self._stop_event.set()
        self._dispose_hub()
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
