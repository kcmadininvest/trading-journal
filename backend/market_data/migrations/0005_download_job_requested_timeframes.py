from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('market_data', '0004_sync_run_status_partial'),
    ]

    operations = [
        migrations.AddField(
            model_name='historicaldownloadjob',
            name='requested_timeframes',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
