"""Session TopStepX pour appels API authentifiés."""
from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timedelta
from typing import TypeVar

from django.utils import timezone

from integrations.credentials_crypto import decrypt_json, encrypt_json
from integrations.models import UserApiIntegration
from integrations.topstepx_client import TopStepXApiClient, TopStepXApiError

T = TypeVar('T')

SESSION_EXPIRED_MARKERS = (
    'session expirée',
    'session expiree',
    'session expired',
    'token expired',
    'invalid token',
    'unauthorized',
)


def get_topstepx_integration(user) -> UserApiIntegration | None:
    return UserApiIntegration.objects.filter(user=user, provider='topstepx').first()


def is_session_expired_error(exc: TopStepXApiError) -> bool:
    msg = str(exc).lower()
    return any(marker in msg for marker in SESSION_EXPIRED_MARKERS)


def clear_session_token(integration: UserApiIntegration) -> None:
    if not integration.secrets_encrypted:
        return
    secrets = decrypt_json(integration.secrets_encrypted)
    secrets.pop('session_token', None)
    secrets.pop('token_expires_at', None)
    integration.secrets_encrypted = encrypt_json(secrets)
    integration.save(update_fields=['secrets_encrypted', 'updated_at'])


def get_valid_session_token(integration: UserApiIntegration) -> str:
    secrets = decrypt_json(integration.secrets_encrypted) if integration.secrets_encrypted else {}
    api_key = secrets.get('api_key', '')
    session_token = secrets.get('session_token', '')
    expires_raw = secrets.get('token_expires_at')

    expires_at = None
    if expires_raw:
        try:
            expires_at = datetime.fromisoformat(expires_raw)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
        except ValueError:
            expires_at = None

    now = timezone.now()
    if session_token and expires_at and expires_at > now + timedelta(minutes=2):
        return session_token

    username = integration.external_username
    if not api_key or not username:
        raise TopStepXApiError('Identifiants TopStepX incomplets.', error_code='missing_credentials')

    client = TopStepXApiClient()
    auth = client.login_key(username, api_key)
    secrets['session_token'] = auth.token
    if auth.expires_at:
        secrets['token_expires_at'] = auth.expires_at.isoformat()
    else:
        secrets.pop('token_expires_at', None)
    integration.secrets_encrypted = encrypt_json(secrets)
    integration.save(update_fields=['secrets_encrypted', 'updated_at'])
    return auth.token


def call_with_valid_session_token(
    integration: UserApiIntegration,
    callback: Callable[[str], T],
) -> T:
    """
    Exécute un appel API TopStepX avec jeton de session valide.

    En cas de session expirée côté API, efface le jeton en cache et réessaie
    une fois après reconnexion (loginKey).
    """
    from integrations.topstepx_accounts import invalidate_topstepx_accounts_cache

    token = get_valid_session_token(integration)
    try:
        return callback(token)
    except TopStepXApiError as exc:
        if not is_session_expired_error(exc):
            raise
        clear_session_token(integration)
        invalidate_topstepx_accounts_cache(integration.user_id)
        token = get_valid_session_token(integration)
        return callback(token)
