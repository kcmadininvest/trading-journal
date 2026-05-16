from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class UserApiIntegration(models.Model):
    """Identifiants API broker par utilisateur et par fournisseur (slug)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='api_integrations',
        verbose_name=_('Utilisateur'),
    )
    provider = models.CharField(
        max_length=64,
        db_index=True,
        verbose_name=_('Fournisseur'),
        help_text=_('Slug du fournisseur (ex. topstepx, tradovate).'),
    )
    external_username = models.CharField(
        max_length=255,
        blank=True,
        default='',
        verbose_name=_('Identifiant externe'),
    )
    secrets_encrypted = models.TextField(
        blank=True,
        default='',
        verbose_name=_('Secrets chiffrés'),
    )
    secrets_hint = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_('Indicateurs masqués'),
    )
    is_connected = models.BooleanField(
        default=False,
        verbose_name=_('Dernière connexion réussie'),
    )
    last_validated_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_('Dernière validation'),
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'integrations_user_api_integration'
        verbose_name = _('Intégration API utilisateur')
        verbose_name_plural = _('Intégrations API utilisateur')
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'provider'],
                name='uniq_user_api_integration_provider',
            ),
        ]
        indexes = [
            models.Index(fields=['user', 'provider']),
        ]

    def __str__(self) -> str:
        return f'{self.user_id}:{self.provider}'
