"""Utilitaires fuseau horaire utilisateur (partagés views + services)."""
from __future__ import annotations

import logging

import pytz

logger = logging.getLogger(__name__)


def get_user_timezone(request):
    """
    Récupère le timezone de l'utilisateur depuis ses préférences.
    Retourne un objet pytz.timezone.
    Fallback sur Europe/Paris si non défini ou invalide.
    """
    user_timezone = getattr(getattr(request.user, 'preferences', None), 'timezone', None)
    try:
        return pytz.timezone(user_timezone) if user_timezone else pytz.timezone('Europe/Paris')
    except pytz.exceptions.UnknownTimeZoneError:
        logger.warning(
            'Timezone inconnue: %s, utilisation de Europe/Paris par défaut',
            user_timezone,
        )
        return pytz.timezone('Europe/Paris')
    except Exception as exc:
        logger.error('Erreur lors de la configuration de la timezone: %s', exc)
        return pytz.timezone('Europe/Paris')
