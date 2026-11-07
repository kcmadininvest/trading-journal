"""Cookies JWT HttpOnly (tj_access / tj_refresh)."""
from __future__ import annotations

from datetime import timedelta
from typing import Optional

from django.conf import settings
from rest_framework.response import Response
from rest_framework_simplejwt.settings import api_settings as jwt_api_settings

ACCESS_COOKIE_NAME = 'tj_access'
REFRESH_COOKIE_NAME = 'tj_refresh'


def _cookie_secure() -> bool:
    return not getattr(settings, 'DEBUG', False)


def _cookie_samesite() -> str:
    return 'Lax'


def access_max_age() -> int:
    lifetime = jwt_api_settings.ACCESS_TOKEN_LIFETIME
    if isinstance(lifetime, timedelta):
        return int(lifetime.total_seconds())
    return 3600


def refresh_max_age() -> int:
    lifetime = jwt_api_settings.REFRESH_TOKEN_LIFETIME
    if isinstance(lifetime, timedelta):
        return int(lifetime.total_seconds())
    return 14400


def set_jwt_cookies(
    response: Response,
    access: Optional[str] = None,
    refresh: Optional[str] = None,
) -> Response:
    secure = _cookie_secure()
    samesite = _cookie_samesite()
    if access:
        response.set_cookie(
            ACCESS_COOKIE_NAME,
            access,
            max_age=access_max_age(),
            httponly=True,
            secure=secure,
            samesite=samesite,
            path='/',
        )
    if refresh:
        response.set_cookie(
            REFRESH_COOKIE_NAME,
            refresh,
            max_age=refresh_max_age(),
            httponly=True,
            secure=secure,
            samesite=samesite,
            path='/',
        )
    return response


def clear_jwt_cookies(response: Response) -> Response:
    """Efface tj_access / tj_refresh.

    Django 4.2 ``delete_cookie`` n'accepte pas ``secure=`` (ajouté en 5.0).
    On expire donc via ``set_cookie`` pour pouvoir conserver ``secure`` / ``httponly``
    (requis pour supprimer des cookies Secure en production).
    """
    secure = _cookie_secure()
    samesite = _cookie_samesite()
    for name in (ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME):
        response.set_cookie(
            name,
            value='',
            max_age=0,
            expires='Thu, 01 Jan 1970 00:00:00 GMT',
            path='/',
            secure=secure,
            httponly=True,
            samesite=samesite,
        )
    return response


def strip_tokens_from_response_data(data) -> dict:
    if not isinstance(data, dict):
        return {}
    cleaned = dict(data)
    cleaned.pop('access', None)
    cleaned.pop('refresh', None)
    return cleaned
