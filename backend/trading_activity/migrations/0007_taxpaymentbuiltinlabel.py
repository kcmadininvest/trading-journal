from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('trading_activity', '0006_taxpaymenttype_custom'),
    ]

    operations = [
        migrations.CreateModel(
            name='TradingActivityTaxPaymentBuiltinLabel',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(max_length=32, verbose_name='Code système')),
                ('label', models.CharField(max_length=100, verbose_name='Libellé')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Créé le')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Modifié le')),
                (
                    'user',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='trading_activity_tax_payment_builtin_labels',
                        to=settings.AUTH_USER_MODEL,
                        verbose_name='Utilisateur',
                    ),
                ),
            ],
            options={
                'verbose_name': 'Libellé type paiement fiscal système',
                'verbose_name_plural': 'Libellés types paiement fiscal système',
            },
        ),
        migrations.AddConstraint(
            model_name='tradingactivitytaxpaymentbuiltinlabel',
            constraint=models.UniqueConstraint(
                fields=('user', 'code'),
                name='unique_trading_activity_tax_payment_builtin_label_per_user',
            ),
        ),
    ]
