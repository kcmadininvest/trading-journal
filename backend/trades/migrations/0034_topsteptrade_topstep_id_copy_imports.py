# Generated manually for copy-trading import support

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('trades', '0033_alter_tradinggoal_goal_type'),
    ]

    operations = [
        migrations.AlterField(
            model_name='topsteptrade',
            name='topstep_id',
            field=models.CharField(
                help_text='ID du trade dans l’export broker (unique par compte pour cet utilisateur)',
                max_length=50,
                verbose_name='ID TopStep',
            ),
        ),
        migrations.AddField(
            model_name='tradingaccount',
            name='copy_imports_from',
            field=models.ForeignKey(
                blank=True,
                help_text='Si défini, les imports CSV sur ce compte source seront aussi dupliqués sur ce compte.',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='accounts_that_copy_me',
                to='trades.tradingaccount',
                verbose_name='Copier les imports depuis',
            ),
        ),
        migrations.AddIndex(
            model_name='tradingaccount',
            index=models.Index(fields=['copy_imports_from'], name='trades_trad_copy_im_7f3a1b_idx'),
        ),
    ]
