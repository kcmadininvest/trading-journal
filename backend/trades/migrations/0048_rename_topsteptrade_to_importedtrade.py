# Generated manually — RenameModel/RenameField (préserve les données)

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('trades', '0047_rename_session_slot_grid_index'),
        # Force QuestionnaireAnswer (FK → TopStepTrade) avant RenameModel
        ('daily_journal', '0003_questionnaires'),
    ]

    operations = [
        migrations.RenameModel(
            old_name='TopStepTrade',
            new_name='ImportedTrade',
        ),
        migrations.RenameField(
            model_name='importedtrade',
            old_name='topstep_id',
            new_name='external_trade_id',
        ),
        migrations.AlterModelOptions(
            name='importedtrade',
            options={
                'ordering': ['-entered_at'],
                'verbose_name': 'Trade importé',
                'verbose_name_plural': 'Trades importés',
            },
        ),
        migrations.AlterUniqueTogether(
            name='importedtrade',
            unique_together={('user', 'trading_account', 'external_trade_id')},
        ),
        migrations.AlterField(
            model_name='importedtrade',
            name='external_trade_id',
            field=models.CharField(
                help_text='ID du trade dans l’export broker (unique par compte pour cet utilisateur)',
                max_length=50,
                verbose_name='ID trade broker',
            ),
        ),
        migrations.AlterField(
            model_name='importedtrade',
            name='user',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='imported_trades',
                to=settings.AUTH_USER_MODEL,
                verbose_name='Utilisateur',
            ),
        ),
        migrations.AlterField(
            model_name='importedtrade',
            name='trading_account',
            field=models.ForeignKey(
                help_text='Compte de trading associé à ce trade',
                on_delete=django.db.models.deletion.CASCADE,
                related_name='imported_trades',
                to='trades.tradingaccount',
                verbose_name='Compte de trading',
            ),
        ),
        migrations.AlterField(
            model_name='sessionevent',
            name='trade',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='session_events',
                to='trades.importedtrade',
                verbose_name='Trade lié',
            ),
        ),
        migrations.AlterField(
            model_name='tradestrategy',
            name='trade',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='strategy_data',
                to='trades.importedtrade',
                verbose_name='Trade associé',
            ),
        ),
        migrations.AlterField(
            model_name='tradetagassignment',
            name='trade',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='tag_assignments',
                to='trades.importedtrade',
                verbose_name='Trade',
            ),
        ),
    ]
