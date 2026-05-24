"""Consumers WebSocket Channels."""
from __future__ import annotations

import logging
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from integrations.market_quotes_activation import bootstrap_market_quotes_for_user
from integrations.market_quotes_hub_control import signal_user_active, signal_user_inactive
from integrations.market_quotes_service import channel_group_name, load_snapshot

logger = logging.getLogger(__name__)


@database_sync_to_async
def _get_user_from_token(token_str: str):
    from django.contrib.auth import get_user_model

    token = AccessToken(token_str)
    user_id = token.get('user_id')
    if user_id is None:
        raise TokenError('user_id absent')
    User = get_user_model()
    return User.objects.get(pk=int(user_id))


class MarketQuotesConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self) -> None:
        raw_qs = self.scope.get('query_string', b'')
        if isinstance(raw_qs, bytes):
            raw_qs = raw_qs.decode()
        query = parse_qs(raw_qs)
        token_list = query.get('token') or []
        if not token_list or not token_list[0]:
            await self.close(code=4401)
            return

        try:
            self.user = await _get_user_from_token(token_list[0])
        except Exception:
            await self.close(code=4401)
            return

        self._group = channel_group_name(self.user.id)
        await self.channel_layer.group_add(self._group, self.channel_name)
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
