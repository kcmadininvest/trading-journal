from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal


class TradeContext(models.Model):
    """
    Contexte de marché au moment du trade.
    Capture les conditions techniques multi-timeframe.
    """
    
    TREND_CHOICES = [
        ('bullish', 'Bullish'),
        ('bearish', 'Bearish'),
        ('ranging', 'Ranging'),
        ('unclear', 'Unclear'),
    ]
    
    FIBONACCI_CHOICES = [
        ('23.6', '23.6%'),
        ('38.2', '38.2%'),
        ('50', '50%'),
        ('61.8', '61.8%'),
        ('78.6', '78.6%'),
        ('none', 'None'),
    ]
    
    MARKET_STRUCTURE_CHOICES = [
        ('higher_highs', 'Higher Highs'),
        ('lower_lows', 'Lower Lows'),
        ('consolidation', 'Consolidation'),
    ]
    
    RANGE_POSITION_CHOICES = [
        ('top_third', 'Top Third'),
        ('middle_third', 'Middle Third'),
        ('bottom_third', 'Bottom Third'),
    ]
    
    VOLUME_PROFILE_CHOICES = [
        ('high', 'High'),
        ('medium', 'Medium'),
        ('low', 'Low'),
    ]
    
    MACD_SIGNAL_CHOICES = [
        ('bullish', 'Bullish'),
        ('bearish', 'Bearish'),
        ('neutral', 'Neutral'),
    ]
    
    # Relations
    trade = models.OneToOneField(
        'TopStepTrade',
        on_delete=models.CASCADE,
        related_name='context',
        verbose_name='Trade'
    )
    
    # Analyse multi-timeframe
    trend_m1 = models.CharField(
        max_length=10,
        choices=TREND_CHOICES,
        null=True,
        blank=True,
        verbose_name='Tendance M1'
    )
    trend_m2 = models.CharField(
        max_length=10,
        choices=TREND_CHOICES,
        null=True,
        blank=True,
        verbose_name='Tendance M2'
    )
    trend_m5 = models.CharField(
        max_length=10,
        choices=TREND_CHOICES,
        null=True,
        blank=True,
        verbose_name='Tendance M5'
    )
    trend_m15 = models.CharField(
        max_length=10,
        choices=TREND_CHOICES,
        null=True,
        blank=True,
        verbose_name='Tendance M15'
    )
    trend_m30 = models.CharField(
        max_length=10,
        choices=TREND_CHOICES,
        null=True,
        blank=True,
        verbose_name='Tendance M30'
    )
    trend_h1 = models.CharField(
        max_length=10,
        choices=TREND_CHOICES,
        null=True,
        blank=True,
        verbose_name='Tendance H1'
    )
    trend_h4 = models.CharField(
        max_length=10,
        choices=TREND_CHOICES,
        null=True,
        blank=True,
        verbose_name='Tendance H4'
    )
    trend_daily = models.CharField(
        max_length=10,
        choices=TREND_CHOICES,
        null=True,
        blank=True,
        verbose_name='Tendance Daily'
    )
    trend_weekly = models.CharField(
        max_length=10,
        choices=TREND_CHOICES,
        null=True,
        blank=True,
        verbose_name='Tendance Weekly'
    )
    trend_alignment = models.BooleanField(
        null=True,
        blank=True,
        verbose_name='Tendances alignées'
    )
    
    # Niveaux techniques
    fibonacci_level = models.CharField(
        max_length=10,
        choices=FIBONACCI_CHOICES,
        default='none',
        verbose_name='Niveau Fibonacci'
    )
    at_support_resistance = models.BooleanField(
        default=False,
        verbose_name='Au support/résistance'
    )
    distance_from_key_level = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name='Distance du niveau clé (points)'
    )
    
    # Structure de marché
    market_structure = models.CharField(
        max_length=20,
        choices=MARKET_STRUCTURE_CHOICES,
        null=True,
        blank=True,
        verbose_name='Structure de marché'
    )
    break_of_structure = models.BooleanField(
        default=False,
        verbose_name='Break of structure'
    )
    
    # Range et volatilité
    within_previous_day_range = models.BooleanField(
        default=False,
        verbose_name='Dans le range de la veille'
    )
    range_position = models.CharField(
        max_length=15,
        choices=RANGE_POSITION_CHOICES,
        null=True,
        blank=True,
        verbose_name='Position dans le range'
    )
    atr_percentile = models.IntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        verbose_name='ATR percentile',
        help_text='ATR par rapport à la moyenne 20 jours (0-100)'
    )
    
    # Volume et liquidité
    volume_profile = models.CharField(
        max_length=10,
        choices=VOLUME_PROFILE_CHOICES,
        null=True,
        blank=True,
        verbose_name='Profil de volume'
    )
    at_volume_node = models.BooleanField(
        default=False,
        verbose_name='Au nœud de volume'
    )
    
    # Indicateurs techniques
    rsi_value = models.IntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        verbose_name='Valeur RSI'
    )
    macd_signal = models.CharField(
        max_length=10,
        choices=MACD_SIGNAL_CHOICES,
        null=True,
        blank=True,
        verbose_name='Signal MACD'
    )
    
    # Métadonnées
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Créé le')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Modifié le')
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Contexte de Trade'
        verbose_name_plural = 'Contextes de Trades'
        indexes = [
            models.Index(fields=['trade']),
            models.Index(fields=['trend_m15', 'fibonacci_level']),
            models.Index(fields=['trend_alignment']),
        ]
    
    def __str__(self):
        return f"Contexte {self.trade.contract_name} - {self.trade.entered_at.strftime('%d/%m/%Y')}"
    
    def save(self, *args, **kwargs):
        # Calculer automatiquement l'alignement des tendances
        if self.trend_m15 and self.trend_m5 and self.trend_h1:
            self.trend_alignment = (
                self.trend_m15 == self.trend_m5 == self.trend_h1 and
                self.trend_m15 in ['bullish', 'bearish']
            )
        super().save(*args, **kwargs)


class TradeSetup(models.Model):
    """
    Configuration d'entrée et taxonomie du setup de trading.
    """
    
    SETUP_CATEGORY_CHOICES = [
        ('pullback', 'Pullback'),
        ('breakout', 'Breakout'),
        ('reversal', 'Reversal'),
        ('continuation', 'Continuation'),
        ('range_bound', 'Range Bound'),
        ('news_driven', 'News Driven'),
        ('scalp', 'Scalp'),
        ('other', 'Other'),
    ]
    
    CHART_PATTERN_CHOICES = [
        ('double_top', 'Double Top'),
        ('double_bottom', 'Double Bottom'),
        ('head_shoulders', 'Head & Shoulders'),
        ('triangle', 'Triangle'),
        ('flag', 'Flag'),
        ('wedge', 'Wedge'),
        ('channel', 'Channel'),
        ('none', 'None'),
    ]
    
    SETUP_QUALITY_CHOICES = [
        ('A', 'A - Excellent'),
        ('B', 'B - Good'),
        ('C', 'C - Average'),
        ('D', 'D - Poor'),
        ('F', 'F - Very Poor'),
    ]
    
    ENTRY_TIMING_CHOICES = [
        ('early', 'Early'),
        ('optimal', 'Optimal'),
        ('late', 'Late'),
        ('missed', 'Missed'),
    ]
    
    # Relations
    trade = models.OneToOneField(
        'TopStepTrade',
        on_delete=models.CASCADE,
        related_name='setup',
        verbose_name='Trade'
    )
    
    # Classification du setup
    setup_category = models.CharField(
        max_length=20,
        choices=SETUP_CATEGORY_CHOICES,
        verbose_name='Catégorie de setup'
    )
    setup_subcategory = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Sous-catégorie',
        help_text='Ex: pullback_to_ema, breakout_consolidation'
    )
    
    # Pattern identifié
    chart_pattern = models.CharField(
        max_length=20,
        choices=CHART_PATTERN_CHOICES,
        default='none',
        verbose_name='Pattern chartiste'
    )
    
    # Confluence (facteurs de confirmation)
    confluence_factors = models.JSONField(
        default=list,
        verbose_name='Facteurs de confluence',
        help_text='Liste des facteurs de confirmation'
    )
    confluence_count = models.IntegerField(
        default=0,
        verbose_name='Nombre de confluences'
    )
    
    # Qualité du setup
    setup_quality = models.CharField(
        max_length=1,
        choices=SETUP_QUALITY_CHOICES,
        verbose_name='Qualité du setup'
    )
    setup_confidence = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(10)],
        null=True,
        blank=True,
        verbose_name='Confiance (1-10)'
    )
    
    # Timing
    entry_timing = models.CharField(
        max_length=10,
        choices=ENTRY_TIMING_CHOICES,
        null=True,
        blank=True,
        verbose_name='Timing d\'entrée'
    )
    
    # Analyse du setup (pour détection des biais comportementaux)
    entry_in_range_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0')), MaxValueValidator(Decimal('100'))],
        verbose_name='Position d\'entrée dans le range du jour (%)',
        help_text='0% = bas du range, 100% = haut du range'
    )
    missed_better_entry = models.BooleanField(
        default=False,
        verbose_name='Meilleure entrée ratée',
        help_text='Avez-vous raté une meilleure entrée avant ?'
    )
    planned_hold_duration = models.IntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1)],
        verbose_name='Durée prévue en position (minutes)',
        help_text='Combien de temps prévoyiez-vous de rester en position ?'
    )
    
    # Métadonnées
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Créé le')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Modifié le')
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Setup de Trade'
        verbose_name_plural = 'Setups de Trades'
        indexes = [
            models.Index(fields=['trade']),
            models.Index(fields=['setup_category', 'setup_quality']),
        ]
    
    def __str__(self):
        return f"Setup {self.get_setup_category_display()} ({self.setup_quality}) - {self.trade.contract_name}"
    
    def save(self, *args, **kwargs):
        # Calculer automatiquement le nombre de confluences
        if isinstance(self.confluence_factors, list):
            self.confluence_count = len(self.confluence_factors)
        super().save(*args, **kwargs)


class SessionContext(models.Model):
    """
    Contexte de session et état du trader.
    """
    
    TRADING_SESSION_CHOICES = [
        ('asian', 'Asian'),
        ('london', 'London'),
        ('new_york', 'New York'),
        ('overlap_london_ny', 'London/NY Overlap'),
        ('after_hours', 'After Hours'),
    ]
    
    NEWS_IMPACT_CHOICES = [
        ('high', 'High'),
        ('medium', 'Medium'),
        ('low', 'Low'),
        ('none', 'None'),
    ]
    
    DAY_OF_WEEK_CHOICES = [
        ('monday', 'Monday'),
        ('tuesday', 'Tuesday'),
        ('wednesday', 'Wednesday'),
        ('thursday', 'Thursday'),
        ('friday', 'Friday'),
    ]
    
    PHYSICAL_STATE_CHOICES = [
        ('rested', 'Rested'),
        ('tired', 'Tired'),
        ('sick', 'Sick'),
        ('optimal', 'Optimal'),
    ]
    
    MENTAL_STATE_CHOICES = [
        ('focused', 'Focused'),
        ('distracted', 'Distracted'),
        ('stressed', 'Stressed'),
        ('confident', 'Confident'),
    ]
    
    PREVIOUS_TRADE_RESULT_CHOICES = [
        ('win', 'Win'),
        ('loss', 'Loss'),
        ('breakeven', 'Breakeven'),
        ('first_trade_of_session', 'First Trade of Session'),
    ]
    
    TRADE_MOTIVATION_CHOICES = [
        ('setup_signal', 'Setup Signal'),
        ('fomo', 'FOMO'),
        ('revenge', 'Revenge'),
        ('boredom', 'Boredom'),
        ('recovery_attempt', 'Recovery Attempt'),
        ('planned', 'Planned'),
    ]
    
    # Relations
    trade = models.OneToOneField(
        'TopStepTrade',
        on_delete=models.CASCADE,
        related_name='session_context',
        verbose_name='Trade'
    )
    
    # Session de trading
    trading_session = models.CharField(
        max_length=20,
        choices=TRADING_SESSION_CHOICES,
        verbose_name='Session de trading'
    )
    session_time_slot = models.CharField(
        max_length=20,
        blank=True,
        verbose_name='Créneau horaire',
        help_text='Ex: 09:30-10:00'
    )
    
    # Événements externes (format JSON pour gérer plusieurs événements)
    news_events = models.JSONField(
        null=True,
        blank=True,
        default=list,
        verbose_name='Événements externes',
        help_text='Liste d\'événements externes avec impact et description'
    )
    
    # Jour de la semaine
    day_of_week = models.CharField(
        max_length=10,
        choices=DAY_OF_WEEK_CHOICES,
        verbose_name='Jour de la semaine'
    )
    is_first_trade_of_day = models.BooleanField(
        default=False,
        verbose_name='Premier trade du jour'
    )
    is_last_trade_of_day = models.BooleanField(
        default=False,
        verbose_name='Dernier trade du jour'
    )
    
    # État du trader
    physical_state = models.CharField(
        max_length=10,
        choices=PHYSICAL_STATE_CHOICES,
        null=True,
        blank=True,
        verbose_name='État physique'
    )
    mental_state = models.CharField(
        max_length=15,
        choices=MENTAL_STATE_CHOICES,
        null=True,
        blank=True,
        verbose_name='État mental'
    )
    
    # Contexte personnel
    hours_of_sleep = models.IntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(24)],
        verbose_name='Heures de sommeil'
    )
    
    # Contexte du trade (pour détection des biais comportementaux)
    previous_trade_result = models.CharField(
        max_length=25,
        choices=PREVIOUS_TRADE_RESULT_CHOICES,
        null=True,
        blank=True,
        verbose_name='Résultat du trade précédent'
    )
    minutes_since_last_trade = models.IntegerField(
        null=True,
        blank=True,
        verbose_name='Minutes depuis le dernier trade',
        help_text='Calculé automatiquement'
    )
    trade_motivation = models.CharField(
        max_length=20,
        choices=TRADE_MOTIVATION_CHOICES,
        null=True,
        blank=True,
        verbose_name='Motivation principale du trade'
    )
    
    # Métadonnées
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Créé le')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Modifié le')
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Contexte de Session'
        verbose_name_plural = 'Contextes de Sessions'
        indexes = [
            models.Index(fields=['trade']),
            models.Index(fields=['trading_session', 'day_of_week']),
        ]
    
    def __str__(self):
        return f"Session {self.get_trading_session_display()} - {self.get_day_of_week_display()}"


class TradeExecution(models.Model):
    """
    Détails de l'exécution et respect du plan de trading.
    """
    
    STOP_LOSS_DIRECTION_CHOICES = [
        ('tighter', 'Tighter'),
        ('wider', 'Wider'),
        ('none', 'None'),
    ]
    
    EXIT_REASON_CHOICES = [
        ('take_profit_hit', 'Take Profit Hit'),
        ('stop_loss_hit', 'Stop Loss Hit'),
        ('manual_exit', 'Manual Exit'),
        ('time_based', 'Time Based'),
        ('target_reached', 'Target Reached'),
        ('setup_invalidated', 'Setup Invalidated'),
        ('emotional', 'Emotional'),
        ('news_event', 'News Event'),
    ]
    
    TIME_IN_POSITION_CHOICES = [
        ('much_shorter', 'Much Shorter'),
        ('shorter', 'Shorter'),
        ('as_planned', 'As Planned'),
        ('longer', 'Longer'),
        ('much_longer', 'Much Longer'),
    ]
    
    EXIT_EMOTIONAL_CONTEXT_CHOICES = [
        ('neutral', 'Neutral'),
        ('fear', 'Fear'),
        ('greed', 'Greed'),
        ('fomo', 'FOMO'),
        ('discipline', 'Discipline'),
    ]
    
    # Relations
    trade = models.OneToOneField(
        'TopStepTrade',
        on_delete=models.CASCADE,
        related_name='execution',
        verbose_name='Trade'
    )
    
    # Respect du plan
    followed_trading_plan = models.BooleanField(
        null=True,
        blank=True,
        verbose_name='Plan de trading respecté'
    )
    entry_as_planned = models.BooleanField(
        null=True,
        blank=True,
        verbose_name='Entrée comme prévu'
    )
    exit_as_planned = models.BooleanField(
        null=True,
        blank=True,
        verbose_name='Sortie comme prévu'
    )
    position_size_as_planned = models.BooleanField(
        null=True,
        blank=True,
        verbose_name='Taille de position comme prévu'
    )
    
    # Gestion du trade
    moved_stop_loss = models.BooleanField(
        default=False,
        verbose_name='Stop loss déplacé'
    )
    stop_loss_direction = models.CharField(
        max_length=10,
        choices=STOP_LOSS_DIRECTION_CHOICES,
        default='none',
        verbose_name='Direction du stop loss'
    )
    partial_exit_taken = models.BooleanField(
        default=False,
        verbose_name='Sortie partielle effectuée'
    )
    partial_exit_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0.01')), MaxValueValidator(Decimal('100.00'))],
        verbose_name='Pourcentage de sortie partielle'
    )
    
    # Raison de sortie
    exit_reason = models.CharField(
        max_length=20,
        choices=EXIT_REASON_CHOICES,
        null=True,
        blank=True,
        verbose_name='Raison de sortie'
    )
    
    # Erreurs d'exécution
    execution_errors = models.JSONField(
        default=list,
        verbose_name='Erreurs d\'exécution',
        help_text='Liste des erreurs commises'
    )
    slippage_points = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name='Slippage (points)'
    )
    
    # Post-trade
    would_take_again = models.BooleanField(
        null=True,
        blank=True,
        verbose_name='Reprendrait ce trade'
    )
    lesson_learned = models.TextField(
        blank=True,
        verbose_name='Leçon apprise'
    )
    
    # Gestion réelle (pour détection des biais comportementaux)
    time_in_position_vs_planned = models.CharField(
        max_length=15,
        choices=TIME_IN_POSITION_CHOICES,
        null=True,
        blank=True,
        verbose_name='Durée en position vs plan',
        help_text='Êtes-vous sorti trop tôt/tard ?'
    )
    exit_emotional_context = models.CharField(
        max_length=20,
        choices=EXIT_EMOTIONAL_CONTEXT_CHOICES,
        null=True,
        blank=True,
        default='neutral',
        verbose_name='Contexte émotionnel de sortie',
        help_text='État émotionnel lors de la sortie'
    )
    position_size_change_reason = models.TextField(
        blank=True,
        verbose_name='Raison du changement de taille',
        help_text='Pourquoi avez-vous modifié la taille de position ?'
    )
    
    # Métadonnées
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Créé le')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Modifié le')
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Exécution de Trade'
        verbose_name_plural = 'Exécutions de Trades'
        indexes = [
            models.Index(fields=['trade']),
            models.Index(fields=['followed_trading_plan']),
            models.Index(fields=['exit_reason']),
        ]
    
    def __str__(self):
        plan_status = "Respecté" if self.followed_trading_plan else "Non respecté"
        return f"Exécution {self.trade.contract_name} - {plan_status}"
    
    def save(self, *args, **kwargs):
        # Calculer automatiquement si le plan a été suivi
        if self.followed_trading_plan is None:
            self.followed_trading_plan = (
                self.entry_as_planned and
                self.exit_as_planned and
                self.position_size_as_planned
            )
        super().save(*args, **kwargs)
