from __future__ import annotations

from typing import Any

from django.utils import timezone

from .credentials_crypto import build_secrets_hint, decrypt_json, encrypt_json
from .models import UserApiIntegration
from .providers.base import BaseIntegrationProvider
from .providers.registry import get_provider


def integration_status_payload(
    provider: BaseIntegrationProvider,
    integration: UserApiIntegration | None,
) -> dict[str, Any]:
    configured = integration is not None and bool(integration.secrets_encrypted)
    return {
        'provider': provider.slug,
        'display_name': provider.display_name,
        'configured': configured,
        'external_username': integration.external_username if integration else '',
        'secrets_hint': integration.secrets_hint if integration else {},
        'is_connected': integration.is_connected if integration else False,
        'last_validated_at': (
            integration.last_validated_at.isoformat()
            if integration and integration.last_validated_at
            else None
        ),
        'required_secret_fields': provider.required_secret_fields,
        'public_fields': provider.public_fields,
    }


def get_user_integration(user, provider_slug: str) -> UserApiIntegration | None:
    return UserApiIntegration.objects.filter(user=user, provider=provider_slug).first()


def resolve_credentials(
    integration: UserApiIntegration | None,
    public_input: dict[str, Any],
    secrets_input: dict[str, str],
) -> tuple[dict[str, Any], dict[str, str]]:
    public: dict[str, Any] = {}
    secrets: dict[str, str] = {}

    if integration:
        public['external_username'] = integration.external_username
        if integration.secrets_encrypted:
            secrets = {k: str(v) for k, v in decrypt_json(integration.secrets_encrypted).items()}
    else:
        public['external_username'] = ''
        secrets = {}

    if 'external_username' in public_input and public_input['external_username'] is not None:
        public['external_username'] = str(public_input['external_username']).strip()

    stored_secrets = dict(secrets)
    for key, value in secrets_input.items():
        if value is not None and str(value).strip():
            secrets[key] = str(value).strip()
        elif key in stored_secrets:
            secrets[key] = stored_secrets[key]

    return public, secrets


def save_integration(
    user,
    provider_slug: str,
    public: dict[str, Any],
    secrets: dict[str, str],
) -> UserApiIntegration:
    provider = get_provider(provider_slug)
    if provider is None:
        raise ValueError('Fournisseur inconnu.')

    provider.validate_credentials(public, secrets)

    integration, _ = UserApiIntegration.objects.get_or_create(
        user=user,
        provider=provider_slug,
        defaults={'external_username': public.get('external_username', '')},
    )
    integration.external_username = public.get('external_username', '')
    integration.secrets_encrypted = encrypt_json(secrets)
    integration.secrets_hint = build_secrets_hint(secrets)
    integration.is_connected = False
    integration.last_validated_at = None
    integration.save()
    return integration


def delete_integration(user, provider_slug: str) -> bool:
    deleted, _ = UserApiIntegration.objects.filter(user=user, provider=provider_slug).delete()
    return deleted > 0


def apply_test_result(integration: UserApiIntegration, success: bool) -> UserApiIntegration:
    integration.is_connected = success
    if success:
        integration.last_validated_at = timezone.now()
    integration.save(update_fields=['is_connected', 'last_validated_at', 'updated_at'])
    return integration
