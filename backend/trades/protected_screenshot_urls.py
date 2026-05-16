"""Jetons signés pour servir les fichiers sous media/screenshots/ sans accès HTTP direct."""
from __future__ import annotations

from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlencode

from django.conf import settings
from django.core import signing
from django.http import FileResponse, HttpResponseNotFound
from django.urls import reverse


SIGN_SALT = 'trades.screenshots_media'
SIGN_MAX_AGE = 7 * 24 * 3600


def _relative_under_media_from_url(url: str) -> Optional[str]:
    if not url or not isinstance(url, str):
        return None
    u = url.strip()
    if u.startswith('/media/'):
        return u[len('/media/'):].lstrip('/').split('?', 1)[0]
    marker = '/media/'
    if marker in u:
        tail = u[u.index(marker) + len(marker) :].lstrip('/')
        return tail.split('?', 1)[0]
    return None


def rel_is_user_screenshot(rel: str, user_id: int) -> bool:
    if not rel or '..' in rel or rel.startswith(('/', '\\')):
        return False
    parts = rel.replace('\\', '/').split('/')
    if len(parts) < 2:
        return False
    if parts[0] != 'screenshots':
        return False
    return parts[1] == str(int(user_id))


def sign_screenshot_media_token(relative_under_media: str, user_id: int) -> str:
    return signing.dumps({'r': relative_under_media, 'u': int(user_id)}, salt=SIGN_SALT)


def verify_screenshot_media_token(token: str) -> dict[str, Any]:
    return signing.loads(token, salt=SIGN_SALT, max_age=SIGN_MAX_AGE)


def build_signed_screenshot_api_url(request, relative_under_media: str, user_id: int) -> str:
    raw = sign_screenshot_media_token(relative_under_media, user_id)
    path = reverse('trades:protected-screenshot-media')
    rel = f'{path}?{urlencode({"s": raw})}'
    return request.build_absolute_uri(rel)


def transform_screenshot_url_for_response(url: str, owner_user_id: int, request) -> str:
    """
    Remplace /media/screenshots/<owner>/... par une URL API signée.
    Les URLs externes ou autres chemins media sont renvoyés tels quels.
    """
    if not url or not request or not owner_user_id:
        return url or ''
    rel = _relative_under_media_from_url(url)
    if rel is None:
        return url
    if not rel_is_user_screenshot(rel, owner_user_id):
        return url
    return build_signed_screenshot_api_url(request, rel, owner_user_id)


def resolve_screenshot_file_or_none(relative_under_media: str, user_id: int) -> Optional[Path]:
    if not rel_is_user_screenshot(relative_under_media, user_id):
        return None
    root = Path(settings.MEDIA_ROOT).resolve()
    target = (root / relative_under_media).resolve()
    try:
        target.relative_to(root)
    except ValueError:
        return None
    if not target.is_file():
        return None
    return target


def normalize_screenshot_url_for_storage(value, user_id) -> str:
    """
    Les réponses API exposent des URL signées (longues). À l'enregistrement, on stocke
    le chemin canonique /media/screenshots/... pour respecter la limite BDD (200 car.).
    """
    if not value:
        return ''
    value = str(value).strip()
    if not value or user_id is None:
        return value
    canonical = resolve_screenshot_url_for_delete(value, int(user_id))
    return canonical if canonical else value


def resolve_screenshot_url_for_delete(url: str, user_id: int) -> Optional[str]:
    """
    Accepte une URL /media/screenshots/... ou une URL API signée (protected-screenshot).
    Retourne une URL de style /media/... utilisable par ImageProcessor.delete_screenshot, ou None.
    """
    from urllib.parse import parse_qs, urlparse

    if not url or not isinstance(url, str):
        return None
    raw = url.strip()
    parsed = urlparse(raw)
    path = parsed.path or raw
    if 'protected-screenshot' in path and parsed.query:
        token = (parse_qs(parsed.query).get('s') or [None])[0]
        if not token:
            return None
        try:
            payload = verify_screenshot_media_token(token)
        except (signing.BadSignature, signing.SignatureExpired):
            return None
        rel = payload.get('r')
        uid = payload.get('u')
        if rel is None or uid is None or int(uid) != int(user_id):
            return None
        if not rel_is_user_screenshot(str(rel), user_id):
            return None
        return f'/media/{rel}'
    rel = _relative_under_media_from_url(raw)
    if rel and rel_is_user_screenshot(rel, user_id):
        return f'/media/{rel}'
    return None
