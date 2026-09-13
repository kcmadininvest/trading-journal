"""Modèles de stockage des bougies historiques brutes (par contrat réel)."""
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class FuturesContract(models.Model):
    """Métadonnées d'un contrat futures ProjectX / TopStepX."""

    contract_id = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        verbose_name=_('Contract ID'),
        help_text=_('Identifiant ProjectX (ex. CON.F.US.ENQ.H25).'),
    )
    instrument = models.CharField(
        max_length=16,
        db_index=True,
        verbose_name=_('Instrument'),
        help_text=_('Symbole racine (NQ, ES, MGC, …).'),
    )
    symbol = models.CharField(
        max_length=32,
        blank=True,
        default='',
        verbose_name=_('Symbole court'),
        help_text=_('Nom court API (ex. NQH5).'),
    )
    symbol_id = models.CharField(
        max_length=32,
        blank=True,
        default='',
        verbose_name=_('Symbol ID'),
        help_text=_('ex. F.US.ENQ'),
    )
    broker_symbol = models.CharField(
        max_length=16,
        blank=True,
        default='',
        verbose_name=_('Broker symbol'),
        help_text=_('Segment CON.F.US.XXX (ex. ENQ).'),
    )
    expiry_month = models.PositiveSmallIntegerField(null=True, blank=True)
    expiry_year = models.PositiveSmallIntegerField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    listed_from = models.DateField(null=True, blank=True)
    listed_to = models.DateField(null=True, blank=True)
    source = models.CharField(max_length=32, blank=True, default='topstepx')
    raw = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'market_data_futures_contract'
        verbose_name = _('Contrat futures')
        verbose_name_plural = _('Contrats futures')
        indexes = [
            models.Index(fields=['instrument', 'expiry_date']),
            models.Index(fields=['symbol_id']),
        ]

    def __str__(self) -> str:
        return self.contract_id


class HistoricalBar(models.Model):
    """
    Bougie OHLCV brute d'un contrat réel.

    Aucun indicateur calculé, aucun ajustement de prix, aucune logique de stratégie.
    """

    instrument = models.CharField(max_length=16, db_index=True)
    symbol = models.CharField(max_length=32, blank=True, default='')
    contract_id = models.CharField(max_length=64, db_index=True)
    timeframe = models.CharField(max_length=8, default='1m', db_index=True)

    timestamp_utc = models.DateTimeField(db_index=True)

    open = models.DecimalField(max_digits=18, decimal_places=8)
    high = models.DecimalField(max_digits=18, decimal_places=8)
    low = models.DecimalField(max_digits=18, decimal_places=8)
    close = models.DecimalField(max_digits=18, decimal_places=8)
    volume = models.BigIntegerField(default=0)

    # Métadonnées de séance objectives (calendrier, pas stratégie)
    ny_date = models.DateField(db_index=True)
    ny_time = models.TimeField()
    session_date = models.DateField(null=True, blank=True, db_index=True)
    is_rth = models.BooleanField(default=False)
    is_eth = models.BooleanField(default=False)
    is_us_session = models.BooleanField(default=False)

    source = models.CharField(max_length=32, blank=True, default='topstepx')
    fetched_at = models.DateTimeField()
    extra_raw = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'market_data_historical_bar'
        verbose_name = _('Bougie historique')
        verbose_name_plural = _('Bougies historiques')
        constraints = [
            models.UniqueConstraint(
                fields=['contract_id', 'timeframe', 'timestamp_utc'],
                name='uniq_historical_bar_contract_tf_ts',
            ),
        ]
        indexes = [
            models.Index(
                fields=['instrument', 'timeframe', 'timestamp_utc'],
                name='md_bar_instr_tf_ts',
            ),
            models.Index(
                fields=['contract_id', 'timeframe', 'timestamp_utc'],
                name='md_bar_cid_tf_ts',
            ),
            models.Index(
                fields=['instrument', 'timeframe', 'ny_date', 'ny_time'],
                name='md_bar_instr_tf_ny',
            ),
            models.Index(
                fields=['instrument', 'timeframe', 'session_date'],
                name='md_bar_instr_tf_sess',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.contract_id} {self.timeframe} {self.timestamp_utc}'


class BarCoverage(models.Model):
    """Plage temporelle téléchargée pour un contrat — couverture honnête."""

    class Status(models.TextChoices):
        COMPLETE = 'complete', _('Complete')
        PARTIAL = 'partial', _('Partial')
        EMPTY = 'empty', _('Empty')

    instrument = models.CharField(max_length=16, db_index=True)
    contract_id = models.CharField(max_length=64, db_index=True)
    timeframe = models.CharField(max_length=8, default='1m')
    start_utc = models.DateTimeField()
    end_utc = models.DateTimeField()
    bars_stored = models.PositiveIntegerField(default=0)
    bars_expected = models.PositiveIntegerField(default=0)
    expected_gap_count = models.PositiveIntegerField(default=0)
    unexpected_missing_count = models.PositiveIntegerField(default=0)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PARTIAL,
        db_index=True,
    )
    source = models.CharField(max_length=32, blank=True, default='topstepx')
    fetched_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'market_data_bar_coverage'
        verbose_name = _('Couverture de bougies')
        verbose_name_plural = _('Couvertures de bougies')
        indexes = [
            models.Index(
                fields=['instrument', 'contract_id', 'timeframe', 'start_utc', 'end_utc'],
                name='md_cov_range',
            ),
            models.Index(
                fields=['contract_id', 'timeframe', 'status'],
                name='md_cov_status',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.contract_id} {self.start_utc}→{self.end_utc} [{self.status}]'


class HistoricalDownloadJob(models.Model):
    """Job de téléchargement historique (progression UI)."""

    class Status(models.TextChoices):
        PENDING = 'pending', _('Pending')
        RUNNING = 'running', _('Running')
        COMPLETED = 'completed', _('Completed')
        FAILED = 'failed', _('Failed')
        CANCELLED = 'cancelled', _('Cancelled')

    class Trigger(models.TextChoices):
        MANUAL = 'manual', _('Manual')
        SCHEDULED = 'scheduled', _('Scheduled')

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='historical_download_jobs',
    )
    instrument = models.CharField(max_length=16, db_index=True)
    contract_id = models.CharField(
        max_length=64,
        blank=True,
        default='',
        help_text=_('Vide = tous les contrats de la période.'),
    )
    timeframe = models.CharField(max_length=8, default='1m')
    trigger = models.CharField(
        max_length=16,
        choices=Trigger.choices,
        default=Trigger.MANUAL,
        db_index=True,
    )
    start_utc = models.DateTimeField()
    end_utc = models.DateTimeField()
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    progress_pct = models.PositiveSmallIntegerField(default=0)
    bars_fetched = models.PositiveIntegerField(default=0)
    chunks_done = models.PositiveIntegerField(default=0)
    last_chunk_end = models.DateTimeField(null=True, blank=True)
    error = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'market_data_download_job'
        verbose_name = _('Job de téléchargement')
        verbose_name_plural = _('Jobs de téléchargement')
        indexes = [
            models.Index(fields=['user', 'status', '-created_at']),
            models.Index(fields=['instrument', 'status']),
        ]

    def __str__(self) -> str:
        return f'Job#{self.pk} {self.instrument} [{self.status}]'


class HistoricalSyncSettings(models.Model):
    """Profil de synchronisation quotidienne par utilisateur."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='historical_sync_settings',
    )
    enabled = models.BooleanField(default=False)
    hour = models.PositiveSmallIntegerField(
        default=2,
        help_text=_('Heure locale (0–23) dans le fuseau des préférences utilisateur.'),
    )
    minute = models.PositiveSmallIntegerField(default=0)
    last_run_local_date = models.DateField(null=True, blank=True)
    last_run_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'market_data_sync_settings'
        verbose_name = _('Réglages sync historique')
        verbose_name_plural = _('Réglages sync historique')

    def __str__(self) -> str:
        state = 'on' if self.enabled else 'off'
        return f'SyncSettings user={self.user_id} [{state}] {self.hour:02d}:{self.minute:02d}'


class HistoricalSyncTarget(models.Model):
    """Cible instrument/timeframe (et contrat optionnel) du profil de sync."""

    settings = models.ForeignKey(
        HistoricalSyncSettings,
        on_delete=models.CASCADE,
        related_name='targets',
    )
    instrument = models.CharField(max_length=16, db_index=True)
    timeframe = models.CharField(max_length=8, default='1m')
    contract_id = models.CharField(
        max_length=64,
        blank=True,
        default='',
        help_text=_('Vide = tous les contrats de la période.'),
    )
    ordering = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = 'market_data_sync_target'
        verbose_name = _('Cible sync historique')
        verbose_name_plural = _('Cibles sync historique')
        ordering = ['ordering', 'id']
        constraints = [
            models.UniqueConstraint(
                fields=['settings', 'instrument', 'timeframe', 'contract_id'],
                name='uniq_md_sync_target',
            ),
        ]

    def __str__(self) -> str:
        cid = self.contract_id or '*'
        return f'{self.instrument} {self.timeframe} {cid}'


class BarQualityIssue(models.Model):
    """Anomalie de qualité détectée — jamais silencieuse."""

    class IssueType(models.TextChoices):
        DUPLICATE = 'duplicate', _('Duplicate')
        MISSING_TIMESTAMP = 'missing_timestamp', _('Missing timestamp')
        NON_MONOTONIC = 'non_monotonic', _('Non-monotonic')
        OHLC_INCONSISTENT = 'ohlc_inconsistent', _('OHLC inconsistent')
        INVALID_VOLUME = 'invalid_volume', _('Invalid volume')
        GAP = 'gap', _('Unexpected gap')
        EXPECTED_GAP = 'expected_gap', _('Expected gap')
        UNKNOWN_SESSION_PROFILE = 'unknown_session_profile', _('Unknown session profile')

    class Severity(models.TextChoices):
        INFO = 'info', _('Info')
        WARNING = 'warning', _('Warning')
        ERROR = 'error', _('Error')

    job = models.ForeignKey(
        HistoricalDownloadJob,
        on_delete=models.CASCADE,
        related_name='quality_issues',
        null=True,
        blank=True,
    )
    issue_type = models.CharField(max_length=32, choices=IssueType.choices, db_index=True)
    severity = models.CharField(
        max_length=16,
        choices=Severity.choices,
        default=Severity.WARNING,
    )
    instrument = models.CharField(max_length=16, blank=True, default='')
    contract_id = models.CharField(max_length=64, blank=True, default='', db_index=True)
    timeframe = models.CharField(max_length=8, blank=True, default='1m')
    timestamp_utc = models.DateTimeField(null=True, blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'market_data_bar_quality_issue'
        verbose_name = _('Issue qualité')
        verbose_name_plural = _('Issues qualité')
        indexes = [
            models.Index(fields=['job', 'issue_type']),
            models.Index(fields=['contract_id', 'issue_type']),
        ]

    def __str__(self) -> str:
        return f'{self.issue_type} {self.contract_id} {self.timestamp_utc}'
