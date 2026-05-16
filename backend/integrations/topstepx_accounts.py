"""Résolution de l'ID compte ProjectX pour la sync TopStepX."""
from __future__ import annotations

from django.core.cache import cache

from integrations.topstepx_client import TopStepXApiClient, TopStepXApiError
from trades.models import TradingAccount

ACCOUNTS_CACHE_TTL_SECONDS = 600  # 10 min


def _accounts_cache_key(user_id: int) -> str:
    return f'topstepx:accounts:{user_id}'


def invalidate_topstepx_accounts_cache(user_id: int) -> None:
    cache.delete(_accounts_cache_key(user_id))


def list_projectx_accounts(
    client: TopStepXApiClient,
    auth_token: str,
    *,
    user_id: int | None = None,
) -> list[dict]:
    if user_id is not None:
        cached = cache.get(_accounts_cache_key(user_id))
        if cached is not None:
            return cached

    payload = client._request_json('POST', '/api/Account/search', body={}, auth_token=auth_token)
    if not payload.get('success') or payload.get('errorCode', 0) != 0:
        msg = payload.get('errorMessage') or 'Impossible de lister les comptes TopStepX.'
        raise TopStepXApiError(msg, error_code=str(payload.get('errorCode', 'account_search_failed')))
    accounts = payload.get('accounts') or []
    result = accounts if isinstance(accounts, list) else []

    if user_id is not None:
        cache.set(_accounts_cache_key(user_id), result, ACCOUNTS_CACHE_TTL_SECONDS)
    return result


def _find_api_account_id_by_name(accounts: list[dict], trading_account: TradingAccount) -> int | None:
    name_key = (trading_account.name or '').strip().lower()
    if not name_key:
        return None
    for account in accounts:
        api_name = str(account.get('name', '')).strip().lower()
        if api_name and api_name == name_key:
            return int(account['id'])
    return None


def resolve_projectx_account_id(
    client: TopStepXApiClient,
    auth_token: str,
    trading_account: TradingAccount,
) -> tuple[int, bool]:
    """
    Retourne (accountId ProjectX, id_corrigé_par_rapport_au_champ_broker).

    Priorité au **nom** du compte journal (identifiant fiable côté TopStepX).
    """
    user_id = trading_account.user_id
    accounts = list_projectx_accounts(client, auth_token, user_id=user_id)
    by_id = {
        int(a['id']): a
        for a in accounts
        if a.get('id') is not None
    }

    name_match_id = _find_api_account_id_by_name(accounts, trading_account)
    if name_match_id is not None:
        stored = (trading_account.broker_account_id or '').strip()
        needs_update = stored != str(name_match_id)
        return name_match_id, needs_update

    broker_id = (trading_account.broker_account_id or '').strip()
    if broker_id.isdigit():
        aid = int(broker_id)
        if aid in by_id:
            return aid, False

    visible = [a for a in accounts if a.get('isVisible')]
    hint_accounts = visible[:5] if visible else list(by_id.values())[:5]
    hints = ', '.join(
        f'{a.get("name")} (ID {a.get("id")})' for a in hint_accounts if a.get('id') is not None
    )
    extra = f' Comptes visibles : {hints}.' if hints else ''
    raise ValueError(
        'Compte TopStepX introuvable. Nommez le compte journal exactement comme sur TopStepX '
        '(menu déroulant des comptes), ou renseignez l\'ID ProjectX numérique.'
        + extra
    )


def repair_topstep_broker_account_ids(
    client: TopStepXApiClient,
    auth_token: str,
    trading_accounts: list[TradingAccount],
) -> list[dict]:
    """Met à jour broker_account_id pour chaque compte TopStepX selon le nom API."""
    if not trading_accounts:
        return []

    user_id = trading_accounts[0].user_id
    accounts = list_projectx_accounts(client, auth_token, user_id=user_id)
    repaired: list[dict] = []

    for trading_account in trading_accounts:
        if trading_account.account_type != 'topstep':
            continue
        api_id = _find_api_account_id_by_name(accounts, trading_account)
        if api_id is None:
            continue
        new_id = str(api_id)
        old_id = (trading_account.broker_account_id or '').strip()
        if old_id == new_id:
            continue
        trading_account.broker_account_id = new_id
        trading_account.save(update_fields=['broker_account_id', 'updated_at'])
        repaired.append({
            'trading_account_id': trading_account.pk,
            'name': trading_account.name,
            'old_broker_account_id': old_id or None,
            'broker_account_id': new_id,
        })
    return repaired
