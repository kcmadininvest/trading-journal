from django.db import migrations, models


def enable_market_quotes_for_all_users(apps, schema_editor):
    UserPreferences = apps.get_model('accounts', 'UserPreferences')
    UserPreferences.objects.update(
        topstep_api_paused=False,
        market_quotes_enabled=True,
    )


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0025_alter_userpreferences_topstep_fields'),
    ]

    operations = [
        migrations.RunPython(
            enable_market_quotes_for_all_users,
            migrations.RunPython.noop,
        ),
        migrations.AlterField(
            model_name='userpreferences',
            name='topstep_api_paused',
            field=models.BooleanField(
                default=False,
                help_text='Champ historique — non utilisé par l’application.',
                verbose_name='API TopStep en pause',
            ),
        ),
        migrations.AlterField(
            model_name='userpreferences',
            name='market_quotes_enabled',
            field=models.BooleanField(
                default=True,
                help_text='Champ historique — non utilisé par l’application.',
                verbose_name='Bandeau cours marché activé',
            ),
        ),
    ]
