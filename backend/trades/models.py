from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator
from decimal import Decimal
from datetime import datetime, timedelta
import pytz


class TradingAccount(models.Model):
    """
    Modèle pour gérer plusieurs comptes de trading par utilisateur.
    Chaque utilisateur peut avoir plusieurs comptes (TopStep, IBKR, etc.)
    """
    
    ACCOUNT_TYPE_CHOICES = [
        ('topstep', 'TopStep'),
        ('ibkr', 'Interactive Brokers'),
        ('ninjatrader', 'NinjaTrader'),
        ('tradovate', 'Tradovate'),
        ('other', 'Autre'),
    ]
    
    STATUS_CHOICES = [
        ('active', 'Actif'),
        ('inactive', 'Inactif'),
        ('archived', 'Archivé'),
    ]
    
    # Identification
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='trading_accounts',
        verbose_name='Utilisateur'
    )
    
    # Informations du compte
    name = models.CharField(
        max_length=100,
        verbose_name='Nom du compte',
        help_text='Nom personnalisé pour identifier ce compte'
    )
    
    account_type = models.CharField(
        max_length=20,
        choices=ACCOUNT_TYPE_CHOICES,
        verbose_name='Type de compte',
        help_text='Type de broker ou plateforme'
    )
    
    broker_account_id = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='ID du compte broker',
        help_text='Identifiant du compte chez le broker'
    )
    
    # Configuration
    currency = models.CharField(
        max_length=3,
        default='USD',
        verbose_name='Devise',
        help_text='Devise principale du compte'
    )
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active',
        verbose_name='Statut'
    )
    
    # Configuration spécifique au broker (JSON pour flexibilité)
    broker_config = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='Configuration broker',
        help_text='Configuration spécifique au type de broker'
    )
    
    # Métadonnées
    description = models.TextField(
        blank=True,
        verbose_name='Description',
        help_text='Description du compte'
    )
    
    is_default = models.BooleanField(
        default=False,  # type: ignore
        verbose_name='Compte par défaut',
        help_text='Compte sélectionné par défaut pour cet utilisateur'
    )
    
    # Métadonnées système
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Créé le'
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='Modifié le'
    )
    
    class Meta:
        ordering = ['-is_default', 'name']
        verbose_name = 'Compte de trading'
        verbose_name_plural = 'Comptes de trading'
        unique_together = ['user', 'name']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['account_type']),
            models.Index(fields=['is_default']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.get_account_type_display()})"  # type: ignore
    
    def save(self, *args, **kwargs):
        # S'assurer qu'un seul compte est marqué comme défaut par utilisateur
        if self.is_default:
            TradingAccount.objects.filter(  # type: ignore
                user=self.user, 
                is_default=True
            ).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)
    
    @property
    def is_topstep(self):
        """Vérifie si c'est un compte TopStep"""
        return self.account_type == 'topstep'
    
    @property
    def is_active(self):
        """Vérifie si le compte est actif"""
        return self.status == 'active'


class TopStepTrade(models.Model):
    """
    Modèle pour stocker les trades importés depuis TopStep.
    Les données sont importées au format américain et converties au format européen.
    
    Format d'import CSV:
    Id,ContractName,EnteredAt,ExitedAt,EntryPrice,ExitPrice,Fees,PnL,Size,Type,TradeDay,TradeDuration,Commissions
    """
    
    TRADE_TYPE_CHOICES = [
        ('Long', 'Long'),
        ('Short', 'Short'),
    ]
    
    # Identification
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='topstep_trades',
        verbose_name='Utilisateur'
    )
    
    # Compte de trading associé
    trading_account = models.ForeignKey(
        TradingAccount,
        on_delete=models.CASCADE,
        related_name='topstep_trades',
        verbose_name='Compte de trading',
        help_text='Compte de trading associé à ce trade'
    )
    
    # Id (champ original TopStep)
    topstep_id = models.CharField(
        max_length=50,
        unique=True,
        verbose_name='ID TopStep',
        help_text='ID unique du trade dans TopStep'
    )
    
    # ContractName
    contract_name = models.CharField(
        max_length=50,
        verbose_name='Nom du contrat',
        help_text='Symbole du contrat (ex: NQZ5, ESH5, YMH5)',
        db_index=True
    )
    
    # EnteredAt (format US: 10/08/2025 18:23:28 +02:00)
    entered_at = models.DateTimeField(
        verbose_name='Date/Heure d\'entrée',
        help_text='Date et heure d\'entrée dans le trade'
    )
    
    # ExitedAt (format US: 10/08/2025 18:31:03 +02:00)
    exited_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Date/Heure de sortie',
        help_text='Date et heure de sortie du trade'
    )
    
    # EntryPrice (format US avec point décimal: 25261.750000000)
    entry_price = models.DecimalField(
        max_digits=18,
        decimal_places=9,
        validators=[MinValueValidator(Decimal('0.000000001'))],
        verbose_name='Prix d\'entrée',
        help_text='Prix d\'entrée (converti du format US)'
    )
    
    # ExitPrice (format US avec point décimal: 25245.750000000)
    exit_price = models.DecimalField(
        max_digits=18,
        decimal_places=9,
        null=True,
        blank=True,
        verbose_name='Prix de sortie',
        help_text='Prix de sortie (converti du format US)'
    )
    
    # Fees (format US: 8.40000)
    fees = models.DecimalField(
        max_digits=15,
        decimal_places=5,
        default=Decimal('0.00000'),
        verbose_name='Frais',
        help_text='Frais du trade (converti du format US)'
    )
    
    # PnL (format US: -960.000000000)
    pnl = models.DecimalField(
        max_digits=18,
        decimal_places=9,
        null=True,
        blank=True,
        verbose_name='Profit/Perte',
        help_text='Profit ou perte brut (converti du format US)'
    )
    
    # Size (quantité: 3)
    size = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        validators=[MinValueValidator(Decimal('0.0001'))],
        verbose_name='Taille (Quantité)',
        help_text='Nombre de contrats'
    )
    
    # Type (Long ou Short)
    trade_type = models.CharField(
        max_length=10,
        choices=TRADE_TYPE_CHOICES,
        verbose_name='Type de trade',
        db_index=True
    )
    
    # TradeDay (format US: 10/08/2025 00:00:00 -05:00)
    trade_day = models.DateField(
        null=True,
        blank=True,
        verbose_name='Jour de trading',
        help_text='Jour du trade (converti du format US)',
        db_index=True
    )
    
    # TradeDuration (format: 00:07:34.9942140)
    trade_duration = models.DurationField(
        null=True,
        blank=True,
        verbose_name='Durée du trade',
        help_text='Durée totale du trade'
    )
    
    # Commissions (peut être vide dans TopStep)
    commissions = models.DecimalField(
        max_digits=15,
        decimal_places=5,
        default=Decimal('0.00000'),
        verbose_name='Commissions',
        help_text='Commissions du trade'
    )
    
    # Champs calculés et métadonnées
    net_pnl = models.DecimalField(
        max_digits=18,
        decimal_places=9,
        null=True,
        blank=True,
        verbose_name='PnL Net',
        help_text='PnL après déduction des frais et commissions'
    )
    
    pnl_percentage = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True,
        verbose_name='PnL %',
        help_text='Pourcentage de profit/perte'
    )
    
    # Données brutes pour référence
    raw_data = models.JSONField(
        null=True,
        blank=True,
        verbose_name='Données brutes',
        help_text='Données originales au format JSON pour référence'
    )
    
    # Notes et stratégie
    notes = models.TextField(
        blank=True,
        verbose_name='Notes',
        help_text='Notes personnelles sur ce trade'
    )
    
    strategy = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Stratégie',
        help_text='Stratégie de trading utilisée'
    )
    
    # Métadonnées système
    imported_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Importé le'
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='Modifié le'
    )
    
    class Meta:
        ordering = ['-entered_at']
        verbose_name = 'Trade TopStep'
        verbose_name_plural = 'Trades TopStep'
        unique_together = ['user', 'trading_account', 'topstep_id']
        indexes = [
            models.Index(fields=['user', '-entered_at']),
            models.Index(fields=['trading_account', '-entered_at']),
            models.Index(fields=['contract_name']),
            models.Index(fields=['trade_type']),
            models.Index(fields=['trade_day']),
            models.Index(fields=['topstep_id']),
        ]
    
    def __str__(self):
        return f"{self.contract_name} - {self.trade_type} - {self.entered_at.strftime('%d/%m/%Y %H:%M')}"  # type: ignore
    
    def save(self, *args, **kwargs):
        """
        Calcule automatiquement le PnL net et le pourcentage avant sauvegarde.
        """
        # Calculer le PnL net
        if self.pnl is not None:
            self.net_pnl = self.pnl - self.fees - self.commissions  # type: ignore
            
            # Calculer le pourcentage de PnL
            if self.entry_price and self.size:
                investment = self.entry_price * self.size  # type: ignore
                if investment > 0:
                    self.pnl_percentage = (self.net_pnl / investment) * Decimal('100')
        
        super().save(*args, **kwargs)
    
    @property
    def is_profitable(self):
        """Indique si le trade est profitable."""
        return self.net_pnl > 0 if self.net_pnl is not None else None
    
    @property
    def duration_str(self):
        """Retourne la durée au format lisible."""
        if self.trade_duration:
            total_seconds = int(self.trade_duration.total_seconds())  # type: ignore
            hours, remainder = divmod(total_seconds, 3600)
            minutes, seconds = divmod(remainder, 60)
            return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
        return None
    
    @property
    def formatted_entry_date(self):
        """Retourne la date d'entrée au format européen DD/MM/YYYY HH:MM:SS."""
        return self.entered_at.strftime('%d/%m/%Y %H:%M:%S')  # type: ignore
    
    @property
    def formatted_exit_date(self):
        """Retourne la date de sortie au format européen DD/MM/YYYY HH:MM:SS."""
        if self.exited_at:
            return self.exited_at.strftime('%d/%m/%Y %H:%M:%S')  # type: ignore
        return None
    
    @property
    def formatted_entry_price(self):
        """Retourne le prix d'entrée au format européen avec virgule."""
        return str(self.entry_price).replace('.', ',')
    
    @property
    def formatted_exit_price(self):
        """Retourne le prix de sortie au format européen avec virgule."""
        if self.exit_price:
            return str(self.exit_price).replace('.', ',')
        return None
    
    @property
    def formatted_pnl(self):
        """Retourne le PnL au format européen avec virgule."""
        if self.pnl:
            return str(self.pnl).replace('.', ',')
        return None
    
    @classmethod
    def parse_us_datetime(cls, date_str):
        """
        Convertit une date au format américain TopStep vers datetime Python.
        Format attendu: 10/08/2025 18:23:28 +02:00 (MM/DD/YYYY HH:MM:SS +TZ)
        """
        try:
            # Séparer la date et le timezone
            parts = date_str.rsplit(' ', 1)
            date_part = parts[0]
            tz_part = parts[1] if len(parts) > 1 else '+00:00'
            
            # Parser la date (format américain MM/DD/YYYY)
            dt = datetime.strptime(date_part, '%m/%d/%Y %H:%M:%S')
            
            # Gérer le timezone
            tz_hours = int(tz_part[1:3])
            tz_minutes = int(tz_part[4:6])
            tz_offset = timedelta(hours=tz_hours, minutes=tz_minutes)
            if tz_part[0] == '-':
                tz_offset = -tz_offset
            
            # Créer un timezone aware datetime
            from django.utils import timezone as django_tz
            # La date_str contient déjà l'heure locale avec le décalage
            # On doit soustraire le décalage pour obtenir UTC
            dt = django_tz.make_aware(dt, pytz.UTC)
            dt = dt - tz_offset
            
            return dt
        except Exception as e:
            raise ValueError(f"Erreur lors du parsing de la date '{date_str}': {str(e)}")
    
    @classmethod
    def parse_us_decimal(cls, value_str):
        """
        Convertit une valeur décimale au format américain (avec point) vers Decimal.
        Format attendu: 25261.750000000
        """
        try:
            if not value_str or value_str.strip() == '':
                return None
            return Decimal(value_str.strip())
        except Exception as e:
            raise ValueError(f"Erreur lors du parsing du nombre '{value_str}': {str(e)}")
    
    @classmethod
    def parse_duration(cls, duration_str):
        """
        Convertit une durée au format TopStep vers timedelta.
        Format attendu: 00:07:34.9942140 (HH:MM:SS.microseconds)
        """
        try:
            if not duration_str or duration_str.strip() == '':
                return None
            
            # Séparer les secondes et les microsecondes
            if '.' in duration_str:
                time_part, micro_part = duration_str.split('.')
                microseconds = int(micro_part[:6].ljust(6, '0'))  # Prendre les 6 premiers chiffres
            else:
                time_part = duration_str
                microseconds = 0
            
            # Parser HH:MM:SS
            hours, minutes, seconds = map(int, time_part.split(':'))
            
            return timedelta(hours=hours, minutes=minutes, seconds=seconds, microseconds=microseconds)
        except Exception as e:
            raise ValueError(f"Erreur lors du parsing de la durée '{duration_str}': {str(e)}")


class TopStepImportLog(models.Model):
    """
    Journal des imports de fichiers TopStep pour traçabilité.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='topstep_imports',
        verbose_name='Utilisateur'
    )
    filename = models.CharField(
        max_length=255,
        verbose_name='Nom du fichier'
    )
    total_rows = models.IntegerField(
        verbose_name='Lignes totales'
    )
    success_count = models.IntegerField(
        verbose_name='Imports réussis'
    )
    error_count = models.IntegerField(
        verbose_name='Erreurs'
    )
    skipped_count = models.IntegerField(
        verbose_name='Doublons ignorés'
    )
    errors = models.JSONField(
        null=True,
        blank=True,
        verbose_name='Détails des erreurs'
    )
    imported_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Importé le'
    )
    
    class Meta:
        ordering = ['-imported_at']
        verbose_name = 'Log d\'import TopStep'
        verbose_name_plural = 'Logs d\'import TopStep'
    
    def __str__(self):
        return f"{self.filename} - {self.imported_at.strftime('%d/%m/%Y %H:%M')}"  # type: ignore


class TradeStrategy(models.Model):
    """
    Modèle pour stocker les données de stratégie liées à un trade spécifique.
    """
    
    EMOTION_CHOICES = [
        ('confiance', 'Confiance'),
        ('peur', 'Peur'),
        ('avarice', 'Avarice'),
        ('frustration', 'Frustration'),
        ('impatience', 'Impatience'),
        ('patience', 'Patience'),
        ('euphorie', 'Euphorie'),
        ('anxiete', 'Anxiété'),
        ('colere', 'Colère'),
        ('satisfaction', 'Satisfaction'),
        ('deception', 'Déception'),
        ('calme', 'Calme'),
        ('stress', 'Stress'),
        ('determination', 'Détermination'),
        ('doute', 'Doute'),
        ('excitation', 'Excitation'),
        ('lassitude', 'Lassitude'),
        ('fatigue', 'Fatigue'),
    ]
    
    SESSION_RATING_CHOICES = [
        (1, '1 - Très mauvaise'),
        (2, '2 - Mauvaise'),
        (3, '3 - Moyenne'),
        (4, '4 - Bonne'),
        (5, '5 - Excellente'),
    ]
    
    # Identification
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='trade_strategies',
        verbose_name='Utilisateur'
    )
    
    # Lien vers le trade TopStep
    trade = models.ForeignKey(
        TopStepTrade,
        on_delete=models.CASCADE,
        related_name='strategy_data',
        verbose_name='Trade associé'
    )
    
    # Respect de la stratégie
    strategy_respected = models.BooleanField(
        null=True,
        blank=True,
        verbose_name='Stratégie respectée',
        help_text='Avez-vous respecté votre stratégie ?'
    )
    
    # Émotions dominantes (choix multiple)
    dominant_emotions = models.JSONField(
        default=list,
        verbose_name='Émotions dominantes',
        help_text='Liste des émotions ressenties pendant ce trade'
    )
    
    # Gain si respect de la stratégie
    gain_if_strategy_respected = models.BooleanField(
        null=True,
        blank=True,
        verbose_name='Gain si stratégie respectée',
        help_text='Auriez-vous gagné en respectant la stratégie ?'
    )
    
    # Take Profit atteints
    tp1_reached = models.BooleanField(
        verbose_name='TP1 atteint',
        help_text='Premier Take Profit atteint'
    )
    
    tp2_plus_reached = models.BooleanField(
        verbose_name='TP2+ atteint',
        help_text='Deuxième Take Profit ou plus atteint'
    )
    
    # Note de la session
    session_rating = models.IntegerField(
        choices=SESSION_RATING_CHOICES,
        null=True,
        blank=True,
        verbose_name='Note de la session',
        help_text='Note de 1 à 5 pour ce trade'
    )
    
    # Détails des émotions
    emotion_details = models.TextField(
        blank=True,
        verbose_name='Détails des émotions',
        help_text='Description détaillée des émotions ressenties'
    )
    
    # Améliorations possibles
    possible_improvements = models.TextField(
        blank=True,
        verbose_name='Améliorations possibles',
        help_text='Points d\'amélioration identifiés'
    )
    
    # Screenshot
    screenshot_url = models.URLField(
        blank=True,
        verbose_name='URL Screenshot',
        help_text='Lien vers l\'image TradingView ou autre'
    )
    
    # Vidéo
    video_url = models.URLField(
        blank=True,
        verbose_name='URL Vidéo',
        help_text='Lien vers une vidéo YouTube ou autre'
    )
    
    # Métadonnées
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Créé le'
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='Modifié le'
    )
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Stratégie de Trade'
        verbose_name_plural = 'Stratégies de Trades'
        unique_together = ['user', 'trade']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['trade']),
        ]
    
    def __str__(self):
        return f"Stratégie {self.trade.contract_name} - {self.trade.entered_at.strftime('%d/%m/%Y')}"  # type: ignore
    
    @property
    def emotions_display(self):
        """Retourne les émotions au format lisible."""
        if not self.dominant_emotions:
            return "Aucune"
        emotion_labels = dict(self.EMOTION_CHOICES)
        return ", ".join([emotion_labels.get(emotion, emotion) for emotion in self.dominant_emotions])  # type: ignore


class PositionStrategy(models.Model):
    """
    Modèle pour stocker les stratégies de prise de position avec historique des versions.
    """
    
    STRATEGY_STATUS_CHOICES = [
        ('active', 'Active'),
        ('archived', 'Archivée'),
        ('draft', 'Brouillon'),
    ]
    
    # Identification
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='position_strategies',
        verbose_name='Utilisateur'
    )
    
    # Versioning
    version = models.PositiveIntegerField(
        default=1,  # type: ignore
        verbose_name='Version',
        help_text='Numéro de version de la stratégie'
    )
    
    parent_strategy = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='versions',
        verbose_name='Stratégie parente'
    )
    
    # Métadonnées
    title = models.CharField(
        max_length=200,
        verbose_name='Titre',
        help_text='Titre de la stratégie'
    )
    
    description = models.TextField(
        blank=True,
        verbose_name='Description',
        help_text='Description courte de la stratégie'
    )
    
    status = models.CharField(
        max_length=20,
        choices=STRATEGY_STATUS_CHOICES,
        default='draft',
        verbose_name='Statut'
    )
    
    # Contenu de la stratégie (format JSON pour flexibilité)
    strategy_content = models.JSONField(
        default=dict,
        verbose_name='Contenu de la stratégie',
        help_text='Contenu structuré de la stratégie'
    )
    
    # Métadonnées de version
    version_notes = models.TextField(
        blank=True,
        verbose_name='Notes de version',
        help_text='Notes sur les changements de cette version'
    )
    
    is_current = models.BooleanField(
        default=True,  # type: ignore
        verbose_name='Version actuelle',
        help_text='Indique si c\'est la version actuelle'
    )
    
    # Timestamps
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Créé le'
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='Modifié le'
    )
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Stratégie de Position'
        verbose_name_plural = 'Stratégies de Position'
        unique_together = ['user', 'parent_strategy', 'version']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['user', 'is_current']),
            models.Index(fields=['parent_strategy']),
        ]
    
    def __str__(self):
        return f"{self.title} v{self.version} - {self.get_status_display()}"  # type: ignore
    
    def save(self, *args, **kwargs):
        """Override save pour gérer le versioning automatique."""
        if not self.pk:  # Nouvelle stratégie
            # Marquer toutes les autres versions comme non actuelles
            if self.parent_strategy:
                PositionStrategy.objects.filter(  # type: ignore
                    parent_strategy=self.parent_strategy,
                    user=self.user
                ).update(is_current=False)
                self.version = self.parent_strategy.versions.count() + 1  # type: ignore
            else:
                # Première version
                self.version = 1
        super().save(*args, **kwargs)
    
    @property
    def is_latest_version(self):
        """Vérifie si c'est la dernière version."""
        if not self.parent_strategy:
            return True
        latest = self.parent_strategy.versions.order_by('-version').first()  # type: ignore
        return self == latest
    
    def get_version_history(self):
        """Retourne l'historique des versions."""
        if self.parent_strategy:
            return self.parent_strategy.versions.order_by('-version')  # type: ignore
        return self.versions.order_by('-version')  # type: ignore
    
    def create_new_version(self, new_content, version_notes=''):
        """Crée une nouvelle version de la stratégie."""
        # Marquer toutes les autres versions comme non actuelles
        parent = self.parent_strategy or self
        
        # Marquer toutes les versions de ce parent comme non actuelles
        PositionStrategy.objects.filter(  # type: ignore
            parent_strategy=parent,
            user=self.user
        ).update(is_current=False)
        
        # Marquer aussi la stratégie parente comme non actuelle
        parent.is_current = False  # type: ignore
        parent.save()  # type: ignore
        
        # Calculer le nouveau numéro de version
        new_version = parent.versions.count() + 1  # type: ignore
        
        new_strategy = PositionStrategy.objects.create(  # type: ignore
            user=self.user,
            parent_strategy=parent,
            title=self.title,
            description=self.description,
            strategy_content=new_content,
            version_notes=version_notes,
            status=self.status,
            version=new_version,
            is_current=True  # La nouvelle version est actuelle
        )
        
        # Archiver l'ancienne version si elle était active
        if self.status == 'active':
            self.status = 'archived'
            self.save()
        
        return new_strategy
