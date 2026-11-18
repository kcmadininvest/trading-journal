"""Logique métier : TOTP, codes de secours, récupération 2FA (passkeys → account_webauthn)."""
from __future__ import annotations

import base64
import io
import logging
import secrets
from datetime import timedelta
from typing import Any, Optional, Tuple

import pyotp
import qrcode
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from .account_security_crypto import (
    check_backup_code,
    decrypt_totp_secret,
    encrypt_totp_secret,
    generate_backup_codes,
    hash_backup_code,
)
from .jwt_blacklist_cache import safe_blacklist_user_refresh_tokens
from .models import (
    BackupCode,
    LoginHistory,
    TotpDevice,
    TwoFactorRecoveryRequest,
    User,
)

logger = logging.getLogger(__name__)

CHALLENGE_TTL_SECONDS = 300
CHALLENGE_MAX_FAILURES = 5
TOTP_LOCK_SECONDS = 900
CHALLENGE_CACHE_PREFIX = 'login_2fa_challenge:'
TOTP_LOCK_CACHE_PREFIX = 'login_2fa_lock:'
USED_TOTP_CACHE_PREFIX = 'login_2fa_used_code:'

GENERIC_AUTH_ERROR = 'Identifiants incorrects.'
GENERIC_2FA_ERROR = 'Code invalide.'
GENERIC_2FA_LOCKED = 'Trop de tentatives. Réessayez dans 15 minutes.'
GENERIC_RECOVERY_MESSAGE = (
    'Si un compte avec 2FA existe pour cette adresse, un email de récupération a été envoyé.'
)


class AccountSecurityError(Exception):
    def __init__(self, message: str, *, status_code: int = 400, code: str = 'invalid'):
        self.message = message
        self.status_code = status_code
        self.code = code
        super().__init__(message)


def totp_enabled(user: User) -> bool:
    return TotpDevice.objects.filter(user=user, enabled=True).exists()


def security_status(user: User) -> dict[str, Any]:
    from .account_webauthn import list_passkeys, passkey_enabled

    device = TotpDevice.objects.filter(user=user).first()
    unused_backup = BackupCode.objects.filter(user=user, used_at__isnull=True).count()
    pending_recovery = (
        TwoFactorRecoveryRequest.objects.filter(
            user=user,
            completed_at__isnull=True,
            cancelled_at__isnull=True,
            expires_at__gt=timezone.now(),
        )
        .order_by('-created_at')
        .first()
    )
    passkeys = list_passkeys(user)
    return {
        'passkey_enabled': passkey_enabled(user),
        'passkeys': passkeys,
        'totp_enabled': bool(device and device.enabled),
        'totp_pending': bool(device and not device.enabled),
        'backup_codes_remaining': unused_backup if (device and device.enabled) else 0,
        'recovery_pending': pending_recovery is not None,
        'recovery_usable_from': (
            pending_recovery.usable_from.isoformat() if pending_recovery else None
        ),
        'recovery_expires_at': (
            pending_recovery.expires_at.isoformat() if pending_recovery else None
        ),
    }


def destroy_totp(user: User) -> None:
    TotpDevice.objects.filter(user=user).delete()
    BackupCode.objects.filter(user=user).delete()


def cancel_pending_totp(user: User) -> None:
    """Supprime uniquement une configuration TOTP non confirmée."""
    device = TotpDevice.objects.filter(user=user).first()
    if not device:
        return
    if device.enabled:
        raise AccountSecurityError(
            'Le 2FA est déjà actif. Utilisez la désactivation.',
            code='totp_already_enabled',
        )
    TotpDevice.objects.filter(user=user, enabled=False).delete()
    BackupCode.objects.filter(user=user).delete()


def revoke_other_sessions(user: User, *, exclude_jti: Optional[str] = None) -> None:
    safe_blacklist_user_refresh_tokens(user, exclude_jti=exclude_jti)


def _issuer_name() -> str:
    return getattr(settings, 'TOTP_ISSUER_NAME', 'K&C Trading Journal')


def _otpauth_uri(user: User, secret: str) -> str:
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=user.email, issuer_name=_issuer_name())


def _qr_data_url(otpauth_uri: str) -> str:
    img = qrcode.make(otpauth_uri)
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    encoded = base64.b64encode(buffer.getvalue()).decode('ascii')
    return f'data:image/png;base64,{encoded}'


@transaction.atomic
def begin_totp_setup(user: User, *, exclude_jti: Optional[str] = None) -> dict[str, str]:
    del exclude_jti  # sessions non révoquées au begin
    secret = pyotp.random_base32()
    TotpDevice.objects.filter(user=user).delete()
    TotpDevice.objects.create(
        user=user,
        secret_encrypted=encrypt_totp_secret(secret),
        enabled=False,
    )
    uri = _otpauth_uri(user, secret)
    return {
        'secret': secret,
        'otpauth_uri': uri,
        'qr_data_url': _qr_data_url(uri),
    }


def _replace_backup_codes(user: User) -> list[str]:
    BackupCode.objects.filter(user=user).delete()
    codes = generate_backup_codes(10)
    BackupCode.objects.bulk_create(
        [BackupCode(user=user, code_hash=hash_backup_code(code)) for code in codes]
    )
    return codes


@transaction.atomic
def confirm_totp_setup(user: User, code: str, *, exclude_jti: Optional[str] = None) -> list[str]:
    try:
        device = TotpDevice.objects.select_for_update().get(user=user)
    except TotpDevice.DoesNotExist as exc:
        raise AccountSecurityError('Aucune configuration 2FA en cours.') from exc
    if device.enabled:
        raise AccountSecurityError('Le 2FA est déjà actif.')
    try:
        secret = decrypt_totp_secret(device.secret_encrypted)
    except Exception as exc:
        raise AccountSecurityError(
            'Configuration 2FA illisible. Relancez l\'activation.',
            code='totp_decrypt_failed',
        ) from exc
    if not pyotp.TOTP(secret).verify(code.strip(), valid_window=1):
        raise AccountSecurityError(GENERIC_2FA_ERROR)
    device.enabled = True
    device.confirmed_at = timezone.now()
    device.save(update_fields=['enabled', 'confirmed_at', 'updated_at'])
    codes = _replace_backup_codes(user)
    revoke_other_sessions(user, exclude_jti=exclude_jti)
    return codes


def verify_user_second_factor(user: User, code: str) -> str:
    if is_totp_locked(user.id):
        raise AccountSecurityError(GENERIC_2FA_LOCKED, status_code=429, code='locked')
    cleaned = (code or '').strip()
    if not cleaned:
        raise AccountSecurityError(GENERIC_2FA_ERROR)

    if '-' in cleaned or len(cleaned) > 6:
        with transaction.atomic():
            for backup in BackupCode.objects.select_for_update().filter(
                user=user, used_at__isnull=True
            ):
                if check_backup_code(cleaned, backup.code_hash):
                    backup.used_at = timezone.now()
                    backup.save(update_fields=['used_at'])
                    return LoginHistory.METHOD_BACKUP_CODE
        raise AccountSecurityError(GENERIC_2FA_ERROR)

    try:
        device = TotpDevice.objects.get(user=user, enabled=True)
        secret = decrypt_totp_secret(device.secret_encrypted)
    except Exception as exc:
        raise AccountSecurityError(GENERIC_2FA_ERROR) from exc
    if not pyotp.TOTP(secret).verify(cleaned, valid_window=1):
        raise AccountSecurityError(GENERIC_2FA_ERROR)
    if not _mark_totp_used(user.id, cleaned):
        raise AccountSecurityError(GENERIC_2FA_ERROR)
    return LoginHistory.METHOD_TOTP


@transaction.atomic
def disable_totp(user: User, *, exclude_jti: Optional[str] = None) -> None:
    destroy_totp(user)
    revoke_other_sessions(user, exclude_jti=exclude_jti)


@transaction.atomic
def regenerate_backup_codes(user: User, *, exclude_jti: Optional[str] = None) -> list[str]:
    if not totp_enabled(user):
        raise AccountSecurityError('Le 2FA n\'est pas actif.')
    codes = _replace_backup_codes(user)
    revoke_other_sessions(user, exclude_jti=exclude_jti)
    return codes


def _challenge_key(token: str) -> str:
    return f'{CHALLENGE_CACHE_PREFIX}{token}'


def _lock_key(user_id: int) -> str:
    return f'{TOTP_LOCK_CACHE_PREFIX}{user_id}'


def is_totp_locked(user_id: int) -> bool:
    return bool(cache.get(_lock_key(user_id)))


def create_2fa_challenge(user: User, *, primary_method: str) -> str:
    if is_totp_locked(user.id):
        raise AccountSecurityError(GENERIC_2FA_LOCKED, status_code=429, code='locked')
    token = secrets.token_urlsafe(32)
    cache.set(
        _challenge_key(token),
        {
            'user_id': user.id,
            'primary_method': primary_method,
            'failures': 0,
        },
        CHALLENGE_TTL_SECONDS,
    )
    return token


def _load_challenge(token: str) -> dict[str, Any]:
    data = cache.get(_challenge_key(token))
    if not data:
        raise AccountSecurityError(GENERIC_2FA_ERROR, code='challenge_expired')
    return data


def _save_challenge(token: str, data: dict[str, Any]) -> None:
    cache.set(_challenge_key(token), data, CHALLENGE_TTL_SECONDS)


def _fail_challenge(token: str, data: dict[str, Any]) -> None:
    data['failures'] = int(data.get('failures') or 0) + 1
    if data['failures'] >= CHALLENGE_MAX_FAILURES:
        cache.delete(_challenge_key(token))
        cache.set(_lock_key(int(data['user_id'])), True, TOTP_LOCK_SECONDS)
        raise AccountSecurityError(GENERIC_2FA_LOCKED, status_code=429, code='locked')
    _save_challenge(token, data)
    raise AccountSecurityError(GENERIC_2FA_ERROR)


def _mark_totp_used(user_id: int, code: str) -> bool:
    key = f'{USED_TOTP_CACHE_PREFIX}{user_id}:{code}'
    if cache.get(key):
        return False
    cache.set(key, True, 90)
    return True


@transaction.atomic
def verify_2fa_challenge(token: str, code: str) -> Tuple[User, str]:
    data = _load_challenge(token)
    user_id = int(data['user_id'])
    if is_totp_locked(user_id):
        cache.delete(_challenge_key(token))
        raise AccountSecurityError(GENERIC_2FA_LOCKED, status_code=429, code='locked')

    try:
        user = User.objects.get(pk=user_id, is_active=True)
    except User.DoesNotExist as exc:
        cache.delete(_challenge_key(token))
        raise AccountSecurityError(GENERIC_2FA_ERROR) from exc

    cleaned = (code or '').strip()
    method = LoginHistory.METHOD_TOTP

    if '-' in cleaned or len(cleaned) > 6:
        method = LoginHistory.METHOD_BACKUP_CODE
        matched = None
        for backup in BackupCode.objects.select_for_update().filter(
            user=user, used_at__isnull=True
        ):
            if check_backup_code(cleaned, backup.code_hash):
                matched = backup
                break
        if matched is None:
            _fail_challenge(token, data)
        matched.used_at = timezone.now()
        matched.save(update_fields=['used_at'])
    else:
        try:
            device = TotpDevice.objects.get(user=user, enabled=True)
            secret = decrypt_totp_secret(device.secret_encrypted)
        except Exception:
            _fail_challenge(token, data)
        if not pyotp.TOTP(secret).verify(cleaned, valid_window=1):
            _fail_challenge(token, data)
        if not _mark_totp_used(user.id, cleaned):
            _fail_challenge(token, data)

    TwoFactorRecoveryRequest.objects.filter(
        user=user,
        completed_at__isnull=True,
        cancelled_at__isnull=True,
    ).update(cancelled_at=timezone.now())

    cache.delete(_challenge_key(token))
    # Enregistrer le 2e facteur réellement utilisé (totp / backup_code), pas le primary.
    return user, method


def create_recovery_request(user: User) -> TwoFactorRecoveryRequest:
    now = timezone.now()
    existing = (
        TwoFactorRecoveryRequest.objects.filter(
            user=user,
            completed_at__isnull=True,
            cancelled_at__isnull=True,
            expires_at__gt=now,
        )
        .order_by('-created_at')
        .first()
    )
    if existing:
        return existing
    return TwoFactorRecoveryRequest.objects.create(
        user=user,
        usable_from=now + timedelta(hours=1),
        expires_at=now + timedelta(hours=2),
    )


@transaction.atomic
def complete_recovery(token) -> User:
    try:
        req = TwoFactorRecoveryRequest.objects.select_related('user').select_for_update().get(
            token=token
        )
    except TwoFactorRecoveryRequest.DoesNotExist as exc:
        raise AccountSecurityError('Lien de récupération invalide ou expiré.') from exc
    if not req.is_usable_now():
        raise AccountSecurityError('Lien de récupération invalide ou expiré.')
    user = req.user
    destroy_totp(user)
    revoke_other_sessions(user, exclude_jti=None)
    req.completed_at = timezone.now()
    req.save(update_fields=['completed_at'])
    return user


def cancel_recovery_by_token(cancel_token) -> bool:
    try:
        req = TwoFactorRecoveryRequest.objects.get(cancel_token=cancel_token)
    except TwoFactorRecoveryRequest.DoesNotExist:
        return False
    if not req.is_pending():
        return False
    req.cancelled_at = timezone.now()
    req.save(update_fields=['cancelled_at'])
    return True


def cancel_pending_recovery_for_user(user: User) -> int:
    return TwoFactorRecoveryRequest.objects.filter(
        user=user,
        completed_at__isnull=True,
        cancelled_at__isnull=True,
    ).update(cancelled_at=timezone.now())


def record_login(
    user: Optional[User],
    *,
    success: bool,
    method: str,
    ip_address: Optional[str],
    user_agent: str,
) -> None:
    if not user:
        return
    from .utils import normalize_client_ip

    # Ne jamais perdre la ligne d'historique à cause d'une IP proxy invalide.
    safe_ip = normalize_client_ip(ip_address)
    try:
        LoginHistory.objects.create(
            user=user,
            ip_address=safe_ip,
            user_agent=user_agent or '',
            success=success,
            method=method or LoginHistory.METHOD_UNKNOWN,
        )
    except Exception as exc:
        logger.warning('Impossible d\'enregistrer LoginHistory: %s', exc)
