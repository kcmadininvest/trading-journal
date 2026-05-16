from django.contrib import admin

from .models import UserApiIntegration


@admin.register(UserApiIntegration)
class UserApiIntegrationAdmin(admin.ModelAdmin):
    list_display = ('user', 'provider', 'external_username', 'is_connected', 'last_validated_at', 'updated_at')
    list_filter = ('provider', 'is_connected')
    search_fields = ('user__email', 'external_username', 'provider')
    readonly_fields = (
        'secrets_encrypted',
        'secrets_hint',
        'created_at',
        'updated_at',
        'last_validated_at',
    )

    def get_readonly_fields(self, request, obj=None):
        fields = list(super().get_readonly_fields(request, obj))
        if obj:
            fields.append('secrets_encrypted')
        return fields
