from __future__ import annotations

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .providers.registry import get_provider, list_providers
from .serializers import IntegrationSaveSerializer, IntegrationTestSerializer
from .services import (
    apply_test_result,
    delete_integration,
    get_user_integration,
    integration_status_payload,
    resolve_credentials,
    save_integration,
)
from .throttling import IntegrationTestThrottle


def _provider_or_404(slug: str):
    provider = get_provider(slug)
    if provider is None:
        return None, Response({'error': 'Fournisseur inconnu.'}, status=status.HTTP_404_NOT_FOUND)
    return provider, None


class IntegrationListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        integrations = {
            row.provider: row
            for row in request.user.api_integrations.all()
        }
        items = [
            integration_status_payload(provider, integrations.get(provider.slug))
            for provider in list_providers()
        ]
        return Response({'integrations': items})


class IntegrationDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, provider: str):
        provider_impl, err = _provider_or_404(provider)
        if err:
            return err
        integration = get_user_integration(request.user, provider)
        return Response(integration_status_payload(provider_impl, integration))

    def put(self, request, provider: str):
        provider_impl, err = _provider_or_404(provider)
        if err:
            return err

        serializer = IntegrationSaveSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        integration = get_user_integration(request.user, provider)
        public_input = serializer.to_public_input()
        secrets_input = serializer.to_secrets_input()

        if integration is None and not secrets_input.get('api_key'):
            return Response(
                {'api_key': ['La clé API est requise pour une nouvelle configuration.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        public, secrets = resolve_credentials(integration, public_input, secrets_input)

        if not secrets.get('api_key'):
            return Response(
                {'api_key': ['La clé API est requise.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            integration = save_integration(request.user, provider, public, secrets)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'message': 'Intégration enregistrée.',
            'integration': integration_status_payload(provider_impl, integration),
        })

    def delete(self, request, provider: str):
        _, err = _provider_or_404(provider)
        if err:
            return err
        deleted = delete_integration(request.user, provider)
        if not deleted:
            return Response({'error': 'Aucune intégration à supprimer.'}, status=status.HTTP_404_NOT_FOUND)
        return Response({'message': 'Intégration supprimée.'}, status=status.HTTP_200_OK)


class IntegrationTestConnectionView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [IntegrationTestThrottle]

    def post(self, request, provider: str):
        provider_impl, err = _provider_or_404(provider)
        if err:
            return err

        serializer = IntegrationTestSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        integration = get_user_integration(request.user, provider)
        public_input = serializer.to_public_input()
        secrets_input = serializer.to_secrets_input()

        public, secrets = resolve_credentials(integration, public_input, secrets_input)

        if not secrets.get('api_key'):
            return Response(
                {'error': 'Aucune clé API configurée. Enregistrez vos identifiants ou fournissez une clé API.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            provider_impl.validate_credentials(public, secrets)
        except ValueError as exc:
            return Response({'success': False, 'message': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        result = provider_impl.test_connection(public, secrets)

        if integration is not None:
            apply_test_result(integration, result.success)

        status_code = status.HTTP_200_OK if result.success else status.HTTP_400_BAD_REQUEST
        return Response(
            {
                'success': result.success,
                'message': result.message,
                'error_code': result.error_code,
                'integration': integration_status_payload(
                    provider_impl,
                    get_user_integration(request.user, provider),
                ),
            },
            status=status_code,
        )
