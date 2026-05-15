from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models

from .constants import COMMON_CURRENCY_CODES, DEFAULT_PRIMARY_CURRENCY


def validate_iso_currency(value: str) -> None:
    if not value or len(value) != 3 or not value.isalpha():
        raise ValidationError('Code devise invalide (ISO 4217, 3 lettres).')
    code = value.upper()
    if code not in COMMON_CURRENCY_CODES:
        raise ValidationError(
            f'Devise non supportée. Valeurs autorisées : {", ".join(sorted(COMMON_CURRENCY_CODES))}.'
        )


class TradingActivityExpenseCategory(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='trading_activity_expense_categories',
        verbose_name='Utilisateur',
    )
    name = models.CharField(max_length=100, verbose_name='Nom')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Créé le')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Modifié le')

    class Meta:
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(fields=['user', 'name'], name='unique_trading_activity_category_name_per_user'),
        ]
        verbose_name = 'Catégorie de dépense (activité trading)'
        verbose_name_plural = 'Catégories de dépense (activité trading)'

    def __str__(self) -> str:
        return f'{self.name} ({self.user_id})'


class TradingActivityExpense(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='trading_activity_expenses',
        verbose_name='Utilisateur',
    )
    date = models.DateField(verbose_name='Date')
    primary_currency = models.CharField(
        max_length=3,
        verbose_name='Devise principale',
        default=DEFAULT_PRIMARY_CURRENCY,
    )
    subtotal = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))],
        verbose_name='Sous-total',
    )
    vat_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))],
        verbose_name='TVA',
    )
    total = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        verbose_name='Total',
    )
    invoice_reference = models.CharField(
        max_length=100,
        blank=True,
        default='',
        verbose_name='Référence facture',
    )
    secondary_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0'))],
        verbose_name='Montant secondaire',
    )
    secondary_currency = models.CharField(
        max_length=3,
        blank=True,
        default='',
        verbose_name='Devise secondaire',
    )
    category = models.ForeignKey(
        TradingActivityExpenseCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='expenses',
        verbose_name='Catégorie',
    )
    label = models.CharField(max_length=255, blank=True, default='', verbose_name='Libellé')
    notes = models.TextField(blank=True, default='', verbose_name='Notes')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Créé le')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Modifié le')

    class Meta:
        ordering = ['-date', '-created_at']
        indexes = [
            models.Index(fields=['user', '-date']),
            models.Index(fields=['user', 'primary_currency']),
        ]
        verbose_name = 'Dépense activité trading'
        verbose_name_plural = 'Dépenses activité trading'

    def clean(self) -> None:
        validate_iso_currency(self.primary_currency)
        if self.secondary_amount is not None and self.secondary_amount > 0:
            if not self.secondary_currency:
                raise ValidationError({'secondary_currency': 'La devise secondaire est requise si un montant secondaire est renseigné.'})
            validate_iso_currency(self.secondary_currency)
        elif self.secondary_currency and not self.secondary_amount:
            raise ValidationError({'secondary_amount': 'Le montant secondaire est requis si une devise secondaire est renseignée.'})
        expected = (self.subtotal or Decimal('0')) + (self.vat_amount or Decimal('0'))
        if self.total and abs(self.total - expected) > Decimal('0.02'):
            raise ValidationError({'total': 'Le total doit correspondre à sous-total + TVA (tolérance 0,02).'})

    def save(self, *args, **kwargs):
        self.primary_currency = self.primary_currency.upper()
        if self.secondary_currency:
            self.secondary_currency = self.secondary_currency.upper()
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f'Dépense {self.date} {self.total} {self.primary_currency}'


class TradingActivityCredit(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='trading_activity_credits',
        verbose_name='Utilisateur',
    )
    date = models.DateField(verbose_name='Date')
    primary_currency = models.CharField(
        max_length=3,
        verbose_name='Devise principale',
        default=DEFAULT_PRIMARY_CURRENCY,
    )
    amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        verbose_name='Montant',
    )
    secondary_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0'))],
        verbose_name='Montant secondaire',
    )
    secondary_currency = models.CharField(
        max_length=3,
        blank=True,
        default='',
        verbose_name='Devise secondaire',
    )
    fx_rate = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        null=True,
        blank=True,
        verbose_name='Taux de change',
        help_text='1 unité de devise secondaire = fx_rate unités de devise principale.',
    )
    transfer_fee_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0'))],
        verbose_name='Frais de transfert',
        help_text='Montant des frais, exprimé dans la devise secondaire.',
    )
    transfer_fee_amount_input = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0'))],
        verbose_name='Frais de transfert (saisie)',
        help_text='Montant des frais tel que saisi (devise envoyée ou reçue).',
    )
    transfer_fee_currency = models.CharField(
        max_length=3,
        blank=True,
        default='',
        verbose_name='Devise des frais (saisie)',
        help_text='Code ISO de la devise des frais telle que saisie (devise principale ou secondaire).',
    )
    linked_account_transactions = models.ManyToManyField(
        'trades.AccountTransaction',
        related_name='trading_activity_credits',
        blank=True,
        verbose_name='Retraits liés',
    )
    notes = models.TextField(blank=True, default='', verbose_name='Notes')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Créé le')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Modifié le')

    class Meta:
        ordering = ['-date', '-created_at']
        indexes = [
            models.Index(fields=['user', '-date']),
            models.Index(fields=['user', 'primary_currency']),
        ]
        verbose_name = 'Crédit activité trading'
        verbose_name_plural = 'Crédits activité trading'

    def clean(self) -> None:
        validate_iso_currency(self.primary_currency)
        if self.secondary_amount is not None and self.secondary_amount > 0:
            if not self.secondary_currency:
                raise ValidationError({'secondary_currency': 'La devise secondaire est requise si un montant secondaire est renseigné.'})
            validate_iso_currency(self.secondary_currency)
        elif self.secondary_currency and not self.secondary_amount:
            raise ValidationError({'secondary_amount': 'Le montant secondaire est requis si une devise secondaire est renseignée.'})
        if self.fx_rate is not None:
            if self.fx_rate <= 0:
                raise ValidationError({'fx_rate': 'Le taux de change doit être strictement positif.'})
            if not self.secondary_currency or not self.secondary_amount or self.secondary_amount <= 0:
                raise ValidationError(
                    {'fx_rate': 'Le taux de change nécessite un montant et une devise secondaires renseignés.'}
                )
        fee = self.transfer_fee_amount
        if fee is not None and fee > 0:
            if not self.secondary_currency or not self.secondary_amount or self.secondary_amount <= 0:
                raise ValidationError(
                    {'transfer_fee_amount': 'Les frais de transfert nécessitent un montant et une devise secondaires.'}
                )

        fee_input = self.transfer_fee_amount_input
        if fee_input is not None and fee_input > 0:
            if not self.transfer_fee_currency:
                raise ValidationError({'transfer_fee_currency': 'La devise des frais est requise si un montant de frais est renseigné.'})
            validate_iso_currency(self.transfer_fee_currency)
            if self.transfer_fee_currency not in {self.primary_currency, self.secondary_currency}:
                raise ValidationError({'transfer_fee_currency': 'La devise des frais doit être la devise principale ou la devise secondaire.'})
            if not self.secondary_currency or not self.secondary_amount or self.secondary_amount <= 0:
                raise ValidationError({'transfer_fee_amount_input': 'Les frais nécessitent un montant et une devise secondaires.'})
            if self.transfer_fee_currency == self.primary_currency:
                if self.fx_rate is None or self.fx_rate <= 0:
                    raise ValidationError({'transfer_fee_amount_input': 'Un taux de change est requis si les frais sont saisis en devise principale.'})
    def save(self, *args, **kwargs):
        self.primary_currency = self.primary_currency.upper()
        if self.secondary_currency:
            self.secondary_currency = self.secondary_currency.upper()
        if self.transfer_fee_currency:
            self.transfer_fee_currency = self.transfer_fee_currency.upper()

        # Normaliser les frais en devise secondaire (champ historique) tout en gardant les champs saisis.
        if self.transfer_fee_amount_input is not None and self.transfer_fee_amount_input > 0 and self.transfer_fee_currency:
            if self.transfer_fee_currency == self.secondary_currency:
                self.transfer_fee_amount = self.transfer_fee_amount_input
            elif self.transfer_fee_currency == self.primary_currency and self.fx_rate:
                # fx_rate = primary / secondary => fee_secondary = fee_primary / fx_rate
                self.transfer_fee_amount = (self.transfer_fee_amount_input / self.fx_rate).quantize(Decimal('0.01'))
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f'Crédit {self.date} {self.amount} {self.primary_currency}'
