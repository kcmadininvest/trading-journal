"""Synchronisation incrémentale des trades TopStepX (insert-only)."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import TYPE_CHECKING, Any

from django.utils import timezone

from integrations.models import UserApiIntegration
from integrations.topstepx_accounts import resolve_projectx_account_id
from integrations.topstepx_auth import (
    call_with_valid_session_token,
    get_topstepx_integration,
    is_session_expired_error,
)
from integrations.services import apply_test_result
from integrations.topstepx_client import TopStepXApiClient, TopStepXApiError
from trades.models import TradeSyncLog, TradingAccount

from .topstepx_mapper import map_api_trades_to_parsed_rows
from .trade_upsert import import_parsed_trades

if TYPE_CHECKING:
    from trades.replay.auto_build import ReplayAutoBuildSummary


DEFAULT_FIRST_SYNC_DAYS = 90
SYNC_LOOKBACK_MARGIN = timedelta(days=1)
SYNC_STALE_MINUTES = 5


@dataclass
class SyncResult:
    created: int
    skipped: int
    errors: list[str]
    last_sync_at: datetime
    total_fetched: int
    replay: 'ReplayAutoBuildSummary | None' = None


class TopStepXSyncService:
    def __init__(self, client: TopStepXApiClient | None = None):
        self.client = client or TopStepXApiClient()

    def _get_broker_meta(self, account: TradingAccount) -> dict[str, Any]:
        cfg = account.broker_config if isinstance(account.broker_config, dict) else {}
        topstepx = cfg.get('topstepx')
        if not isinstance(topstepx, dict):
            topstepx = {}
        return topstepx

    def _set_broker_meta(self, account: TradingAccount, topstepx: dict[str, Any]) -> None:
        cfg = dict(account.broker_config) if isinstance(account.broker_config, dict) else {}
        cfg['topstepx'] = topstepx
        account.broker_config = cfg
        account.save(update_fields=['broker_config', 'updated_at'])

    def _resolve_since(self, account: TradingAccount, full_resync: bool) -> datetime:
        """
        Fenêtre de récupération API.

        Toujours au moins DEFAULT_FIRST_SYNC_DAYS en arrière (insert-only : les
        doublons sont ignorés). Nécessaire pour recréer un trade supprimé
        localement — une fenêtre « depuis last_sync_at » exclurait l'historique.
        """
        del full_resync  # réservé pour évolutions futures (ex. fenêtre étendue)
        since = timezone.now() - timedelta(days=DEFAULT_FIRST_SYNC_DAYS)
        if account.created_at:
            account_since = account.created_at - SYNC_LOOKBACK_MARGIN
            if account_since.tzinfo is None:
                account_since = account_since.replace(tzinfo=timezone.utc)
            if account_since > since:
                since = account_since
        return since

    def sync_account(
        self,
        user,
        trading_account: TradingAccount,
        *,
        full_resync: bool = False,
    ) -> SyncResult:
        errors: list[str] = []

        if trading_account.account_type != 'topstep':
            raise ValueError('La synchronisation API est réservée aux comptes TopStepX.')

        integration = get_topstepx_integration(user)
        if integration is None or not integration.secrets_encrypted:
            raise ValueError('Configurez l\'intégration TopStepX dans les paramètres.')

        from integrations.topstep_api_pause import assert_topstep_api_allowed

        try:
            assert_topstep_api_allowed(user)
        except TopStepXApiError as exc:
            raise ValueError(str(exc)) from exc

        def _run_sync(token: str) -> tuple[list, datetime]:
            account_id, _needs_broker_id_update = resolve_projectx_account_id(
                self.client, token, trading_account
            )
            new_broker_id = str(account_id)
            if (trading_account.broker_account_id or '').strip() != new_broker_id:
                trading_account.broker_account_id = new_broker_id
                trading_account.save(update_fields=['broker_account_id', 'updated_at'])

            since = self._resolve_since(trading_account, full_resync)
            sync_now = timezone.now()
            trades = self.client.search_trades(token, account_id, since, sync_now)
            return trades, sync_now

        try:
            api_trades, now = call_with_valid_session_token(integration, _run_sync)
        except ValueError as exc:
            raise exc
        except TopStepXApiError as exc:
            from integrations.credentials_crypto import (
                CREDENTIALS_DECRYPT_ERROR_CODE,
                IntegrationUserError,
            )

            if exc.error_code == CREDENTIALS_DECRYPT_ERROR_CODE:
                apply_test_result(integration, False)
                raise IntegrationUserError(str(exc), CREDENTIALS_DECRYPT_ERROR_CODE) from exc
            if is_session_expired_error(exc):
                apply_test_result(integration, False)
                raise ValueError(
                    'Session TopStepX expirée. Testez à nouveau la connexion dans les paramètres.'
                ) from exc
            raise ValueError(str(exc)) from exc

        parsed_rows = map_api_trades_to_parsed_rows(api_trades)
        counts = import_parsed_trades(user, trading_account, parsed_rows)

        from trades.replay.auto_build import build_replay_for_new_trade_days

        replay_summary = None
        if counts['created'] > 0:
            replay_summary = build_replay_for_new_trade_days(
                user,
                trading_account,
                counts['created_trade_days'],
            )

        last_sync_at = now
        meta = self._get_broker_meta(trading_account)
        meta['last_sync_at'] = last_sync_at.isoformat()
        self._set_broker_meta(trading_account, meta)

        TradeSyncLog.objects.create(
            user=user,
            trading_account=trading_account,
            provider='topstepx',
            source='api',
            total_fetched=len(api_trades),
            created_count=counts['created'],
            skipped_count=counts['skipped'],
            error_count=len(errors),
            errors=errors,
        )

        return SyncResult(
            created=counts['created'],
            skipped=counts['skipped'],
            errors=errors,
            last_sync_at=last_sync_at,
            total_fetched=len(api_trades),
            replay=replay_summary,
        )

    def _should_sync(self, trading_account: TradingAccount, integration) -> bool:
        if not integration or not integration.secrets_encrypted or not integration.is_connected:
            return False
        if trading_account.account_type != 'topstep' or trading_account.status != 'active':
            return False
        meta = self._get_broker_meta(trading_account)
        last_raw = meta.get('last_sync_at')
        if not last_raw:
            return True
        try:
            last = datetime.fromisoformat(str(last_raw))
            if last.tzinfo is None:
                last = last.replace(tzinfo=timezone.utc)
        except ValueError:
            return True
        return timezone.now() - last > timedelta(minutes=SYNC_STALE_MINUTES)

    def get_sync_status(self, trading_account: TradingAccount) -> dict[str, Any]:
        meta = self._get_broker_meta(trading_account)
        last_log = (
            TradeSyncLog.objects.filter(trading_account=trading_account, provider='topstepx')
            .order_by('-synced_at')
            .first()
        )
        integration = get_topstepx_integration(trading_account.user)
        from integrations.topstep_api_pause import is_topstep_api_paused

        paused = is_topstep_api_paused(trading_account.user)
        return {
            'broker_account_id': trading_account.broker_account_id,
            'last_sync_at': meta.get('last_sync_at'),
            'integration_configured': bool(integration and integration.secrets_encrypted),
            'integration_connected': integration.is_connected if integration else False,
            'topstep_api_paused': paused,
            'should_sync': self._should_sync(trading_account, integration) and not paused,
            'sync_stale_minutes': SYNC_STALE_MINUTES,
            'last_log': {
                'synced_at': last_log.synced_at.isoformat() if last_log else None,
                'created_count': last_log.created_count if last_log else 0,
                'skipped_count': last_log.skipped_count if last_log else 0,
                'total_fetched': last_log.total_fetched if last_log else 0,
            }
            if last_log
            else None,
        }
