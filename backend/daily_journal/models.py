from django.conf import settings
from django.db import models

from trades.models import TradingAccount
from .validators import validate_journal_image


def daily_journal_image_path(instance, filename: str) -> str:
    entry_date = instance.entry.date
    return f"daily_journal/{entry_date.strftime('%Y/%m')}/{filename}"


class DailyJournalEntry(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='daily_journal_entries',
        verbose_name='Utilisateur',
    )
    trading_account = models.ForeignKey(
        TradingAccount,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='daily_journal_entries',
        verbose_name='Compte de trading',
    )
    date = models.DateField(verbose_name='Date')
    content = models.TextField(blank=True, verbose_name='Contenu')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Créé le')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Modifié le')

    class Meta:
        ordering = ['-date', '-updated_at']
        unique_together = ('user', 'trading_account', 'date')
        indexes = [
            models.Index(fields=['user', 'date']),
            models.Index(fields=['trading_account', 'date']),
        ]
        verbose_name = 'Entrée de journal quotidienne'
        verbose_name_plural = 'Entrées de journal quotidiennes'

    def __str__(self) -> str:
        return f"Journal {self.user} - {self.date}"


class DailyJournalImage(models.Model):
    entry = models.ForeignKey(
        DailyJournalEntry,
        on_delete=models.CASCADE,
        related_name='images',
        verbose_name='Entrée',
    )
    image = models.ImageField(
        upload_to=daily_journal_image_path,
        validators=[validate_journal_image],
        verbose_name='Image',
    )
    caption = models.CharField(
        max_length=255,
        blank=True,
        verbose_name='Légende',
    )
    order = models.PositiveIntegerField(default=0, verbose_name='Ordre')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Créé le')

    class Meta:
        ordering = ['order', 'created_at']
        indexes = [
            models.Index(fields=['entry', 'order']),
        ]
        verbose_name = 'Image du journal'
        verbose_name_plural = 'Images du journal'

    def __str__(self) -> str:
        return f"Image {self.entry_id} ({self.order})"
