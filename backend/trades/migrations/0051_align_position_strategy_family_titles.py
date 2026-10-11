from django.db import migrations

from trades.strategy_family_title import align_family_titles


def align_existing_family_titles(apps, schema_editor):
    PositionStrategy = apps.get_model('trades', 'PositionStrategy')
    align_family_titles(PositionStrategy)


class Migration(migrations.Migration):

    dependencies = [
        ('trades', '0050_remove_market_phase_models'),
    ]

    operations = [
        migrations.RunPython(align_existing_family_titles, migrations.RunPython.noop),
    ]
