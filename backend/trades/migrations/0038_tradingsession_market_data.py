from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('trades', '0037_session_replay_models'),
    ]

    operations = [
        migrations.AddField(
            model_name='tradingsession',
            name='market_data',
            field=models.JSONField(
                blank=True,
                default=dict,
                verbose_name='Données marché (barres OHLC)',
            ),
        ),
    ]
