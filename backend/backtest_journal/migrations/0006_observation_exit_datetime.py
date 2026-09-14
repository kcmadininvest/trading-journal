from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('backtest_journal', '0005_remove_timeframe'),
    ]

    operations = [
        migrations.AddField(
            model_name='manualbacktestobservation',
            name='exit_datetime',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
