from decimal import Decimal

import django.core.validators
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('trading_activity', '0004_credit_linked_transactions_m2m'),
    ]

    operations = [
        migrations.CreateModel(
            name='TradingActivityTaxPayment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField(verbose_name='Date')),
                (
                    'amount',
                    models.DecimalField(
                        decimal_places=2,
                        max_digits=15,
                        validators=[django.core.validators.MinValueValidator(Decimal('0.01'))],
                        verbose_name='Montant',
                    ),
                ),
                ('currency', models.CharField(default='USD', max_length=3, verbose_name='Devise')),
                (
                    'payment_type',
                    models.CharField(
                        choices=[
                            ('social_contributions', 'Social contributions'),
                            ('income_tax', 'Income tax'),
                            ('business_tax', 'Business tax'),
                            ('local_tax', 'Local tax'),
                            ('consumption_tax', 'Consumption tax'),
                            ('other', 'Other'),
                        ],
                        max_length=32,
                        verbose_name='Type de paiement',
                    ),
                ),
                ('label', models.CharField(blank=True, default='', max_length=255, verbose_name='Libellé')),
                ('reference', models.CharField(blank=True, default='', max_length=100, verbose_name='Référence')),
                ('notes', models.TextField(blank=True, default='', verbose_name='Notes')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Créé le')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Modifié le')),
                (
                    'user',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='trading_activity_tax_payments',
                        to=settings.AUTH_USER_MODEL,
                        verbose_name='Utilisateur',
                    ),
                ),
            ],
            options={
                'verbose_name': 'Paiement fiscal ou social (activité trading)',
                'verbose_name_plural': 'Paiements fiscaux et sociaux (activité trading)',
                'ordering': ['-date', '-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='tradingactivitytaxpayment',
            index=models.Index(fields=['user', '-date'], name='trading_act_user_id_8a1f2d_idx'),
        ),
        migrations.AddIndex(
            model_name='tradingactivitytaxpayment',
            index=models.Index(fields=['user', 'currency'], name='trading_act_user_id_4c9e1a_idx'),
        ),
        migrations.AddIndex(
            model_name='tradingactivitytaxpayment',
            index=models.Index(fields=['user', 'payment_type'], name='trading_act_user_id_2b7f8e_idx'),
        ),
    ]
