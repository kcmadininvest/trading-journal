from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('backtest_journal', '0003_strategy_position_fk'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='manualbacktestobservation',
            name='criterion_values',
        ),
        migrations.RemoveField(
            model_name='manualbacktestversion',
            name='criteria_schema',
        ),
    ]
