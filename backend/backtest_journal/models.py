from django.conf import settings
from django.db import models


DIRECTION_CHOICES = (
    ('LONG', 'Long'),
    ('SHORT', 'Short'),
)

RESULT_STATUS_CHOICES = (
    ('WIN', 'Win'),
    ('LOSS', 'Loss'),
    ('BREAKEVEN', 'Breakeven'),
    ('PARTIAL', 'Partial'),
    ('OPEN', 'Open'),
    ('NOT_TAKEN', 'Not taken'),
)

RESULT_R_SOURCE_CHOICES = (
    ('calculated', 'Calculated'),
    ('manual', 'Manual'),
)

FINAL_RESULT_STATUSES = frozenset({'WIN', 'LOSS', 'BREAKEVEN', 'PARTIAL'})

STRATEGY_STATUS_CHOICES = (
    ('active', 'Active'),
    ('archived', 'Archived'),
)

CAMPAIGN_STATUS_CHOICES = (
    ('DRAFT', 'Draft'),
    ('IN_PROGRESS', 'In progress'),
    ('COMPLETED', 'Completed'),
    ('ARCHIVED', 'Archived'),
)


class ManualBacktestStrategy(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='manual_backtest_strategies',
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    default_instrument = models.CharField(max_length=32, blank=True)
    status = models.CharField(
        max_length=16,
        choices=STRATEGY_STATUS_CHOICES,
        default='active',
    )
    position_strategy = models.ForeignKey(
        'trades.PositionStrategy',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='manual_backtest_journals',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['user', 'status', '-updated_at']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'position_strategy'],
                condition=models.Q(position_strategy__isnull=False),
                name='uniq_backtest_strategy_position',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.name} ({self.user_id})'


class ManualBacktestVersion(models.Model):
    strategy = models.ForeignKey(
        ManualBacktestStrategy,
        on_delete=models.CASCADE,
        related_name='versions',
    )
    version = models.PositiveIntegerField()
    context_rules = models.TextField(blank=True)
    setup_rules = models.TextField(blank=True)
    entry_rules = models.TextField(blank=True)
    stop_rules = models.TextField(blank=True)
    exit_rules = models.TextField(blank=True)
    invalidation_rules = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    locked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-version']
        constraints = [
            models.UniqueConstraint(
                fields=['strategy', 'version'],
                name='uniq_backtest_strategy_version',
            ),
        ]
        indexes = [
            models.Index(fields=['strategy', '-version']),
        ]

    def __str__(self) -> str:
        return f'{self.strategy_id} v{self.version}'

    @property
    def is_locked(self) -> bool:
        return self.locked_at is not None


class ManualBacktestCampaign(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='manual_backtest_campaigns',
    )
    strategy_version = models.ForeignKey(
        ManualBacktestVersion,
        on_delete=models.PROTECT,
        related_name='campaigns',
    )
    name = models.CharField(max_length=200)
    instrument = models.CharField(max_length=32)
    period_start = models.DateField()
    period_end = models.DateField()
    session_start = models.TimeField(null=True, blank=True)
    session_end = models.TimeField(null=True, blank=True)
    timezone = models.CharField(max_length=64, default='America/New_York')
    observation_goal = models.PositiveIntegerField(null=True, blank=True)
    commission = models.DecimalField(
        max_digits=12, decimal_places=4, null=True, blank=True
    )
    slippage = models.DecimalField(
        max_digits=12, decimal_places=4, null=True, blank=True
    )
    require_refusal_reason = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    status = models.CharField(
        max_length=16,
        choices=CAMPAIGN_STATUS_CHOICES,
        default='DRAFT',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['user', 'status', '-updated_at']),
            models.Index(fields=['strategy_version']),
        ]

    def __str__(self) -> str:
        return f'{self.name} ({self.instrument})'


class ManualBacktestObservation(models.Model):
    campaign = models.ForeignKey(
        ManualBacktestCampaign,
        on_delete=models.CASCADE,
        related_name='observations',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='manual_backtest_observations',
    )
    market_datetime = models.DateTimeField()
    direction = models.CharField(max_length=8, choices=DIRECTION_CHOICES)
    setup_valid = models.BooleanField(default=True)
    trade_taken = models.BooleanField(default=True)
    refusal_reason = models.TextField(blank=True)
    entry_price = models.DecimalField(
        max_digits=20, decimal_places=8, null=True, blank=True
    )
    initial_stop_price = models.DecimalField(
        max_digits=20, decimal_places=8, null=True, blank=True
    )
    target_price = models.DecimalField(
        max_digits=20, decimal_places=8, null=True, blank=True
    )
    exit_price = models.DecimalField(
        max_digits=20, decimal_places=8, null=True, blank=True
    )
    quantity = models.DecimalField(
        max_digits=16, decimal_places=4, null=True, blank=True
    )
    fees = models.DecimalField(
        max_digits=12, decimal_places=4, null=True, blank=True
    )
    slippage = models.DecimalField(
        max_digits=12, decimal_places=4, null=True, blank=True
    )
    result_status = models.CharField(
        max_length=16,
        choices=RESULT_STATUS_CHOICES,
        default='OPEN',
    )
    result_r = models.DecimalField(
        max_digits=12, decimal_places=4, null=True, blank=True
    )
    result_r_source = models.CharField(
        max_length=16,
        choices=RESULT_R_SOURCE_CHOICES,
        default='calculated',
    )
    result_points = models.DecimalField(
        max_digits=20, decimal_places=8, null=True, blank=True
    )
    mfe = models.DecimalField(
        max_digits=20, decimal_places=8, null=True, blank=True
    )
    mae = models.DecimalField(
        max_digits=20, decimal_places=8, null=True, blank=True
    )
    context = models.CharField(max_length=128, blank=True)
    structure = models.CharField(max_length=128, blank=True)
    notes = models.TextField(blank=True)
    screenshot_before_url = models.CharField(max_length=2048, blank=True)
    screenshot_after_url = models.CharField(max_length=2048, blank=True)
    sort_index = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_index', 'market_datetime', 'id']
        indexes = [
            models.Index(fields=['campaign', 'market_datetime']),
            models.Index(fields=['campaign', 'trade_taken', 'result_status']),
            models.Index(fields=['user', '-market_datetime']),
        ]

    def __str__(self) -> str:
        return f'Obs {self.pk} campaign={self.campaign_id}'
