from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('trades', '0039_trading_account_balance_cache_fields'),
    ]

    operations = [
        migrations.AlterField(
            model_name='tradingaccount',
            name='initial_capital',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                default=None,
                help_text='Capital de départ du compte (utilisé pour le calcul du drawdown)',
                max_digits=15,
                null=True,
                verbose_name='Capital initial',
            ),
        ),
    ]
