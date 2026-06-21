"""Agrégats journaliers précalculés par compte et famille de stratégie."""
from decimal import Decimal

from django.conf import settings
from django.db import models

# 0 = trades sans stratégie assignée (évite les collisions UNIQUE avec NULL sous PostgreSQL)
STRATEGY_ROOT_UNASSIGNED = 0


class TradeDailyRollup(models.Model):
    """
    Rollup journalier par (compte, jour, racine de stratégie).
    strategy_root_id = 0 pour les trades sans position_strategy.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='trade_daily_rollups',
        verbose_name='Utilisateur',
    )
    trading_account = models.ForeignKey(
        'TradingAccount',
        on_delete=models.CASCADE,
        related_name='daily_rollups',
        verbose_name='Compte de trading',
    )
    trade_day = models.DateField(verbose_name='Jour de trading')
    strategy_root_id = models.IntegerField(
        default=STRATEGY_ROOT_UNASSIGNED,
        verbose_name='Racine stratégie',
        help_text='ID racine de la famille (parent_strategy_id or id). 0 = sans stratégie.',
    )

    pnl_net = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0'))
    pnl_gross = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0'))
    trade_count = models.PositiveIntegerField(default=0)
    win_count = models.PositiveIntegerField(default=0)
    loss_count = models.PositiveIntegerField(default=0)
    sum_win_pnl = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0'))
    sum_loss_pnl = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0'))
    sum_duration_seconds = models.BigIntegerField(default=0)
    largest_win = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0'))
    largest_loss = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0'))

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Rollup journalier trade'
        verbose_name_plural = 'Rollups journaliers trades'
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'trading_account', 'trade_day', 'strategy_root_id'],
                name='trades_daily_rollup_unique',
            ),
        ]
        indexes = [
            models.Index(
                fields=['user', 'trading_account', 'trade_day', 'strategy_root_id'],
                name='trades_rollup_lookup_idx',
            ),
        ]

    def __str__(self):
        return f'Rollup {self.trade_day} acc={self.trading_account_id} strat={self.strategy_root_id}'
