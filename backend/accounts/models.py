from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.conf import settings
import uuid
from django.utils import timezone
from datetime import timedelta
from typing import Any

# Constantes pour les valeurs par défaut des BooleanField
_IS_VERIFIED_DEFAULT: Any = False
_SIDEBAR_COLLAPSED_DEFAULT: Any = False
_EMAIL_GOAL_ALERTS_DEFAULT: Any = True
_IMPORT_GUIDE_COLLAPSED_DEFAULT: Any = None
_LOGIN_SUCCESS_DEFAULT: Any = True
_IS_USED_DEFAULT: Any = False


class User(AbstractUser):
    """
    Modèle utilisateur personnalisé avec gestion des rôles
    """
    ROLE_CHOICES = [
        ('user', 'Utilisateur'),
        ('admin', 'Administrateur'),
    ]
    
    email = models.EmailField(_('email address'), unique=True)
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='user',
        verbose_name=_('Rôle')
    )
    is_verified = models.BooleanField(
        default=_IS_VERIFIED_DEFAULT,
        verbose_name=_('Email vérifié')
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_('Date de création')
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name=_('Date de modification')
    )
    
    # Utiliser email comme nom d'utilisateur
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']
    
    class Meta:
        verbose_name = _('Utilisateur')
        verbose_name_plural = _('Utilisateurs')
        db_table = 'auth_user'
    
    def __str__(self):
        return self.email
    
    @property
    def is_admin(self):
        """Vérifie si l'utilisateur est administrateur"""
        return self.role == 'admin'
    
    @property
    def is_regular_user(self):
        """Vérifie si l'utilisateur est un utilisateur normal"""
        return self.role == 'user'
    
    def get_full_name(self):
        """Retourne le nom complet de l'utilisateur"""
        return f"{self.first_name} {self.last_name}".strip() or self.email
    
    def get_short_name(self):
        """Retourne le prénom ou l'email"""
        return self.first_name or self.email


class UserPreferences(models.Model):
    """
    Modèle pour stocker les préférences utilisateur
    """
    LANGUAGE_CHOICES = [
        ('fr', 'Français'),
        ('en', 'English'),
        ('es', 'Español'),
        ('de', 'Deutsch'),
        ('it', 'Italiano'),
        ('pt', 'Português'),
        ('ja', '日本語'),
        ('ko', '한국어'),
        ('zh', '中文'),
    ]
    
    DATE_FORMAT_CHOICES = [
        ('US', 'US (MM/DD/YYYY)'),
        ('EU', 'EU (DD/MM/YYYY)'),
    ]
    
    NUMBER_FORMAT_CHOICES = [
        ('point', 'Point (1.234,56)'),
        ('comma', 'Virgule (1 234,56)'),
    ]
    
    THEME_CHOICES = [
        ('light', 'Clair'),
        ('dark', 'Sombre'),
    ]
    
    FONT_SIZE_CHOICES = [
        ('small', 'Petit'),
        ('medium', 'Moyen'),
        ('large', 'Grand'),
    ]
    
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='preferences',
        verbose_name=_('Utilisateur')
    )
    
    # Langue et localisation
    language = models.CharField(
        max_length=10,
        choices=LANGUAGE_CHOICES,
        default='fr',
        verbose_name=_('Langue')
    )
    timezone = models.CharField(
        max_length=50,
        default='Europe/Paris',
        verbose_name=_('Fuseau horaire'),
        help_text=_('Fuseau horaire (ex: Europe/Paris, America/New_York)')
    )
    
    # Préférences de trading
    date_format = models.CharField(
        max_length=10,
        choices=DATE_FORMAT_CHOICES,
        default='EU',
        verbose_name=_('Format de date')
    )
    number_format = models.CharField(
        max_length=10,
        choices=NUMBER_FORMAT_CHOICES,
        default='comma',
        verbose_name=_('Format des nombres')
    )
    
    # Préférences d'affichage
    theme = models.CharField(
        max_length=10,
        choices=THEME_CHOICES,
        default='light',
        verbose_name=_('Thème')
    )
    font_size = models.CharField(
        max_length=10,
        choices=FONT_SIZE_CHOICES,
        default='medium',
        verbose_name=_('Taille de police')
    )
    sidebar_collapsed = models.BooleanField(
        default=_SIDEBAR_COLLAPSED_DEFAULT,
        verbose_name=_('Sidebar repliée'),
        help_text=str(_('État de la sidebar (repliée ou dépliée)'))
    )
    
    # Notifications
    email_goal_alerts = models.BooleanField(
        default=_EMAIL_GOAL_ALERTS_DEFAULT,
        verbose_name=_('Alertes email pour les objectifs'),
        help_text=str(_('Recevoir des emails quand un objectif est atteint ou en danger'))
    )
    
    # Préférences d'interface
    import_guide_collapsed = models.BooleanField(
        null=True,
        blank=True,
        default=None,
        verbose_name=_('Guide d\'import replié'),
        help_text=str(_('État du guide d\'import dans la modale (None = première utilisation, True = replié, False = déplié)'))
    )
    
    # Paramètres de confidentialité par page (réutilisable)
    privacy_overrides = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_('Privacy Overrides par Page'),
        help_text=str(_('Overrides de confidentialité par contexte de page (dashboard, statistics, trades, etc.)'))
    )
    
    # Métadonnées
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_('Date de création')
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name=_('Date de modification')
    )
    
    class Meta:
        verbose_name = _('Préférences utilisateur')
        verbose_name_plural = _('Préférences utilisateur')
        db_table = 'accounts_userpreferences'
    
    def __str__(self):
        return f"Préférences de {self.user.email}"


class LoginHistory(models.Model):
    """
    Modèle pour enregistrer l'historique des connexions
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='login_history',
        verbose_name=_('Utilisateur')
    )
    date = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_('Date de connexion')
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        verbose_name=_('Adresse IP')
    )
    user_agent = models.TextField(
        null=True,
        blank=True,
        verbose_name=_('User Agent')
    )
    success = models.BooleanField(
        default=_LOGIN_SUCCESS_DEFAULT,
        verbose_name=_('Connexion réussie')
    )
    
    class Meta:
        verbose_name = _('Historique de connexion')
        verbose_name_plural = _('Historiques de connexion')
        db_table = 'accounts_loginhistory'
        ordering = ['-date']
        indexes = [
            models.Index(fields=['user', '-date']),
        ]
    
    def __str__(self):
        status = "Réussie" if self.success else "Échouée"
        return f"{self.user.email} - {self.date} - {status}"


class EmailActivationToken(models.Model):
    """
    Modèle pour stocker les tokens d'activation par email
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='activation_token',
        verbose_name=_('Utilisateur')
    )
    token = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        verbose_name=_('Token')
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_('Date de création')
    )
    expires_at = models.DateTimeField(
        verbose_name=_('Date d\'expiration')
    )
    is_used = models.BooleanField(
        default=_IS_USED_DEFAULT,
        verbose_name=_('Utilisé')
    )
    
    class Meta:
        verbose_name = _('Token d\'activation email')
        verbose_name_plural = _('Tokens d\'activation email')
        db_table = 'accounts_emailactivationtoken'
        indexes = [
            models.Index(fields=['token']),
            models.Index(fields=['user', '-created_at']),
        ]
    
    def __str__(self):
        return f"Token d'activation pour {self.user.email}"
    
    def save(self, *args, **kwargs):
        if not self.expires_at:
            # Token valide pendant 7 jours
            self.expires_at = timezone.now() + timedelta(days=7)
        return super().save(*args, **kwargs)
    
    def is_expired(self):
        """Vérifie si le token a expiré"""
        return timezone.now() > self.expires_at
    
    def is_valid(self):
        """Vérifie si le token est valide (non utilisé et non expiré)"""
        return not self.is_used and not self.is_expired()
    
    def can_be_used_expired(self):
        """
        Vérifie si un token expiré peut être utilisé pour activer le compte.
        Conditions :
        - Le token n'a jamais été utilisé
        - Le compte n'est toujours pas activé
        - Le token n'est pas trop ancien (moins de 30 jours depuis la création)
        """
        if self.is_used:
            return False
        
        if not self.is_expired():
            return False
        
        # Vérifier que le compte n'est pas déjà activé
        if self.user.is_active:
            return False
        
        # Vérifier que le token n'est pas trop ancien (30 jours max depuis la création)
        if self.created_at:
            days_since_creation = (timezone.now() - self.created_at).days  # type: ignore
            return days_since_creation <= 30
        return False