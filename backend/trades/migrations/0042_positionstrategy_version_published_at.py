from django.db import migrations, models


def backfill_version_published_at(apps, schema_editor):
    PositionStrategy = apps.get_model('trades', 'PositionStrategy')
    for strategy in PositionStrategy.objects.select_related('parent_strategy').iterator():
        if strategy.version_published_at:
            continue
        parent = strategy.parent_strategy
        if parent and strategy.version > 1 and strategy.created_at == parent.created_at:
            # created_at homogénéisé au parent : approximer via updated_at
            strategy.version_published_at = strategy.updated_at
        else:
            strategy.version_published_at = strategy.created_at
        strategy.save(update_fields=['version_published_at'])


class Migration(migrations.Migration):

    dependencies = [
        ('trades', '0041_trade_daily_rollup'),
    ]

    operations = [
        migrations.AddField(
            model_name='positionstrategy',
            name='version_published_at',
            field=models.DateTimeField(
                blank=True,
                help_text='Date de publication de cette version (distincte de la création de la stratégie parente)',
                null=True,
                verbose_name='Version publiée le',
            ),
        ),
        migrations.RunPython(backfill_version_published_at, migrations.RunPython.noop),
    ]
