from __future__ import annotations

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class MarketPhaseDefinition(models.Model):
    """Catalogue des blocs de phase (système + custom user)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='market_phase_definitions',
        verbose_name='Utilisateur',
    )
    code = models.CharField(max_length=64, verbose_name='Code')
    label = models.CharField(max_length=120, verbose_name='Libellé')
    color = models.CharField(max_length=7, default='#6366F1', verbose_name='Couleur')
    is_system = models.BooleanField(default=False, verbose_name='Système')
    is_active = models.BooleanField(default=True, verbose_name='Actif')
    sort_order = models.PositiveIntegerField(default=0, verbose_name='Ordre')

    class Meta:
        ordering = ['sort_order', 'code']
        verbose_name = 'Définition de phase marché'
        verbose_name_plural = 'Définitions de phases marché'
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'code'],
                condition=models.Q(user__isnull=False),
                name='uniq_market_phase_def_user_code',
            ),
            models.UniqueConstraint(
                fields=['code'],
                condition=models.Q(user__isnull=True, is_system=True),
                name='uniq_market_phase_def_system_code',
            ),
        ]
        indexes = [
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['is_system', 'is_active']),
        ]

    def __str__(self) -> str:
        return self.label


class MarketPhaseEventDefinition(models.Model):
    """Catalogue des événements ponctuels."""

    CATEGORY_CHOICES = [
        ('breakout', 'Breakout'),
        ('reentry', 'Réintégration'),
        ('push', 'Poussée'),
        ('other', 'Autre'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='market_phase_event_definitions',
        verbose_name='Utilisateur',
    )
    code = models.CharField(max_length=64, verbose_name='Code')
    label = models.CharField(max_length=120, verbose_name='Libellé')
    category = models.CharField(max_length=16, choices=CATEGORY_CHOICES, default='other')
    is_system = models.BooleanField(default=False, verbose_name='Système')
    is_active = models.BooleanField(default=True, verbose_name='Actif')
    sort_order = models.PositiveIntegerField(default=0, verbose_name='Ordre')

    class Meta:
        ordering = ['sort_order', 'code']
        verbose_name = 'Définition événement phase marché'
        verbose_name_plural = 'Définitions événements phase marché'
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'code'],
                condition=models.Q(user__isnull=False),
                name='uniq_market_phase_event_def_user_code',
            ),
            models.UniqueConstraint(
                fields=['code'],
                condition=models.Q(user__isnull=True, is_system=True),
                name='uniq_market_phase_event_def_system_code',
            ),
        ]

    def __str__(self) -> str:
        return self.label


class MarketPhaseSlotConfig(models.Model):
    """Préférences utilisateur pour agrégation analytics et capture."""

    MODE_CHOICES = [
        ('fixed', 'Fixe'),
        ('custom', 'Personnalisé'),
        ('hour', 'Heures pleines'),
    ]
    ANCHOR_CHOICES = [
        ('market_open', 'Ouverture marché'),
        ('clock_hour', 'Heure pleine'),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='market_phase_slot_config',
        verbose_name='Utilisateur',
    )
    mode = models.CharField(max_length=16, choices=MODE_CHOICES, default='hour')
    duration_minutes = models.PositiveSmallIntegerField(default=60)
    anchor = models.CharField(max_length=16, choices=ANCHOR_CHOICES, default='clock_hour')
    market_code = models.CharField(max_length=16, default='NYSE')
    custom_boundaries = models.JSONField(default=list, blank=True)
    custom_analytical_periods = models.JSONField(
        default=list,
        blank=True,
        help_text='[{"key":"midi","label":"Midi","start":"12:00","end":"14:00"}]',
    )
    default_instrument_key = models.CharField(max_length=32, default='nasdaq', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Config créneaux phases marché'
        verbose_name_plural = 'Configs créneaux phases marché'


class SessionMarketPhaseBlock(models.Model):
    """Bloc de phase sur une plage horaire flexible."""

    PRECEDING_CONTEXT_CHOICES = [
        ('none', 'Aucun'),
        ('after_bullish_push', 'Après poussée haussière'),
        ('after_bearish_push', 'Après poussée baissière'),
        ('after_range', 'Après range'),
        ('after_news', 'Après news'),
    ]
    SOURCE_CHOICES = [
        ('live', 'Live'),
        ('replay', 'Replay'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='market_phase_blocks',
    )
    trading_account = models.ForeignKey(
        'TradingAccount',
        on_delete=models.CASCADE,
        related_name='market_phase_blocks',
    )
    session_date = models.DateField(db_index=True)
    instrument_key = models.CharField(max_length=32, db_index=True)
    range_start = models.TimeField()
    range_end = models.TimeField(null=True, blank=True)
    phase = models.ForeignKey(
        MarketPhaseDefinition,
        on_delete=models.PROTECT,
        related_name='blocks',
    )
    preceding_context = models.CharField(
        max_length=32,
        choices=PRECEDING_CONTEXT_CHOICES,
        default='none',
    )
    notes = models.CharField(max_length=120, blank=True, default='')
    source = models.CharField(max_length=16, choices=SOURCE_CHOICES, default='live')
    trading_session = models.ForeignKey(
        'TradingSession',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='market_phase_blocks',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['session_date', 'range_start']
        verbose_name = 'Bloc phase marché'
        verbose_name_plural = 'Blocs phases marché'
        indexes = [
            models.Index(fields=['user', 'session_date']),
            models.Index(fields=['trading_account', 'session_date', 'instrument_key']),
        ]

    def clean(self) -> None:
        if self.range_end and self.range_start and self.range_end <= self.range_start:
            raise ValidationError({'range_end': 'La fin doit être après le début.'})

    def __str__(self) -> str:
        end = self.range_end.strftime('%H:%M') if self.range_end else '…'
        return f'{self.session_date} {self.range_start:%H:%M}-{end}'


class SessionMarketPhaseEvent(models.Model):
    """Événement ponctuel dans une session."""

    DIRECTION_CHOICES = [
        ('up', 'Haut'),
        ('down', 'Bas'),
        ('neutral', 'Neutre'),
    ]
    CANDLE_PART_CHOICES = [
        ('body', 'Corps'),
        ('wick', 'Mèche'),
        ('unknown', 'Inconnu'),
    ]
    OUTCOME_CHOICES = [
        ('hold', 'Maintien'),
        ('reentry', 'Réintégration'),
        ('unknown', 'Inconnu'),
    ]
    SOURCE_CHOICES = [
        ('live', 'Live'),
        ('replay', 'Replay'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='market_phase_events',
    )
    trading_account = models.ForeignKey(
        'TradingAccount',
        on_delete=models.CASCADE,
        related_name='market_phase_events',
    )
    session_date = models.DateField(db_index=True)
    instrument_key = models.CharField(max_length=32, db_index=True)
    occurred_at = models.TimeField(db_index=True)
    event_type = models.ForeignKey(
        MarketPhaseEventDefinition,
        on_delete=models.PROTECT,
        related_name='events',
    )
    direction = models.CharField(max_length=8, choices=DIRECTION_CHOICES, default='neutral')
    candle_part = models.CharField(max_length=8, choices=CANDLE_PART_CHOICES, default='unknown')
    outcome = models.CharField(max_length=8, choices=OUTCOME_CHOICES, default='unknown')
    parent_block = models.ForeignKey(
        SessionMarketPhaseBlock,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='events',
    )
    attributes = models.JSONField(default=dict, blank=True)
    source = models.CharField(max_length=16, choices=SOURCE_CHOICES, default='live')
    trading_session = models.ForeignKey(
        'TradingSession',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='market_phase_events',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['session_date', 'occurred_at']
        verbose_name = 'Événement phase marché'
        verbose_name_plural = 'Événements phases marché'
        indexes = [
            models.Index(fields=['session_date', 'occurred_at']),
            models.Index(fields=['parent_block']),
            models.Index(fields=['trading_account', 'session_date', 'instrument_key']),
        ]

    def __str__(self) -> str:
        return f'{self.session_date} {self.occurred_at:%H:%M} {self.event_type_id}'
