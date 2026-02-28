from django.db import models
from django.conf import settings
from decimal import Decimal


class TradeProbabilityFactor(models.Model):
    """
    Table de référence pour les facteurs de probabilité analysables.
    Permet de créer dynamiquement des filtres et requêtes statistiques.
    """
    
    FACTOR_TYPE_CHOICES = [
        ('boolean', 'Boolean'),
        ('categorical', 'Categorical'),
        ('numerical', 'Numerical'),
    ]
    
    factor_category = models.CharField(
        max_length=50,
        verbose_name='Catégorie',
        help_text='Ex: trend, level, timing, setup'
    )
    factor_name = models.CharField(
        max_length=100,
        unique=True,
        verbose_name='Nom du facteur'
    )
    factor_type = models.CharField(
        max_length=15,
        choices=FACTOR_TYPE_CHOICES,
        verbose_name='Type de facteur'
    )
    possible_values = models.JSONField(
        default=list,
        verbose_name='Valeurs possibles',
        help_text='Pour les facteurs catégoriels'
    )
    description = models.TextField(
        blank=True,
        verbose_name='Description'
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='Actif'
    )
    
    # Métadonnées
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Créé le')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Modifié le')
    
    class Meta:
        ordering = ['factor_category', 'factor_name']
        verbose_name = 'Facteur de Probabilité'
        verbose_name_plural = 'Facteurs de Probabilité'
        indexes = [
            models.Index(fields=['factor_category']),
            models.Index(fields=['is_active']),
        ]
    
    def __str__(self):
        return f"{self.factor_category}: {self.factor_name}"


class TradeTag(models.Model):
    """
    Système de tags personnalisables pour catégorisation flexible.
    """
    
    TAG_CATEGORY_CHOICES = [
        ('setup', 'Setup'),
        ('mistake', 'Mistake'),
        ('market_condition', 'Market Condition'),
        ('strategy', 'Strategy'),
        ('other', 'Other'),
    ]
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='trade_tags',
        verbose_name='Utilisateur'
    )
    name = models.CharField(
        max_length=50,
        verbose_name='Nom du tag'
    )
    color = models.CharField(
        max_length=7,
        default='#3B82F6',
        verbose_name='Couleur',
        help_text='Code couleur hexadécimal (ex: #3B82F6)'
    )
    category = models.CharField(
        max_length=20,
        choices=TAG_CATEGORY_CHOICES,
        default='other',
        verbose_name='Catégorie'
    )
    description = models.TextField(
        blank=True,
        verbose_name='Description'
    )
    
    # Métadonnées
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Créé le')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Modifié le')
    
    class Meta:
        ordering = ['category', 'name']
        verbose_name = 'Tag de Trade'
        verbose_name_plural = 'Tags de Trades'
        unique_together = ['user', 'name']
        indexes = [
            models.Index(fields=['user', 'category']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.get_category_display()})"


class TradeTagAssignment(models.Model):
    """
    Table intermédiaire pour l'association ManyToMany entre trades et tags.
    """
    
    trade = models.ForeignKey(
        'TopStepTrade',
        on_delete=models.CASCADE,
        related_name='tag_assignments',
        verbose_name='Trade'
    )
    tag = models.ForeignKey(
        TradeTag,
        on_delete=models.CASCADE,
        related_name='trade_assignments',
        verbose_name='Tag'
    )
    
    # Métadonnées
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Créé le')
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Attribution de Tag'
        verbose_name_plural = 'Attributions de Tags'
        unique_together = ['trade', 'tag']
        indexes = [
            models.Index(fields=['trade']),
            models.Index(fields=['tag']),
        ]
    
    def __str__(self):
        return f"{self.trade.contract_name} - {self.tag.name}"


class TradeStatistics(models.Model):
    """
    Cache des statistiques pré-calculées pour améliorer les performances.
    """
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='trade_statistics',
        verbose_name='Utilisateur'
    )
    trading_account = models.ForeignKey(
        'TradingAccount',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='statistics',
        verbose_name='Compte de trading'
    )
    
    # Critères de filtrage appliqués
    filter_criteria = models.JSONField(
        default=dict,
        verbose_name='Critères de filtrage',
        help_text='Critères utilisés pour calculer ces statistiques'
    )
    
    # Statistiques de base
    total_trades = models.IntegerField(
        default=0,
        verbose_name='Total de trades'
    )
    winning_trades = models.IntegerField(
        default=0,
        verbose_name='Trades gagnants'
    )
    losing_trades = models.IntegerField(
        default=0,
        verbose_name='Trades perdants'
    )
    
    # Métriques calculées
    win_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('0.00'),
        verbose_name='Taux de réussite (%)'
    )
    average_win = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=Decimal('0.00'),
        verbose_name='Gain moyen'
    )
    average_loss = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=Decimal('0.00'),
        verbose_name='Perte moyenne'
    )
    profit_factor = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name='Profit factor'
    )
    expectancy = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=Decimal('0.00'),
        verbose_name='Expectancy'
    )
    
    # Extremes
    largest_win = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=Decimal('0.00'),
        verbose_name='Plus gros gain'
    )
    largest_loss = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=Decimal('0.00'),
        verbose_name='Plus grosse perte'
    )
    
    # Durée moyenne
    average_duration = models.DurationField(
        null=True,
        blank=True,
        verbose_name='Durée moyenne'
    )
    
    # Métadonnées
    calculated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='Calculé le'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Créé le'
    )
    
    class Meta:
        ordering = ['-calculated_at']
        verbose_name = 'Statistique de Trade'
        verbose_name_plural = 'Statistiques de Trades'
        indexes = [
            models.Index(fields=['user', '-calculated_at']),
            models.Index(fields=['trading_account', '-calculated_at']),
        ]
    
    def __str__(self):
        return f"Stats {self.user.username} - {self.total_trades} trades - {self.win_rate}% WR"


class ConditionalProbability(models.Model):
    """
    Stockage des probabilités conditionnelles calculées.
    Permet de répondre rapidement aux requêtes "Quelle est ma probabilité si...".
    """
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='conditional_probabilities',
        verbose_name='Utilisateur'
    )
    
    # Ensemble de conditions
    condition_set = models.JSONField(
        verbose_name='Ensemble de conditions',
        help_text='Ex: {"trend_m15": "bullish", "fibonacci_level": "50"}'
    )
    
    # Taille de l'échantillon
    sample_size = models.IntegerField(
        verbose_name='Taille de l\'échantillon'
    )
    
    # Métriques calculées
    win_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        verbose_name='Taux de réussite (%)'
    )
    average_rr = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name='R:R moyen'
    )
    expectancy = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        verbose_name='Expectancy'
    )
    confidence_interval = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name='Intervalle de confiance (%)'
    )
    
    # Significativité statistique
    is_statistically_significant = models.BooleanField(
        default=False,
        verbose_name='Statistiquement significatif',
        help_text='True si sample_size >= 30'
    )
    
    # Métadonnées
    calculated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='Calculé le'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Créé le'
    )
    
    class Meta:
        ordering = ['-calculated_at']
        verbose_name = 'Probabilité Conditionnelle'
        verbose_name_plural = 'Probabilités Conditionnelles'
        indexes = [
            models.Index(fields=['user', '-calculated_at']),
            models.Index(fields=['is_statistically_significant']),
        ]
    
    def __str__(self):
        significance = "✓" if self.is_statistically_significant else "✗"
        return f"{significance} {self.win_rate}% WR (n={self.sample_size})"
    
    def save(self, *args, **kwargs):
        # Calculer automatiquement la significativité statistique
        self.is_statistically_significant = self.sample_size >= 30
        super().save(*args, **kwargs)
