from django.db import migrations, models
import django.core.validators
from decimal import Decimal


class Migration(migrations.Migration):

    dependencies = [
        ('trading_activity', '0002_credit_fx_rate_and_transfer_fee'),
    ]

    operations = [
        migrations.AddField(
            model_name='tradingactivitycredit',
            name='transfer_fee_amount_input',
            field=models.DecimalField(
                blank=True,
                null=True,
                max_digits=15,
                decimal_places=2,
                validators=[django.core.validators.MinValueValidator(Decimal('0'))],
                verbose_name='Frais de transfert (saisie)',
                help_text='Montant des frais tel que saisi (devise envoyée ou reçue).',
            ),
        ),
        migrations.AddField(
            model_name='tradingactivitycredit',
            name='transfer_fee_currency',
            field=models.CharField(
                blank=True,
                default='',
                max_length=3,
                verbose_name='Devise des frais (saisie)',
                help_text='Code ISO de la devise des frais telle que saisie (devise principale ou secondaire).',
            ),
        ),
    ]

