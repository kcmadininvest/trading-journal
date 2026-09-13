from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('backtest_journal', '0004_remove_custom_criteria'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='manualbacktestcampaign',
            name='timeframe',
        ),
        migrations.RemoveField(
            model_name='manualbackteststrategy',
            name='default_timeframe',
        ),
    ]
