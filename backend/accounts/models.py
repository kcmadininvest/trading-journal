from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator
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

    PNL_DISPLAY_CHOICES = [
        ('net', _('PnL net (après frais et commissions)')),
        ('gross', _('PnL brut (avant frais et commissions)')),
    ]

    THEME_CHOICES = [
        ('light', 'Clair'),
        ('dark', 'Sombre'),
        ('system', 'Système'),
    ]
    
    FONT_SIZE_CHOICES = [
        ('small', 'Petit'),
        ('medium', 'Moyen'),
        ('large', 'Grand'),
    ]

    FONT_FAMILY_CHOICES = [
        ('inter', 'Inter'),
        ('lato', 'Lato'),
        ('montserrat', 'Montserrat'),
        ('noto_sans', 'Noto Sans'),
        ('nunito', 'Nunito'),
        ('open_sans', 'Open Sans'),
        ('poppins', 'Poppins'),
        ('raleway', 'Raleway'),
        ('roboto', 'Roboto'),
        ('source_sans_3', 'Source Sans 3'),
        ('ubuntu', 'Ubuntu'),
        ('work_sans', 'Work Sans'),
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
    default_currency = models.CharField(
        max_length=3,
        default='USD',
        verbose_name=_('Devise par défaut (rentabilité activité)'),
        help_text=_('Code ISO 4217 utilisé par défaut pour les nouvelles écritures débit/crédit.'),
    )
    pnl_display = models.CharField(
        max_length=10,
        choices=PNL_DISPLAY_CHOICES,
        default='net',
        verbose_name=_('Affichage du PnL'),
        help_text=_('Montants agrégés et graphiques basés sur le net ou le brut.'),
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
    font_family = models.CharField(
        max_length=32,
        choices=FONT_FAMILY_CHOICES,
        default='inter',
        verbose_name=_('Famille de police')
    )
    show_pre_market = models.BooleanField(
        default=False,
        verbose_name=_('Afficher le pré-marché'),
        help_text=str(_('Afficher l\'indicateur de pré-marché sur les horloges de marché'))
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

    # Préférences de pagination
    items_per_page = models.PositiveIntegerField(
        default=20,
        validators=[MinValueValidator(1), MaxValueValidator(100)],
        verbose_name=_('Éléments par page'),
        help_text=str(_('Nombre d\'éléments à afficher par page dans les listes (1-100)'))
    )
    
    # Paramètres de confidentialité par page (réutilisable)
    privacy_overrides = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_('Privacy Overrides par Page'),
        help_text=str(_('Overrides de confidentialité par contexte de page (dashboard, statistics, trades, etc.)'))
    )
    # Filtres journal (période globale + stratégie de position par compte), synchronisés avec le frontend
    journal_period = models.JSONField(
        null=True,
        blank=True,
        default=None,
        verbose_name=_('Période du journal'),
        help_text=str(_('Préréglage ou plage personnalisée (preset, start/end si custom)')),
    )
    journal_position_strategies = models.JSONField(
        null=True,
        blank=True,
        default=None,
        verbose_name=_('Stratégies de position par compte'),
        help_text=str(_('Carte compte_id ou "all" vers id de stratégie de position (null = toutes)')),
    )
    topstep_api_paused = models.BooleanField(
        default=False,
        verbose_name=_('API TopStep en pause'),
        help_text=str(_(
            'Champ historique — non utilisé par l’application.'
        )),
    )
    market_quotes_enabled = models.BooleanField(
        default=True,
        verbose_name=_('Bandeau cours marché activé'),
        help_text=str(_('Champ historique — non utilisé par l’application.')),
    )
    market_replay_logarithmic = models.BooleanField(
        default=False,
        verbose_name=_('Market Replay — échelle logarithmique'),
        help_text=str(_('Utiliser l’échelle de prix logarithmique sur les graphiques Market Replay.')),
    )
    market_replay_autofit = models.BooleanField(
        default=False,
        verbose_name=_('Market Replay — autofit continu'),
        help_text=str(_('Recentrer automatiquement les bougies visibles pendant la lecture Market Replay.')),
    )
    daily_journal_table_editor = models.BooleanField(
        default=True,
        verbose_name=_('Journal — mini-éditeur de tableau'),
        help_text=str(_('Afficher le mini-éditeur visuel lors de l’édition d’un tableau dans le journal quotidien.')),
    )
    daily_journal_view_mode = models.CharField(
        max_length=10,
        choices=[('grid', 'Grille'), ('list', 'Liste')],
        default='grid',
        verbose_name=_('Journal — mode d’affichage'),
        help_text=str(_('Vue grille ou liste des entrées du journal quotidien.')),
    )
    journal_questions_positions_collapsed = models.BooleanField(
        default=False,
        verbose_name=_('Questions des positions repliées'),
        help_text=str(_('Replier la section des réponses par position sur la page Questions du jour.')),
    )
    tutorials_progress = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_('Progression des tutoriels'),
        help_text=str(_(
            'Carte slug → {status, stepIndex, updatedAt}. '
            'Ne retire jamais l’accès au hub Aide.'
        )),
    )
    tutorials_auto_prompt_dismissed = models.BooleanField(
        default=False,
        verbose_name=_('Rappel auto tutoriels désactivé'),
        help_text=str(_(
            'Coupe uniquement le prompt / bannière automatiques au login ; '
            'le menu Aide reste toujours accessible.'
        )),
    )
    trading_activity_ledger_sort = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_('Tri ledger activité trading'),
        help_text=str(_(
            'Tri par onglet (debit/credit/tax) : {field, direction}. '
            'Défaut implicite : date desc.'
        )),
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


class AppSettings(models.Model):
    """
    Paramètres globaux de l'application (singleton, pk=1).
    """
    premium_restrictions_enabled = models.BooleanField(
        default=True,
        verbose_name=_('Restrictions premium activées'),
        help_text=_(
            'Si désactivé, toutes les fonctionnalités premium sont accessibles '
            'à tous les utilisateurs authentifiés.'
        ),
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('Paramètres application')
        verbose_name_plural = _('Paramètres application')
        db_table = 'accounts_appsettings'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError(_('Les paramètres application ne peuvent pas être supprimés.'))

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(
            pk=1,
            defaults={'premium_restrictions_enabled': True},
        )
        return obj

    def __str__(self):
        state = 'on' if self.premium_restrictions_enabled else 'off'
        return f'AppSettings (premium restrictions: {state})'


class LoginHistory(models.Model):
    """
    Modèle pour enregistrer l'historique des connexions
    """
    METHOD_PASSWORD = 'password'
    METHOD_PASSKEY = 'passkey'
    METHOD_TOTP = 'totp'
    METHOD_BACKUP_CODE = 'backup_code'
    METHOD_UNKNOWN = ''

    METHOD_CHOICES = (
        (METHOD_PASSWORD, _('Mot de passe')),
        (METHOD_PASSKEY, _('Passkey')),
        (METHOD_TOTP, _('Code 2FA')),
        (METHOD_BACKUP_CODE, _('Code de secours')),
        (METHOD_UNKNOWN, _('Inconnu')),
    )

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
    method = models.CharField(
        max_length=32,
        choices=METHOD_CHOICES,
        blank=True,
        default=METHOD_UNKNOWN,
        verbose_name=_('Moyen de connexion'),
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


class PasswordResetToken(models.Model):
    """
    Token de réinitialisation de mot de passe (forgot password).
    FK (pas OneToOne) : plusieurs demandes possibles dans le temps.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='password_reset_tokens',
        verbose_name=_('Utilisateur'),
    )
    token = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        verbose_name=_('Token'),
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_('Date de création'),
    )
    expires_at = models.DateTimeField(
        verbose_name=_("Date d'expiration"),
    )
    is_used = models.BooleanField(
        default=_IS_USED_DEFAULT,
        verbose_name=_('Utilisé'),
    )

    class Meta:
        verbose_name = _('Token de réinitialisation mot de passe')
        verbose_name_plural = _('Tokens de réinitialisation mot de passe')
        db_table = 'accounts_passwordresettoken'
        indexes = [
            models.Index(fields=['token']),
            models.Index(fields=['user', '-created_at']),
        ]

    def __str__(self):
        return f"Token reset pour {self.user.email}"

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=1)
        return super().save(*args, **kwargs)

    def is_expired(self):
        return timezone.now() > self.expires_at

    def is_valid(self):
        return not self.is_used and not self.is_expired()

class WebAuthnCredential(models.Model):
    """Passkey WebAuthn (plusieurs par compte, coexiste avec le TOTP)."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='webauthn_credentials',
        verbose_name=_('Utilisateur'),
    )
    credential_id = models.CharField(max_length=1024, unique=True, db_index=True)
    public_key = models.TextField()
    sign_count = models.PositiveIntegerField(default=0)
    transports = models.JSONField(default=list, blank=True)
    label = models.CharField(max_length=128, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = _('Passkey WebAuthn')
        verbose_name_plural = _('Passkeys WebAuthn')
        db_table = 'accounts_webauthncredential'
        ordering = ['-created_at']

    def __str__(self):
        return f'WebAuthnCredential {self.label or self.credential_id[:12]}… ({self.user_id})'


class TotpDevice(models.Model):
    """Configuration TOTP (coexiste avec les passkeys)."""
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='totp_device',
        verbose_name=_('Utilisateur'),
    )
    secret_encrypted = models.TextField()
    enabled = models.BooleanField(default=False)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('Appareil TOTP')
        verbose_name_plural = _('Appareils TOTP')
        db_table = 'accounts_totpdevice'

    def __str__(self):
        state = 'enabled' if self.enabled else 'pending'
        return f'TOTP {self.user_id} ({state})'


class BackupCode(models.Model):
    """Code de secours à usage unique pour le 2FA."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='backup_codes',
        verbose_name=_('Utilisateur'),
    )
    code_hash = models.CharField(max_length=64)
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('Code de secours')
        verbose_name_plural = _('Codes de secours')
        db_table = 'accounts_backupcode'
        indexes = [
            models.Index(fields=['user', 'used_at'], name='acc_backup_user_used_idx'),
        ]

    @property
    def is_used(self) -> bool:
        return self.used_at is not None


class TwoFactorRecoveryRequest(models.Model):
    """
    Récupération 2FA par e-mail.
    Lien utilisable uniquement entre created_at+1h et created_at+2h.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='two_factor_recovery_requests',
        verbose_name=_('Utilisateur'),
    )
    token = models.UUIDField(default=uuid.uuid4, unique=True)
    cancel_token = models.UUIDField(default=uuid.uuid4, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    usable_from = models.DateTimeField()
    expires_at = models.DateTimeField()
    completed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = _('Récupération 2FA')
        verbose_name_plural = _('Récupérations 2FA')
        db_table = 'accounts_twofactorrecoveryrequest'
        indexes = [
            models.Index(fields=['token'], name='acc_2fa_rec_token_idx'),
            models.Index(fields=['cancel_token'], name='acc_2fa_rec_cancel_idx'),
            models.Index(fields=['user', '-created_at'], name='acc_2fa_rec_user_idx'),
        ]

    def save(self, *args, **kwargs):
        if not self.usable_from:
            self.usable_from = timezone.now() + timedelta(hours=1)
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=2)
        return super().save(*args, **kwargs)

    def is_pending(self) -> bool:
        return self.completed_at is None and self.cancelled_at is None

    def is_usable_now(self) -> bool:
        now = timezone.now()
        return self.is_pending() and self.usable_from <= now <= self.expires_at
