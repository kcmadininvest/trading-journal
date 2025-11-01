from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.conf import settings


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
        default=False,
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
        default=True,
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
