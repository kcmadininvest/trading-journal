"""Consumers WebSocket Channels."""
from __future__ import annotations

import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from accounts.jwt_blacklist_cache import is_jti_blacklisted
from accounts.jwt_cookies import ACCESS_COOKIE_NAME
from integrations.market_quotes_activation import bootstrap_market_quotes_for_user
from integrations.market_quotes_hub_control import signal_user_active, signal_user_inactive
from integrations.market_quotes_service import channel_group_name, load_snapshot

logger = logging.getLogger(__name__)


def _resolve_user_from_token_sync(token_str: str):
    from django.contrib.auth import get_user_model

    token = AccessToken(token_str)
    jti = token.get('jti')
    if jti and is_jti_blacklisted(str(jti)):
        raise TokenError('Token has been blacklisted')
    user_id = token.get('user_id')
    if user_id is None:
        raise TokenError('user_id absent')
    User = get_user_model()
    return User.objects.get(pk=int(user_id))


_get_user_from_token = database_sync_to_async(_resolve_user_from_token_sync)


def _cookies_from_scope(scope) -> dict[str, str]:
    headers = dict(scope.get('headers') or [])
    raw = headers.get(b'cookie') or headers.get('cookie')
    if not raw:
        return {}
    if isinstance(raw, bytes):
        raw = raw.decode()
    cookies: dict[str, str] = {}
    for part in raw.split(';'):
        part = part.strip()
        if not part or '=' not in part:
            continue
        name, value = part.split('=', 1)
        cookies[name.strip()] = value.strip()
    return cookies


def _extract_ws_token(scope) -> tuple[str | None, str | None]:
    """
    Retourne (token, subprotocol_à_accepter).
    Cookie tj_access uniquement (plus de query ?token= ni subprotocol access_token.*).
    """
    cookie_token = _cookies_from_scope(scope).get(ACCESS_COOKIE_NAME)
    if cookie_token:
        return cookie_token, None
    return None, None


class MarketQuotesConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self) -> None:
        token_str, chosen_subprotocol = _extract_ws_token(self.scope)
        if not token_str:
            await self.close(code=4401)
            return

        try:
            self.user = await _get_user_from_token(token_str)
        except Exception:
            await self.close(code=4401)
            return

        self._group = channel_group_name(self.user.id)
        await self.channel_layer.group_add(self._group, self.channel_name)
        if chosen_subprotocol:
            await self.accept(subprotocol=chosen_subprotocol)
        else:
            await self.accept()

        await database_sync_to_async(bootstrap_market_quotes_for_user)(self.user)
        await database_sync_to_async(signal_user_active)(self.user.id)
        snapshot = await database_sync_to_async(load_snapshot)(self.user.id)
        await self.send_json(snapshot)

    async def disconnect(self, close_code) -> None:
        if hasattr(self, '_group'):
            await self.channel_layer.group_discard(self._group, self.channel_name)
        if hasattr(self, 'user'):
            await database_sync_to_async(signal_user_inactive)(self.user.id)

    async def quotes_snapshot(self, event) -> None:
        await self.send_json(event['payload'])
