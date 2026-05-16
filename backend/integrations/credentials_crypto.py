"""Chiffrement Fernet pour les secrets d'intégration API utilisateur."""
from __future__ import annotations

import base64
import hashlib
import json
from typing import Any

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


def _fernet_key_bytes() -> bytes:
    raw = getattr(settings, 'INTEGRATIONS_CREDENTIALS_KEY', None) or settings.SECRET_KEY
    digest = hashlib.sha256(str(raw).encode('utf-8')).digest()
    return base64.urlsafe_b64encode(digest)


def _get_fernet() -> Fernet:
    return Fernet(_fernet_key_bytes())


def encrypt_json(data: dict[str, Any]) -> str:
    payload = json.dumps(data, separators=(',', ':')).encode('utf-8')
    return _get_fernet().encrypt(payload).decode('ascii')


def decrypt_json(token: str) -> dict[str, Any]:
    try:
        payload = _get_fernet().decrypt(token.encode('ascii'))
    except InvalidToken as exc:
        raise ImproperlyConfigured('Impossible de déchiffrer les identifiants d\'intégration.') from exc
    parsed = json.loads(payload.decode('utf-8'))
    if not isinstance(parsed, dict):
        raise ImproperlyConfigured('Format de secrets d\'intégration invalide.')
    return parsed


def build_secrets_hint(secrets: dict[str, str]) -> dict[str, str]:
    hints: dict[str, str] = {}
    for key, value in secrets.items():
        if not value:
            continue
        tail = value[-4:] if len(value) >= 4 else value
        hints[key] = f'****{tail}'
    return hints
