"""Récupère les alias symboles TopStepX via l'API Contract/available."""
from __future__ import annotations

import json

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from integrations.topstepx_auth import get_topstepx_integration, get_valid_session_token
from integrations.topstepx_client import TopStepXApiClient, TopStepXApiError
from trades.contract_utils.topstep_aliases import (
    DEFAULT_BROKER_SYMBOL_ALIASES,
    build_broker_symbol_aliases_from_contracts,
    spec_symbol_from_topstep_name,
)
from trades.contract_utils.contract_family import get_base_symbol

User = get_user_model()


class Command(BaseCommand):
    help = (
        'Appelle POST /api/Contract/available et affiche la table broker → symbole specs. '
        'Utile pour mettre à jour DEFAULT_BROKER_SYMBOL_ALIASES dans topstep_aliases.py.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            'username',
            type=str,
            help='Utilisateur ayant une intégration TopStepX configurée',
        )
        parser.add_argument(
            '--sim',
            action='store_true',
            help='Contrats simulation (live=false) au lieu du live',
        )

    def handle(self, *args, **options):
        username = options['username']
        user = User.objects.filter(username=username).first()
        if user is None:
            raise CommandError(f'Utilisateur introuvable: {username}')

        integration = get_topstepx_integration(user)
        if integration is None:
            raise CommandError(f'Aucune intégration TopStepX pour {username}')

        try:
            token = get_valid_session_token(integration)
            contracts = TopStepXApiClient().list_available_contracts(
                token,
                live=not options['sim'],
            )
        except TopStepXApiError as exc:
            raise CommandError(str(exc)) from exc

        aliases = build_broker_symbol_aliases_from_contracts(contracts)
        unresolved = [
            row.get('id')
            for row in contracts
            if get_base_symbol(str(row.get('id') or '')) is None
        ]
        self.stdout.write(self.style.SUCCESS(f'{len(contracts)} contrats, {len(aliases)} alias'))
        if unresolved:
            self.stdout.write(self.style.ERROR(f'Non résolus ({len(unresolved)}): {unresolved}'))
        self.stdout.write(json.dumps(dict(sorted(aliases.items())), indent=2))
        missing_specs = sorted(
            {
                spec_symbol_from_topstep_name(str(row.get('name') or ''))
                for row in contracts
                if spec_symbol_from_topstep_name(str(row.get('name') or ''))
            }
            - set(__import__('trades.contract_utils.contract_specs', fromlist=['FUTURES_CONTRACT_SPECS']).FUTURES_CONTRACT_SPECS)
        )
        if missing_specs:
            self.stdout.write(self.style.WARNING(f'Symboles specs à ajouter: {missing_specs}'))

        new_keys = set(aliases) - set(DEFAULT_BROKER_SYMBOL_ALIASES)
        changed = {
            k: (DEFAULT_BROKER_SYMBOL_ALIASES[k], aliases[k])
            for k in aliases
            if k in DEFAULT_BROKER_SYMBOL_ALIASES and DEFAULT_BROKER_SYMBOL_ALIASES[k] != aliases[k]
        }
        if new_keys:
            self.stdout.write(self.style.WARNING(f'Nouveaux alias: {sorted(new_keys)}'))
        if changed:
            self.stdout.write(self.style.WARNING(f'Alias modifiés: {changed}'))
