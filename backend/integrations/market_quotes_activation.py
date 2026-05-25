"""Bootstrap du hub cours à la demande (API ou WebSocket)."""
from __future__ import annotations

from integrations.market_quotes_hub_control import ensure_market_quotes_hub
from integrations.market_quotes_service import (
    build_empty_snapshot,
    load_snapshot,
    save_snapshot,
    user_has_quotes_credentials,
)


def bootstrap_market_quotes_for_user(user) -> None:
    """
    Démarre le worker TopStep pour cet utilisateur si besoin et pose un état « connecting »
    tant qu'aucun cours n'est encore disponible.
    """
    if not user_has_quotes_credentials(user):
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
        None,
    )
    if stale and message != 'missing_credentials' and not has_prices:
        save_snapshot(build_empty_snapshot(connected=False, message='connecting'), user_id)

    ensure_market_quotes_hub(user_id)
