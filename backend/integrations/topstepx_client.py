"""Client HTTP TopStepX / ProjectX Gateway API."""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from django.conf import settings
from django.utils.dateparse import parse_datetime


@dataclass(frozen=True)
class TopStepXAuthResult:
    token: str
    expires_at: datetime | None


class TopStepXApiError(Exception):
    def __init__(self, message: str, error_code: str | None = None):
        super().__init__(message)
        self.error_code = error_code


class TopStepXApiClient:
    def __init__(self, base_url: str | None = None, timeout: int | None = None):
        self.base_url = (base_url or getattr(settings, 'TOPSTEPX_API_BASE_URL', 'https://api.topstepx.com')).rstrip('/')
        self.timeout = timeout or getattr(settings, 'TOPSTEPX_API_TIMEOUT_SECONDS', 30)

    def login_key(self, username: str, api_key: str) -> TopStepXAuthResult:
        payload = self._request_json(
            'POST',
            '/api/Auth/loginKey',
            body={'userName': username, 'apiKey': api_key},
            auth_token=None,
        )
        if not payload.get('success') or payload.get('errorCode', 0) != 0:
            raise TopStepXApiError(
                payload.get('errorMessage') or 'Authentification TopStepX échouée.',
                error_code=str(payload.get('errorCode', 'auth_failed')),
            )
        token = payload.get('token') or payload.get('accessToken')
        if not token:
            raise TopStepXApiError('Token de session TopStepX absent dans la réponse.', error_code='no_token')
        expires_raw = payload.get('expires') or payload.get('expiration') or payload.get('expiresAt')
        expires_at = None
        if expires_raw:
            expires_at = parse_datetime(str(expires_raw))
            if expires_at and expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
        return TopStepXAuthResult(token=str(token), expires_at=expires_at)

    def search_trades(
        self,
        auth_token: str,
        account_id: int,
        start_timestamp: datetime,
        end_timestamp: datetime | None = None,
    ) -> list[dict[str, Any]]:
        body: dict[str, Any] = {
            'accountId': int(account_id),
            'startTimestamp': self._format_timestamp(start_timestamp),
        }
        if end_timestamp is not None:
            body['endTimestamp'] = self._format_timestamp(end_timestamp)
        payload = self._request_json(
            'POST',
            '/api/Trade/search',
            body=body,
            auth_token=auth_token,
        )
        if not payload.get('success') or payload.get('errorCode', 0) != 0:
            raise TopStepXApiError(
                self._api_error_message(payload, 'Recherche de trades TopStepX échouée.'),
                error_code=str(payload.get('errorCode', 'trade_search_failed')),
            )
        trades = payload.get('trades') or []
        if not isinstance(trades, list):
            return []
        return trades

    def search_orders(
        self,
        auth_token: str,
        account_id: int,
        start_timestamp: datetime,
        end_timestamp: datetime | None = None,
    ) -> list[dict[str, Any]]:
        body: dict[str, Any] = {
            'accountId': int(account_id),
            'startTimestamp': self._format_timestamp(start_timestamp),
        }
        if end_timestamp is not None:
            body['endTimestamp'] = self._format_timestamp(end_timestamp)
        payload = self._request_json(
            'POST',
            '/api/Order/search',
            body=body,
            auth_token=auth_token,
        )
        if not payload.get('success') or payload.get('errorCode', 0) != 0:
            raise TopStepXApiError(
                self._api_error_message(payload, 'Recherche d\'ordres TopStepX échouée.'),
                error_code=str(payload.get('errorCode', 'order_search_failed')),
            )
        orders = payload.get('orders') or []
        if not isinstance(orders, list):
            return []
        return orders

    def list_accounts(self, auth_token: str, user_id: int | None = None) -> list[dict[str, Any]]:
        from integrations.topstepx_accounts import list_projectx_accounts

        return list_projectx_accounts(self, auth_token, user_id=user_id)

    def search_contracts(
        self,
        auth_token: str,
        *,
        search_text: str,
        live: bool = True,
    ) -> list[dict[str, Any]]:
        """POST /api/Contract/search — recherche de contrats par texte."""
        payload = self._request_json(
            'POST',
            '/api/Contract/search',
            body={'live': bool(live), 'searchText': search_text},
            auth_token=auth_token,
        )
        if not payload.get('success') or payload.get('errorCode', 0) != 0:
            raise TopStepXApiError(
                self._api_error_message(payload, 'Recherche de contrats TopStepX échouée.'),
                error_code=str(payload.get('errorCode', 'contract_search_failed')),
            )
        contracts = payload.get('contracts') or []
        if not isinstance(contracts, list):
            return []
        return contracts

    def retrieve_bars(
        self,
        auth_token: str,
        *,
        contract_id: str,
        live: bool,
        start_time: datetime,
        end_time: datetime,
        unit: int,
        unit_number: int,
        limit: int,
        include_partial_bar: bool = False,
    ) -> list[dict[str, Any]]:
        """POST /api/History/retrieveBars — bougies OHLC historiques."""
        payload = self._request_json(
            'POST',
            '/api/History/retrieveBars',
            body={
                'contractId': contract_id,
                'live': bool(live),
                'startTime': self._format_timestamp(start_time),
                'endTime': self._format_timestamp(end_time),
                'unit': int(unit),
                'unitNumber': int(unit_number),
                'limit': int(limit),
                'includePartialBar': bool(include_partial_bar),
            },
            auth_token=auth_token,
        )
        if not payload.get('success') or payload.get('errorCode', 0) != 0:
            raise TopStepXApiError(
                self._api_error_message(payload, 'Récupération des barres TopStepX échouée.'),
                error_code=str(payload.get('errorCode', 'retrieve_bars_failed')),
            )
        bars = payload.get('bars') or []
        if not isinstance(bars, list):
            return []
        return [self._normalize_bar_row(row) for row in bars if isinstance(row, dict)]

    @staticmethod
    def _normalize_bar_row(row: dict[str, Any]) -> dict[str, Any]:
        def _float(key: str) -> float | None:
            raw = row.get(key)
            if raw is None:
                return None
            try:
                return float(raw)
            except (TypeError, ValueError):
                return None

        timestamp = row.get('t') or row.get('timestamp')
        return {
            't': str(timestamp) if timestamp is not None else '',
            'o': _float('o'),
            'h': _float('h'),
            'l': _float('l'),
            'c': _float('c'),
            'v': _float('v'),
        }

    def list_available_contracts(
        self,
        auth_token: str,
        *,
        live: bool = True,
    ) -> list[dict[str, Any]]:
        """POST /api/Contract/available — catalogue symboles ProjectX / TopStepX."""
        payload = self._request_json(
            'POST',
            '/api/Contract/available',
            body={'live': bool(live)},
            auth_token=auth_token,
        )
        if not payload.get('success') or payload.get('errorCode', 0) != 0:
            raise TopStepXApiError(
                self._api_error_message(payload, 'Liste des contrats TopStepX échouée.'),
                error_code=str(payload.get('errorCode', 'contract_list_failed')),
            )
        contracts = payload.get('contracts') or []
        if not isinstance(contracts, list):
            return []
        return contracts

    @staticmethod
    def _api_error_message(payload: dict[str, Any], default: str) -> str:
        msg = payload.get('errorMessage')
        if msg:
            return str(msg)
        code = payload.get('errorCode', 0)
        if code == 1:
            return (
                'Compte TopStepX introuvable (ID invalide). '
                'Vérifiez l\'ID ProjectX sur le compte de trading.'
            )
        if code:
            return f'{default} (code {code})'
        return default

    def _format_timestamp(self, dt: datetime) -> str:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'

    def _request_json(
        self,
        method: str,
        path: str,
        body: dict[str, Any] | None = None,
        auth_token: str | None = None,
    ) -> dict[str, Any]:
        url = f'{self.base_url}{path}'
        data = json.dumps(body).encode('utf-8') if body is not None else None
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        }
        if auth_token:
            headers['Authorization'] = f'Bearer {auth_token}'
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                raw = resp.read().decode('utf-8')
        except urllib.error.HTTPError as exc:
            try:
                raw = exc.read().decode('utf-8')
                payload = json.loads(raw)
                msg = payload.get('errorMessage') or payload.get('message') or f'Erreur HTTP {exc.code}'
                code = str(payload.get('errorCode', 'http_error'))
            except Exception:
                msg = f'Erreur HTTP {exc.code}'
                code = 'http_error'
            raise TopStepXApiError(msg, error_code=code) from exc
        except urllib.error.URLError as exc:
            raise TopStepXApiError(
                'Impossible de joindre l\'API TopStepX. Vérifiez votre connexion.',
                error_code='network_error',
            ) from exc
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise TopStepXApiError('Réponse API TopStepX invalide.', error_code='invalid_response') from exc
        if not isinstance(parsed, dict):
            raise TopStepXApiError('Réponse API TopStepX invalide.', error_code='invalid_response')
        return parsed
