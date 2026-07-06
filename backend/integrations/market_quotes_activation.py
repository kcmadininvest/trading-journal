"""Bootstrap du hub cours à la demande (API ou WebSocket)."""
from __future__ import annotations

from integrations.market_quotes_hub_control import ensure_market_quotes_hub
from integrations.market_quotes_service import (
    build_empty_snapshot,
    load_snapshot,
    save_snapshot,
    user_has_quotes_credentials,
)
from integrations.topstep_api_pause import is_topstep_api_paused


def bootstrap_market_quotes_for_user(user) -> None:
    """
    Démarre le worker TopStep pour cet utilisateur si besoin et pose un état « connecting »
    tant qu'aucun cours n'est encore disponible.
    """
    if not user_has_quotes_credentials(user):
        return

    if is_topstep_api_paused(user):
        user_id = user.id
        cached = load_snapshot(user_id)
        if cached.get('message') != 'topstep_api_paused':
            save_snapshot(
                build_empty_snapshot(connected=False, message='topstep_api_paused'),
                user_id,
            )
        return

    user_id = user.id
    cached = load_snapshot(user_id)
    has_prices = any(q.get('last_price_display') for q in (cached.get('quotes') or []))
    message = cached.get('message')

    if cached.get('connected'):
        ensure_market_quotes_hub(user_id)
        return

    stale = message in (
        'market_quotes_unavailable',
        'market_quotes_disconnected',
        'topstep_api_paused',
        None,
    )
    if stale and message != 'missing_credentials' and not has_prices:
        save_snapshot(build_empty_snapshot(connected=False, message='connecting'), user_id)

    ensure_market_quotes_hub(user_id)
