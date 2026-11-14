"""Passkeys WebAuthn : registration / authentication (coexiste avec TOTP)."""
from __future__ import annotations

import json
import logging
import secrets
from typing import Any, Optional
from urllib.parse import urlparse

from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.http import HttpRequest
from django.utils import timezone
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import base64url_to_bytes, bytes_to_base64url
from webauthn.helpers.structs import (
    AttestationConveyancePreference,
    AuthenticatorSelectionCriteria,
    AuthenticatorTransport,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from .account_security import AccountSecurityError, revoke_other_sessions
from .models import LoginHistory, User, WebAuthnCredential

logger = logging.getLogger(__name__)

WEBAUTHN_CHALLENGE_TTL = 300
WEBAUTHN_REG_PREFIX = 'webauthn_reg:'
WEBAUTHN_AUTH_PREFIX = 'webauthn_auth:'
GENERIC_AUTH_ERROR = 'Identifiants incorrects.'


def _rp_name() -> str:
    return getattr(settings, 'WEBAUTHN_RP_NAME', 'K&C Trading Journal')


def _configured_origin() -> str:
    return getattr(settings, 'WEBAUTHN_ORIGIN', 'http://127.0.0.1:3000')


def _configured_rp_id() -> str:
    return getattr(settings, 'WEBAUTHN_RP_ID', '127.0.0.1')


def _allowed_origins() -> set[str]:
    origins: set[str] = set()
    for raw in getattr(settings, 'CSRF_TRUSTED_ORIGINS', None) or []:
        if raw:
            origins.add(raw.rstrip('/'))
    origins.add(_configured_origin().rstrip('/'))
    # Variantes locales fréquentes en qualif
    for host in ('127.0.0.1', 'localhost'):
        for port in ('3000', '3001', '8091', '80', '443'):
            scheme = 'https' if port == '443' else 'http'
            if port in ('80', '443'):
                origins.add(f'{scheme}://{host}')
            else:
                origins.add(f'{scheme}://{host}:{port}')
    return origins


def _normalize_origin(value: str) -> Optional[str]:
    raw = (value or '').strip()
    if not raw:
        return None
    parsed = urlparse(raw)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname:
        return None
    # Origin = scheme://host[:port] (sans path)
    netloc = parsed.netloc
    return f'{parsed.scheme}://{netloc}'.rstrip('/')


def resolve_webauthn_rp(request: Optional[HttpRequest] = None) -> tuple[str, str]:
    """
    Retourne (rp_id, origin) alignés sur le navigateur.
    Priorité : Origin / Referer de la requête si autorisé, sinon config settings.
    """
    candidate: Optional[str] = None
    if request is not None:
        candidate = _normalize_origin(request.META.get('HTTP_ORIGIN', ''))
        if not candidate:
            candidate = _normalize_origin(request.META.get('HTTP_REFERER', ''))

    allowed = _allowed_origins()
    if candidate and candidate in allowed:
        hostname = urlparse(candidate).hostname or _configured_rp_id()
        return hostname, candidate

    # Fallback config
    return _configured_rp_id(), _configured_origin()


def _user_handle(user: User) -> bytes:
    return str(user.pk).encode('utf-8')


def passkey_enabled(user: User) -> bool:
    return WebAuthnCredential.objects.filter(user=user).exists()


def list_passkeys(user: User) -> list[dict[str, Any]]:
    return [
        {
            'id': cred.pk,
            'label': cred.label or f'Passkey #{cred.pk}',
            'created_at': cred.created_at.isoformat(),
            'last_used_at': cred.last_used_at.isoformat() if cred.last_used_at else None,
            'transports': cred.transports or [],
        }
        for cred in WebAuthnCredential.objects.filter(user=user)
    ]


def _exclude_descriptors(user: User) -> list[PublicKeyCredentialDescriptor]:
    out: list[PublicKeyCredentialDescriptor] = []
    for cred in WebAuthnCredential.objects.filter(user=user):
        transports = []
        for t in cred.transports or []:
            try:
                transports.append(AuthenticatorTransport(t))
            except ValueError:
                continue
        out.append(
            PublicKeyCredentialDescriptor(
                id=base64url_to_bytes(cred.credential_id),
                transports=transports or None,
            )
        )
    return out


def begin_registration(user: User, *, request: Optional[HttpRequest] = None) -> dict[str, Any]:
    rp_id, origin = resolve_webauthn_rp(request)
    options = generate_registration_options(
        rp_id=rp_id,
        rp_name=_rp_name(),
        user_id=_user_handle(user),
        user_name=user.email,
        user_display_name=user.get_full_name() or user.email,
        attestation=AttestationConveyancePreference.NONE,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.PREFERRED,
        ),
        exclude_credentials=_exclude_descriptors(user),
    )
    challenge_id = secrets.token_urlsafe(24)
    cache.set(
        f'{WEBAUTHN_REG_PREFIX}{challenge_id}',
        {
            'user_id': user.id,
            'challenge': bytes_to_base64url(options.challenge),
            'rp_id': rp_id,
            'origin': origin,
        },
        WEBAUTHN_CHALLENGE_TTL,
    )
    payload = json.loads(options_to_json(options))
    payload['challenge_id'] = challenge_id
    return payload


@transaction.atomic
def finish_registration(
    user: User,
    *,
    challenge_id: str,
    credential: dict[str, Any],
    label: str = '',
    exclude_jti: Optional[str] = None,
) -> WebAuthnCredential:
    cached = cache.get(f'{WEBAUTHN_REG_PREFIX}{challenge_id}')
    if not cached or int(cached.get('user_id') or 0) != user.id:
        raise AccountSecurityError('Cérémonie passkey expirée ou invalide.', code='challenge_expired')
    cache.delete(f'{WEBAUTHN_REG_PREFIX}{challenge_id}')
    rp_id = cached.get('rp_id') or _configured_rp_id()
    origin = cached.get('origin') or _configured_origin()
    try:
        verification = verify_registration_response(
            credential=credential,
            expected_challenge=base64url_to_bytes(cached['challenge']),
            expected_rp_id=rp_id,
            expected_origin=origin,
        )
    except Exception as exc:
        logger.info('Échec verify registration WebAuthn user=%s: %s', user.id, exc)
        raise AccountSecurityError('Enregistrement passkey invalide.') from exc

    cred_id = bytes_to_base64url(verification.credential_id)
    if WebAuthnCredential.objects.filter(credential_id=cred_id).exists():
        raise AccountSecurityError('Cette passkey est déjà enregistrée.')

    transports: list[str] = []
    resp = credential.get('response') or {}
    for t in resp.get('transports') or credential.get('transports') or []:
        if isinstance(t, str):
            transports.append(t)

    obj = WebAuthnCredential.objects.create(
        user=user,
        credential_id=cred_id,
        public_key=bytes_to_base64url(verification.credential_public_key),
        sign_count=int(verification.sign_count or 0),
        transports=transports,
        label=(label or '').strip()[:128],
    )
    revoke_other_sessions(user, exclude_jti=exclude_jti)
    return obj


def delete_passkey(user: User, credential_pk: int) -> bool:
    deleted, _ = WebAuthnCredential.objects.filter(user=user, pk=credential_pk).delete()
    return deleted > 0


def _auth_options_for_credentials(
    credentials: list[WebAuthnCredential],
    *,
    rp_id: str,
) -> Any:
    descriptors = []
    for cred in credentials:
        transports = []
        for t in cred.transports or []:
            try:
                transports.append(AuthenticatorTransport(t))
            except ValueError:
                continue
        descriptors.append(
            PublicKeyCredentialDescriptor(
                id=base64url_to_bytes(cred.credential_id),
                transports=transports or None,
            )
        )
    return generate_authentication_options(
        rp_id=rp_id,
        allow_credentials=descriptors or None,
        user_verification=UserVerificationRequirement.PREFERRED,
    )


def begin_authentication(
    *,
    email: Optional[str] = None,
    request: Optional[HttpRequest] = None,
) -> dict[str, Any]:
    """
    Begin login. Sans email = discoverable / conditional UI.
    Avec email = allowCredentials du compte si passkeys ; réponse toujours homogène.
    """
    rp_id, origin = resolve_webauthn_rp(request)
    credentials: list[WebAuthnCredential] = []
    user_id: Optional[int] = None
    cleaned = (email or '').strip()
    if cleaned:
        user = User.objects.filter(email__iexact=cleaned, is_active=True).first()
        if user:
            credentials = list(WebAuthnCredential.objects.filter(user=user))
            if credentials:
                user_id = user.id
        options = _auth_options_for_credentials(credentials, rp_id=rp_id)
    else:
        options = generate_authentication_options(
            rp_id=rp_id,
            user_verification=UserVerificationRequirement.PREFERRED,
        )

    challenge_id = secrets.token_urlsafe(24)
    cache.set(
        f'{WEBAUTHN_AUTH_PREFIX}{challenge_id}',
        {
            'user_id': user_id,
            'challenge': bytes_to_base64url(options.challenge),
            'email_scoped': bool(cleaned),
            'rp_id': rp_id,
            'origin': origin,
        },
        WEBAUTHN_CHALLENGE_TTL,
    )
    payload = json.loads(options_to_json(options))
    payload['challenge_id'] = challenge_id
    return payload


@transaction.atomic
def finish_authentication(
    *,
    challenge_id: str,
    credential: dict[str, Any],
) -> User:
    cached = cache.get(f'{WEBAUTHN_AUTH_PREFIX}{challenge_id}')
    if not cached:
        raise AccountSecurityError(GENERIC_AUTH_ERROR, status_code=401, code='challenge_expired')
    cache.delete(f'{WEBAUTHN_AUTH_PREFIX}{challenge_id}')

    raw_id = credential.get('id') or credential.get('rawId')
    if not raw_id or not isinstance(raw_id, str):
        raise AccountSecurityError(GENERIC_AUTH_ERROR, status_code=401)

    try:
        stored = WebAuthnCredential.objects.select_related('user').get(credential_id=raw_id)
    except WebAuthnCredential.DoesNotExist as exc:
        raise AccountSecurityError(GENERIC_AUTH_ERROR, status_code=401) from exc

    user = stored.user
    if not user.is_active:
        raise AccountSecurityError(GENERIC_AUTH_ERROR, status_code=401)

    expected_user_id = cached.get('user_id')
    if expected_user_id is not None and int(expected_user_id) != user.id:
        raise AccountSecurityError(GENERIC_AUTH_ERROR, status_code=401)

    stored_count = int(stored.sign_count or 0)
    rp_id = cached.get('rp_id') or _configured_rp_id()
    origin = cached.get('origin') or _configured_origin()
    try:
        # credential_current_sign_count=0 : désactive le rejet lib (passkeys sync → count 0)
        verification = verify_authentication_response(
            credential=credential,
            expected_challenge=base64url_to_bytes(cached['challenge']),
            expected_rp_id=rp_id,
            expected_origin=origin,
            credential_public_key=base64url_to_bytes(stored.public_key),
            credential_current_sign_count=0,
        )
    except Exception as exc:
        logger.info('Échec verify authentication WebAuthn cred=%s: %s', stored.pk, exc)
        raise AccountSecurityError(GENERIC_AUTH_ERROR, status_code=401) from exc

    reported = int(verification.new_sign_count or 0)
    if stored_count > 0 and reported > 0 and reported <= stored_count:
        logger.warning(
            'WebAuthn sign_count suspect user=%s cred=%s stored=%s reported=%s',
            user.id,
            stored.pk,
            stored_count,
            reported,
        )
    stored.sign_count = reported
    stored.last_used_at = timezone.now()
    stored.save(update_fields=['sign_count', 'last_used_at'])
    return user


METHOD_PASSKEY = LoginHistory.METHOD_PASSKEY
