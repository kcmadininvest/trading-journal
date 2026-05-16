from __future__ import annotations

from .base import BaseIntegrationProvider
from .topstepx import TopStepXProvider

_PROVIDERS: dict[str, BaseIntegrationProvider] = {
    TopStepXProvider.slug: TopStepXProvider(),
}


def register_provider(provider: BaseIntegrationProvider) -> None:
    _PROVIDERS[provider.slug] = provider


def get_provider(slug: str) -> BaseIntegrationProvider | None:
    return _PROVIDERS.get(slug)


def list_providers() -> list[BaseIntegrationProvider]:
    return list(_PROVIDERS.values())
