"""Handlers d'exceptions DRF (messages utilisateur plus clairs)."""
from __future__ import annotations

from typing import Any, Optional

from rest_framework.exceptions import Throttled
from rest_framework.response import Response
from rest_framework.views import exception_handler


def _throttle_wait_seconds(exc: Throttled) -> Optional[int]:
    wait = getattr(exc, 'wait', None)
    if wait is None:
        return None
    try:
        seconds = int(wait)
    except (TypeError, ValueError):
        return None
    return max(seconds, 0)


def custom_exception_handler(exc: Exception, context: dict[str, Any]) -> Optional[Response]:
    response = exception_handler(exc, context)
    if response is None or not isinstance(exc, Throttled):
        return response

    wait = _throttle_wait_seconds(exc)
    if wait is not None and wait > 0:
        detail = (
            'Trop de tentatives. Ce n’est pas un bug : pour votre sécurité, '
            f'réessayez dans environ {wait} seconde{"s" if wait != 1 else ""}.'
        )
    else:
        detail = (
            'Trop de tentatives. Ce n’est pas un bug : pour votre sécurité, '
            'réessayez dans une minute.'
        )

    response.data = {
        'detail': detail,
        'code': 'throttled',
        'wait': wait,
    }
    return response
