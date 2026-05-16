from rest_framework import serializers


class IntegrationSaveSerializer(serializers.Serializer):
    external_username = serializers.CharField(required=False, allow_blank=True, max_length=255)
    api_key = serializers.CharField(required=False, allow_blank=True, write_only=True, max_length=512)

    def to_secrets_input(self) -> dict[str, str]:
        data = self.validated_data
        secrets: dict[str, str] = {}
        if 'api_key' in data and data['api_key']:
            secrets['api_key'] = data['api_key']
        return secrets

    def to_public_input(self) -> dict:
        return {'external_username': self.validated_data.get('external_username', '')}


class IntegrationTestSerializer(serializers.Serializer):
    external_username = serializers.CharField(required=False, allow_blank=True, max_length=255)
    api_key = serializers.CharField(required=False, allow_blank=True, write_only=True, max_length=512)

    def to_secrets_input(self) -> dict[str, str]:
        data = self.validated_data
        secrets: dict[str, str] = {}
        if 'api_key' in data and data['api_key']:
            secrets['api_key'] = data['api_key']
        return secrets

    def to_public_input(self) -> dict:
        if 'external_username' in self.validated_data:
            return {'external_username': self.validated_data.get('external_username', '')}
        return {}
