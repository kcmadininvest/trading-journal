from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _
from .models import (
    User,
    UserPreferences,
    LoginHistory,
    EmailActivationToken,
    PasswordResetToken,
    WebAuthnCredential,
    TotpDevice,
    BackupCode,
    TwoFactorRecoveryRequest,
)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """
    Configuration de l'interface d'administration pour le modèle User
    """
    list_display = ('email', 'first_name', 'last_name', 'role', 'is_verified', 'is_active', 'created_at')
    list_filter = ('role', 'is_verified', 'is_active', 'is_staff', 'created_at')
    search_fields = ('email', 'first_name', 'last_name', 'username')
    ordering = ('-created_at',)
    
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        (_('Personal info'), {'fields': ('first_name', 'last_name', 'username')}),
        (_('Permissions'), {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'role', 'is_verified', 'groups', 'user_permissions'),
        }),
        (_('Important dates'), {'fields': ('last_login', 'date_joined', 'created_at', 'updated_at')}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'first_name', 'last_name', 'username', 'password1', 'password2', 'role'),
        }),
    )
    
    readonly_fields = ('created_at', 'updated_at', 'date_joined', 'last_login')
    
    def get_readonly_fields(self, request, obj=None):
        if obj:  # Édition d'un utilisateur existant
            return self.readonly_fields + ('email',)
        return self.readonly_fields


@admin.register(UserPreferences)
class UserPreferencesAdmin(admin.ModelAdmin):
    """
    Configuration de l'interface d'administration pour UserPreferences
    """
    list_display = ('user', 'language', 'timezone', 'theme', 'date_format', 'number_format', 'pnl_display', 'updated_at')
    list_filter = ('language', 'theme', 'date_format', 'number_format', 'pnl_display')
    search_fields = ('user__email', 'user__username')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(LoginHistory)
class LoginHistoryAdmin(admin.ModelAdmin):
    """
    Configuration de l'interface d'administration pour LoginHistory
    """
    list_display = ('user', 'date', 'ip_address', 'success', 'method')
    list_filter = ('success', 'method', 'date')
    search_fields = ('user__email', 'ip_address', 'user_agent')
    readonly_fields = ('date',)
    ordering = ('-date',)


@admin.register(WebAuthnCredential)
class WebAuthnCredentialAdmin(admin.ModelAdmin):
    list_display = ('user', 'label', 'credential_id', 'sign_count', 'created_at', 'last_used_at')
    search_fields = ('user__email', 'label', 'credential_id')
    readonly_fields = ('credential_id', 'public_key', 'sign_count', 'transports', 'created_at', 'last_used_at')


@admin.register(TotpDevice)
class TotpDeviceAdmin(admin.ModelAdmin):
    list_display = ('user', 'enabled', 'confirmed_at', 'created_at')
    list_filter = ('enabled',)
    search_fields = ('user__email',)
    readonly_fields = ('secret_encrypted', 'created_at', 'updated_at', 'confirmed_at')


@admin.register(BackupCode)
class BackupCodeAdmin(admin.ModelAdmin):
    list_display = ('user', 'used_at', 'created_at')
    list_filter = ('used_at',)
    search_fields = ('user__email',)
    readonly_fields = ('code_hash', 'created_at', 'used_at')


@admin.register(TwoFactorRecoveryRequest)
class TwoFactorRecoveryRequestAdmin(admin.ModelAdmin):
    list_display = ('user', 'created_at', 'usable_from', 'expires_at', 'completed_at', 'cancelled_at')
    search_fields = ('user__email', 'token', 'cancel_token')
    readonly_fields = ('token', 'cancel_token', 'created_at')


@admin.register(EmailActivationToken)
class EmailActivationTokenAdmin(admin.ModelAdmin):
    """
    Configuration de l'interface d'administration pour EmailActivationToken
    """
    list_display = ('user', 'token', 'created_at', 'expires_at', 'is_used', 'is_expired_display')
    list_filter = ('is_used', 'created_at', 'expires_at')
    search_fields = ('user__email', 'token')
    readonly_fields = ('token', 'created_at', 'expires_at', 'is_expired_display')
    ordering = ('-created_at',)
    
    def is_expired_display(self, obj):
        """Affiche si le token est expiré"""
        return obj.is_expired()
    is_expired_display.boolean = True
    is_expired_display.short_description = 'Expiré'


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    list_display = ('user', 'token', 'created_at', 'expires_at', 'is_used', 'is_expired_display')
    list_filter = ('is_used', 'created_at', 'expires_at')
    search_fields = ('user__email', 'token')
    readonly_fields = ('token', 'created_at', 'expires_at', 'is_expired_display')
    ordering = ('-created_at',)

    def is_expired_display(self, obj):
        return obj.is_expired()
    is_expired_display.boolean = True
    is_expired_display.short_description = 'Expiré'
