from __future__ import annotations

from typing import Any

from integrations.topstepx_client import TopStepXApiClient, TopStepXApiError

from .base import BaseIntegrationProvider, TestConnectionResult


class TopStepXProvider(BaseIntegrationProvider):
    slug = 'topstepx'
    display_name = 'TopStepX'
    required_secret_fields = ['api_key']
    public_fields = ['external_username']

    def validate_credentials(self, public: dict[str, Any], secrets: dict[str, str]) -> None:
        super().validate_credentials(public, secrets)
        username = (public.get('external_username') or '').strip()
        if not username:
            raise ValueError('Le nom d\'utilisateur TopStepX est requis.')

    def test_connection(self, public: dict[str, Any], secrets: dict[str, str]) -> TestConnectionResult:
        username = (public.get('external_username') or '').strip()
        api_key = (secrets.get('api_key') or '').strip()
        try:
            TopStepXApiClient().login_key(username, api_key)
            return TestConnectionResult(success=True, message='Connexion réussie.')
        except TopStepXApiError as exc:
            return TestConnectionResult(
                success=False,
                message=str(exc),
                error_code=exc.error_code,
            )
