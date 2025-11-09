# Generated migration to make trading_account required

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('trades', '0006_create_default_accounts'),
    ]

    operations = [
        migrations.AlterField(
            model_name='topsteptrade',
            name='trading_account',
            field=models.ForeignKey(
                help_text='Compte de trading associé à ce trade',
                on_delete=django.db.models.deletion.CASCADE,
                related_name='topstep_trades',
                to='trades.tradingaccount',
                verbose_name='Compte de trading'
            ),
        ),
    ]
