from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0023_userpreferences_theme_system'),
    ]

    operations = [
        migrations.AddField(
            model_name='userpreferences',
            name='topstep_api_paused',
            field=models.BooleanField(
                default=True,
                help_text='Si vrai, le journal n’appelle pas l’API TopStep (évite le conflit de session).',
                verbose_name='API TopStep en pause',
            ),
        ),
        migrations.AddField(
            model_name='userpreferences',
            name='market_quotes_enabled',
            field=models.BooleanField(
                default=False,
                help_text='Cours live activés explicitement par l’utilisateur (dashboard).',
                verbose_name='Bandeau cours marché activé',
            ),
        ),
    ]
