from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0026_enable_market_quotes_by_default'),
    ]

    operations = [
        migrations.AddField(
            model_name='userpreferences',
            name='market_replay_logarithmic',
            field=models.BooleanField(
                default=False,
                help_text='Utiliser l’échelle de prix logarithmique sur les graphiques Market Replay.',
                verbose_name='Market Replay — échelle logarithmique',
            ),
        ),
        migrations.AddField(
            model_name='userpreferences',
            name='market_replay_autofit',
            field=models.BooleanField(
                default=False,
                help_text='Recentrer automatiquement les bougies visibles pendant la lecture Market Replay.',
                verbose_name='Market Replay — autofit continu',
            ),
        ),
    ]
