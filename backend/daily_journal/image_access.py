"""Jetons signés pour l'affichage des images du journal (URLs sans cookie ni en-tête Authorization)."""
from __future__ import annotations

from django.core import signing

SIGN_SALT = 'daily_journal.image_file'
SIGN_MAX_AGE = 7 * 24 * 3600


def sign_journal_image_payload(image_id: int, user_id: int) -> str:
    return signing.dumps({'i': image_id, 'u': user_id}, salt=SIGN_SALT)


def load_journal_image_payload(token: str) -> dict:
    """Lève signing.BadSignature ou signing.SignatureExpired si le jeton est invalide ou expiré."""
    return signing.loads(token, salt=SIGN_SALT, max_age=SIGN_MAX_AGE)
