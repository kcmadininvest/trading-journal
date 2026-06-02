# Generated manually

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('trading_activity', '0005_tradingactivitytaxpayment'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='TradingActivityTaxPaymentType',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, verbose_name='Nom')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Créé le')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Modifié le')),
                (
                    'user',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='trading_activity_tax_payment_types',
                        to=settings.AUTH_USER_MODEL,
                        verbose_name='Utilisateur',
                    ),
                ),
            ],
            options={
                'verbose_name': 'Type de paiement fiscal (activité trading)',
                'verbose_name_plural': 'Types de paiement fiscal (activité trading)',
                'ordering': ['name'],
            },
        ),
        migrations.AddConstraint(
            model_name='tradingactivitytaxpaymenttype',
            constraint=models.UniqueConstraint(
                fields=('user', 'name'),
                name='unique_trading_activity_tax_payment_type_name_per_user',
            ),
        ),
        migrations.AlterField(
            model_name='tradingactivitytaxpayment',
            name='payment_type',
            field=models.CharField(max_length=48, verbose_name='Type de paiement'),
        ),
    ]
