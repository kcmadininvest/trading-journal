"""Chiffrement TOTP et empreintes codes de secours."""
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import string

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


ALPHABET = string.ascii_uppercase + string.digits


def _auth_fernet_key_bytes() -> bytes:
    raw = getattr(settings, 'ACCOUNT_AUTH_SECRETS_KEY', None) or settings.SECRET_KEY
    digest = hashlib.sha256(f'account-auth-secrets:{raw}'.encode('utf-8')).digest()
    return base64.urlsafe_b64encode(digest)


def _get_fernet() -> Fernet:
    return Fernet(_auth_fernet_key_bytes())


def encrypt_totp_secret(secret: str) -> str:
    return _get_fernet().encrypt(secret.encode('utf-8')).decode('ascii')


def decrypt_totp_secret(token: str) -> str:
    try:
        return _get_fernet().decrypt(token.encode('ascii')).decode('utf-8')
    except InvalidToken as exc:
        raise ImproperlyConfigured('Impossible de lire le secret TOTP.') from exc


def _backup_pepper() -> bytes:
    raw = getattr(settings, 'ACCOUNT_AUTH_SECRETS_KEY', None) or settings.SECRET_KEY
    return hashlib.sha256(f'account-backup-codes:{raw}'.encode('utf-8')).digest()


def hash_backup_code(code: str) -> str:
    normalized = ''.join(c for c in code.upper() if c.isalnum())
    digest = hmac.new(_backup_pepper(), normalized.encode('utf-8'), hashlib.sha256).hexdigest()
    return digest


def check_backup_code(code: str, code_hash: str) -> bool:
    return hmac.compare_digest(hash_backup_code(code), code_hash)


def generate_backup_codes(count: int = 10) -> list[str]:
    codes = []
    for _ in range(count):
        chunk = ''.join(secrets.choice(ALPHABET) for _ in range(16))
        codes.append(f'{chunk[:4]}-{chunk[4:8]}-{chunk[8:12]}-{chunk[12:16]}')
    return codes
