"""Session TopStepX pour appels API authentifiés."""
from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timedelta
from typing import TypeVar

from django.utils import timezone

from integrations.credentials_crypto import (
    CREDENTIALS_DECRYPT_ERROR_CODE,
    CREDENTIALS_DECRYPT_USER_MESSAGE,
    CredentialsDecryptError,
    decrypt_json,
    encrypt_json,
)
from integrations.models import UserApiIntegration
from integrations.topstep_api_pause import assert_topstep_api_allowed
from integrations.services import apply_test_result
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

DEFAULT_TOKEN_TTL = timedelta(hours=24)


def get_topstepx_integration(user) -> UserApiIntegration | None:
    return UserApiIntegration.objects.filter(user=user, provider='topstepx').first()


def is_session_expired_error(exc: TopStepXApiError) -> bool:
    msg = str(exc).lower()
    return any(marker in msg for marker in SESSION_EXPIRED_MARKERS)


def _secrets_or_raise(integration: UserApiIntegration) -> dict:
    if not integration.secrets_encrypted:
        return {}
    try:
        return decrypt_json(integration.secrets_encrypted)
    except CredentialsDecryptError as exc:
        raise TopStepXApiError(
            CREDENTIALS_DECRYPT_USER_MESSAGE,
            error_code=CREDENTIALS_DECRYPT_ERROR_CODE,
        ) from exc


def clear_session_token(integration: UserApiIntegration) -> None:
    if not integration.secrets_encrypted:
        return
    secrets = _secrets_or_raise(integration)
    secrets.pop('session_token', None)
    secrets.pop('token_expires_at', None)
    integration.secrets_encrypted = encrypt_json(secrets)
    integration.save(update_fields=['secrets_encrypted', 'updated_at'])
    apply_test_result(integration, False)


def _parse_expires_at(expires_raw: object) -> datetime | None:
    if not expires_raw:
        return None
    try:
        expires_at = datetime.fromisoformat(str(expires_raw))
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        return expires_at
    except ValueError:
        return None


def _persist_auth_result(
    integration: UserApiIntegration,
    secrets: dict,
    auth: object,
) -> str:
    from integrations.topstepx_client import TopStepXAuthResult

    if not isinstance(auth, TopStepXAuthResult):
        raise TypeError('auth must be TopStepXAuthResult')
    secrets['session_token'] = auth.token
    expires_at = auth.expires_at
    if expires_at is None:
        expires_at = timezone.now() + DEFAULT_TOKEN_TTL
    secrets['token_expires_at'] = expires_at.isoformat()
    integration.secrets_encrypted = encrypt_json(secrets)
    integration.save(update_fields=['secrets_encrypted', 'updated_at'])
    apply_test_result(integration, True)
    return auth.token


def _login_new_session(
    integration: UserApiIntegration,
    secrets: dict,
    *,
    username: str,
    api_key: str,
) -> str:
    assert_topstep_api_allowed(integration.user)
    client = TopStepXApiClient()
    auth = client.login_key(username, api_key)
    return _persist_auth_result(integration, secrets, auth)


def _refresh_expired_session(
    integration: UserApiIntegration,
    secrets: dict,
    session_token: str,
    *,
    username: str,
    api_key: str,
) -> str:
    client = TopStepXApiClient()
    try:
        auth = client.validate_session(session_token)
        return _persist_auth_result(integration, secrets, auth)
    except TopStepXApiError as exc:
        if not is_session_expired_error(exc):
            raise
    clear_session_token(integration)
    secrets = _secrets_or_raise(integration)
    return _login_new_session(
        integration,
        secrets,
        username=username,
        api_key=api_key,
    )


def get_valid_session_token(integration: UserApiIntegration) -> str:
    assert_topstep_api_allowed(integration.user)
    secrets = _secrets_or_raise(integration)
    api_key = secrets.get('api_key', '')
    session_token = secrets.get('session_token', '')
    expires_at = _parse_expires_at(secrets.get('token_expires_at'))

    username = integration.external_username
    if not api_key or not username:
        raise TopStepXApiError('Identifiants TopStepX incomplets.', error_code='missing_credentials')

    now = timezone.now()
    if session_token:
        if expires_at and expires_at <= now + timedelta(minutes=2):
            return _refresh_expired_session(
                integration,
                secrets,
                session_token,
                username=username,
                api_key=api_key,
            )
        return session_token

    return _login_new_session(
        integration,
        secrets,
        username=username,
        api_key=api_key,
    )


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
