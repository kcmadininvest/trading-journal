"""Garde pause API TopStepX (une session concurrente par compte)."""
from __future__ import annotations

from integrations.topstepx_client import TopStepXApiError

TOPSTEP_API_PAUSED_CODE = 'topstep_api_paused'
TOPSTEP_API_PAUSED_MESSAGE = (
    'API TopStep en pause. Réactivez-la depuis le dashboard ou les paramètres.'
)


def is_topstep_api_paused(user) -> bool:
    from accounts.models import UserPreferences

    try:
        prefs = UserPreferences.objects.get(user=user)
    except UserPreferences.DoesNotExist:
        return True
    return bool(prefs.topstep_api_paused)


def assert_topstep_api_allowed(user) -> None:
    if is_topstep_api_paused(user):
        raise TopStepXApiError(
            TOPSTEP_API_PAUSED_MESSAGE,
            error_code=TOPSTEP_API_PAUSED_CODE,
        )
