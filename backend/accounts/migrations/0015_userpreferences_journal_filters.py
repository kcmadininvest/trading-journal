from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0014_add_show_pre_market'),
    ]

    operations = [
        migrations.AddField(
            model_name='userpreferences',
            name='journal_period',
            field=models.JSONField(
                blank=True,
                default=None,
                help_text='Préréglage ou plage personnalisée (preset, start/end si custom)',
                null=True,
                verbose_name='Période du journal',
            ),
        ),
        migrations.AddField(
            model_name='userpreferences',
            name='journal_position_strategies',
            field=models.JSONField(
                blank=True,
                default=None,
                help_text='Carte compte_id ou "all" vers id de stratégie de position (null = toutes)',
                null=True,
                verbose_name='Stratégies de position par compte',
            ),
        ),
    ]
