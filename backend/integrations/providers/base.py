from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class TestConnectionResult:
    success: bool
    message: str
    error_code: str | None = None


class BaseIntegrationProvider(ABC):
    slug: str
    display_name: str
    required_secret_fields: list[str]
    public_fields: list[str]

    def validate_credentials(self, public: dict[str, Any], secrets: dict[str, str]) -> None:
        for field in self.public_fields:
            if field == 'external_username' and public.get('external_username', '').strip() == '':
                raise ValueError('Le nom d\'utilisateur est requis.')
        for field in self.required_secret_fields:
            if not secrets.get(field, '').strip():
                raise ValueError(f'Le champ secret « {field} » est requis.')

    @abstractmethod
    def test_connection(self, public: dict[str, Any], secrets: dict[str, str]) -> TestConnectionResult:
        ...
