"""Utilitaires fuseau horaire utilisateur (partagés views + services)."""
from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Optional

import pytz
from django.utils import timezone as dj_timezone

logger = logging.getLogger(__name__)

DEFAULT_USER_TIMEZONE = 'Europe/Paris'


def get_timezone_for_user(user):
    """
    Récupère le timezone d'un utilisateur depuis ses préférences.
    Retourne un objet pytz.timezone.
    Fallback sur Europe/Paris si non défini ou invalide.
    """
    user_timezone = getattr(getattr(user, 'preferences', None), 'timezone', None)
    try:
        return pytz.timezone(user_timezone) if user_timezone else pytz.timezone(DEFAULT_USER_TIMEZONE)
    except pytz.exceptions.UnknownTimeZoneError:
        logger.warning(
            'Timezone inconnue: %s, utilisation de Europe/Paris par défaut',
            user_timezone,
        )
        return pytz.timezone(DEFAULT_USER_TIMEZONE)
    except Exception as exc:
        logger.error('Erreur lors de la configuration de la timezone: %s', exc)
        return pytz.timezone(DEFAULT_USER_TIMEZONE)


def get_user_timezone(request):
    """
    Récupère le timezone de l'utilisateur de la requête depuis ses préférences.
    Retourne un objet pytz.timezone.
    Fallback sur Europe/Paris si non défini ou invalide.
    """
    return get_timezone_for_user(request.user)


def local_trade_day(entered_at: Optional[datetime], tz) -> Optional[date]:
    """
    Jour calendaire d'un trade : date de entered_at dans le fuseau `tz`.
    Un datetime naïf est interprété dans le fuseau par défaut de Django (comme l'ORM).
    """
    if entered_at is None:
        return None
    if dj_timezone.is_naive(entered_at):
        entered_at = dj_timezone.make_aware(entered_at, dj_timezone.get_default_timezone())
    return entered_at.astimezone(tz).date()
