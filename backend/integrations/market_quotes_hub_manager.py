"""Gestionnaire multi-utilisateurs des connexions Market Hub TopStepX."""
from __future__ import annotations

import json
import logging
import signal
import threading
import time
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone

from django.contrib.auth import get_user_model

from integrations.market_quotes_config import ResolvedMarketContract, resolve_market_quote_contracts
from integrations.market_quotes_hub_control import CONTROL_CHANNEL
from integrations.market_quotes_service import (
    build_empty_snapshot,
    get_user_quotes_integration,
    load_contracts_resolved,
    save_contracts_resolved,
    save_snapshot,
    user_has_quotes_credentials,
)
from integrations.topstepx_auth import (
    clear_session_token,
    get_rtc_session_token_for_hub,
    get_valid_session_token,
    is_session_expired_error,
)
from integrations.topstepx_client import TopStepXApiClient, TopStepXApiError
from integrations.topstepx_market_hub import TopStepXMarketHubRunner, login_quotes_session_for_user

logger = logging.getLogger(__name__)

CONTRACT_REFRESH_INTERVAL = timedelta(hours=12)


def _contracts_summary(contracts: list[ResolvedMarketContract]) -> str:
    return ', '.join(f'{item.key}={item.contract_id}' for item in contracts)


@dataclass
class _UserHubState:
    user_id: int
    ref_count: int = 0
    thread: threading.Thread | None = None
    runner: TopStepXMarketHubRunner | None = None
    shutdown_timer: threading.Timer | None = None
    last_contract_refresh: datetime | None = None
    lock: threading.Lock = field(default_factory=threading.Lock)


class MarketQuotesHubManager:
    def __init__(self) -> None:
        self._users: dict[int, _UserHubState] = {}
        self._global_lock = threading.Lock()
        self._stop = threading.Event()
        self._idle_ttl_seconds = 180
        self._cycle_backoff_seconds = 5

    def run(self) -> None:
        from django.conf import settings

        self._idle_ttl_seconds = int(getattr(settings, 'MARKET_QUOTES_HUB_IDLE_TTL_SECONDS', 180))
        self._cycle_backoff_seconds = int(
            getattr(settings, 'MARKET_QUOTES_HUB_CYCLE_BACKOFF_SECONDS', 5),
        )
        signal.signal(signal.SIGINT, self._shutdown_signal)
        signal.signal(signal.SIGTERM, self._shutdown_signal)

        listener = threading.Thread(target=self._listen_control, daemon=True)
        listener.start()
        logger.info('Market Quotes Hub Manager démarré (TTL inactivité=%ss)', self._idle_ttl_seconds)

        while not self._stop.is_set():
            time.sleep(1)

        self._stop_all()

    def _shutdown_signal(self, signum, frame) -> None:
        logger.info('Arrêt du Hub Manager…')
        self._stop.set()

    def _listen_control(self) -> None:
        from integrations.market_quotes_hub_control import _redis_client

        try:
            client = _redis_client()
            pubsub = client.pubsub()
            pubsub.subscribe(CONTROL_CHANNEL)
            for message in pubsub.listen():
                if self._stop.is_set():
                    break
                if message.get('type') != 'message':
                    continue
                try:
                    data = json.loads(message['data'])
                    action = data.get('action')
                    user_id = int(data['user_id'])
                    increment_ref = bool(data.get('increment_ref', action == 'activate'))
                    if action in ('activate', 'ensure'):
                        self.activate_user(user_id, increment_ref=increment_ref)
                    elif action == 'deactivate':
                        self.deactivate_user(user_id)
                except Exception:
                    logger.exception('Message control invalide: %s', message)
        except Exception:
            logger.exception('Écoute Redis control interrompue')

    def activate_user(self, user_id: int, *, increment_ref: bool = True) -> None:
        with self._global_lock:
            state = self._users.get(user_id)
            if state is None:
                state = _UserHubState(user_id=user_id)
                self._users[user_id] = state
            with state.lock:
                if state.shutdown_timer is not None:
                    state.shutdown_timer.cancel()
                    state.shutdown_timer = None
                if increment_ref:
                    state.ref_count += 1
                if state.thread is not None and state.thread.is_alive():
                    return
                if increment_ref:
                    state.ref_count = max(state.ref_count, 1)
                state.thread = threading.Thread(
                    target=self._run_user_hub,
                    args=(user_id,),
                    name=f'market-hub-user-{user_id}',
                    daemon=True,
                )
                state.thread.start()

    def deactivate_user(self, user_id: int) -> None:
        with self._global_lock:
            state = self._users.get(user_id)
            if state is None:
                return
            with state.lock:
                state.ref_count = max(0, state.ref_count - 1)
                if state.ref_count > 0:
                    return
                if state.shutdown_timer is not None:
                    state.shutdown_timer.cancel()

                def _delayed_stop() -> None:
                    with self._global_lock:
                        st = self._users.get(user_id)
                        if st is None or st.ref_count > 0:
                            return
                    self._stop_user_hub(user_id, reason='idle_ttl')

                state.shutdown_timer = threading.Timer(self._idle_ttl_seconds, _delayed_stop)
                state.shutdown_timer.daemon = True
                state.shutdown_timer.start()

    def _run_user_hub(self, user_id: int) -> None:
        User = get_user_model()
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            logger.warning('Hub user_id=%s introuvable', user_id)
            return

        if not user_has_quotes_credentials(user):
            save_snapshot(build_empty_snapshot(connected=False, message='missing_credentials'), user_id)
            return

        while not self._stop.is_set():
            with self._global_lock:
                if user_id not in self._users:
                    break
            try:
                self._run_hub_cycle(user)
            except TopStepXApiError as exc:
                logger.error('TopStep hub user_id=%s: %s', user_id, exc)
                if is_session_expired_error(exc):
                    integration = get_user_quotes_integration(user)
                    if integration is not None:
                        clear_session_token(integration)
                save_snapshot(
                    build_empty_snapshot(connected=False, message=str(exc.error_code or 'api_error')),
                    user_id,
                )
                sleep_seconds = 120 if exc.error_code == 'market_hub_rate_limited' else 30
                time.sleep(sleep_seconds)
            except Exception:
                logger.exception('Hub cycle user_id=%s', user_id)
                save_snapshot(build_empty_snapshot(connected=False, message='hub_error'), user_id)
                time.sleep(30)
            else:
                with self._global_lock:
                    still_registered = user_id in self._users
                if self._stop.is_set() or not still_registered:
                    break
                logger.info(
                    'Hub cycle terminé user_id=%s, redémarrage dans %ss',
                    user_id,
                    self._cycle_backoff_seconds,
                )
                time.sleep(self._cycle_backoff_seconds)

        self._stop_user_hub(user_id, reason='thread_exit')

    def _run_hub_cycle(self, user) -> None:
        integration = get_user_quotes_integration(user)

        if integration is not None:
            logger.info(
                'Market Hub loginKey user_id=%s (jeton RTC streaming)',
                user.id,
            )
            token = get_rtc_session_token_for_hub(integration)
            self._run_hub_cycle_with_token(user, token, integration=integration)
        else:
            self._run_hub_cycle_with_token(
                user,
                login_quotes_session_for_user(user),
                integration=None,
            )

    def _run_hub_cycle_with_token(
        self,
        user,
        token: str,
        *,
        integration,
    ) -> None:
        user_id = user.id
        client = TopStepXApiClient()

        with self._global_lock:
            state = self._users.get(user_id)
            last_refresh = state.last_contract_refresh if state else None

        cached = load_contracts_resolved(user_id)
        now = datetime.now(timezone.utc)
        cache_fresh = (
            bool(cached)
            and last_refresh is not None
            and now - last_refresh < CONTRACT_REFRESH_INTERVAL
        )
        if cache_fresh:
            contracts = cached
        else:
            contracts = resolve_market_quote_contracts(client, token, today=date.today())
            if contracts:
                save_contracts_resolved(contracts, user_id)
                with self._global_lock:
                    if user_id in self._users:
                        self._users[user_id].last_contract_refresh = now
            elif cached:
                logger.warning(
                    'Résolution vide, repli sur contrats en cache user_id=%s',
                    user_id,
                )
                contracts = cached
            else:
                raise TopStepXApiError(
                    'Aucun contrat résolu pour le bandeau cours.',
                    error_code='no_contracts',
                )

        logger.info(
            '%d contrat(s) résolu(s) user_id=%s: %s',
            len(contracts),
            user_id,
            _contracts_summary(contracts),
        )

        token_factory = None
        if integration is not None:
            token_factory = lambda integ=integration: get_rtc_session_token_for_hub(integ)

        runner = TopStepXMarketHubRunner(
            user_id=user_id,
            auth_token=token,
            contracts=contracts,
            token_factory=token_factory,
        )
        with self._global_lock:
            if user_id in self._users:
                self._users[user_id].runner = runner
        logger.info('Démarrage Market Hub user_id=%s (%d contrats)', user_id, len(contracts))
        runner.start()
        rate_limit_hits = getattr(runner, '_rate_limit_count', 0)
        if rate_limit_hits > 0:
            logger.warning(
                'Hub cycle user_id=%s terminé après %s rate limit(s), pause 120s',
                user_id,
                rate_limit_hits,
            )
            time.sleep(120)

    def _stop_user_hub(self, user_id: int, *, reason: str = 'unknown') -> None:
        with self._global_lock:
            state = self._users.pop(user_id, None)
        if state is None:
            return
        with state.lock:
            if state.shutdown_timer is not None:
                state.shutdown_timer.cancel()
            if state.runner is not None:
                state.runner.stop(reason=reason)
                state.runner = None

    def _stop_all(self) -> None:
        with self._global_lock:
            user_ids = list(self._users.keys())
        for user_id in user_ids:
            self._stop_user_hub(user_id, reason='shutdown')
