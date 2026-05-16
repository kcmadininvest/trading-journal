from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any

from django.conf import settings

from .base import BaseIntegrationProvider, TestConnectionResult


class TopStepXProvider(BaseIntegrationProvider):
    slug = 'topstepx'
    display_name = 'TopStepX'
    required_secret_fields = ['api_key']
    public_fields = ['external_username']

    def _api_base_url(self) -> str:
        return getattr(settings, 'TOPSTEPX_API_BASE_URL', 'https://api.topstepx.com').rstrip('/')

    def validate_credentials(self, public: dict[str, Any], secrets: dict[str, str]) -> None:
        super().validate_credentials(public, secrets)
        username = (public.get('external_username') or '').strip()
        if not username:
            raise ValueError('Le nom d\'utilisateur TopStepX est requis.')

    def test_connection(self, public: dict[str, Any], secrets: dict[str, str]) -> TestConnectionResult:
        username = (public.get('external_username') or '').strip()
        api_key = (secrets.get('api_key') or '').strip()
        url = f'{self._api_base_url()}/api/Auth/loginKey'
        body = json.dumps({'userName': username, 'apiKey': api_key}).encode('utf-8')
        req = urllib.request.Request(
            url,
            data=body,
            headers={
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            method='POST',
        )
        timeout = getattr(settings, 'TOPSTEPX_API_TIMEOUT_SECONDS', 10)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read().decode('utf-8')
        except urllib.error.HTTPError as exc:
            try:
                raw = exc.read().decode('utf-8')
                payload = json.loads(raw)
                msg = payload.get('errorMessage') or payload.get('message') or str(exc)
            except Exception:
                msg = f'Erreur HTTP {exc.code}'
            return TestConnectionResult(success=False, message=msg, error_code='http_error')
        except urllib.error.URLError:
            return TestConnectionResult(
                success=False,
                message='Impossible de joindre l\'API TopStepX. Vérifiez votre connexion.',
                error_code='network_error',
            )

        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            return TestConnectionResult(
                success=False,
                message='Réponse API TopStepX invalide.',
                error_code='invalid_response',
            )

        if payload.get('success') is True and payload.get('errorCode', 0) == 0:
            return TestConnectionResult(success=True, message='Connexion réussie.')

        msg = payload.get('errorMessage') or 'Identifiants TopStepX invalides.'
        return TestConnectionResult(
            success=False,
            message=msg,
            error_code=str(payload.get('errorCode', 'auth_failed')),
        )
