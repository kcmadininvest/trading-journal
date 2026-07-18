# Generated manually — fix orphan event accumulation on bulk capture.

from django.db import migrations, models
import django.db.models.deletion


def delete_orphan_market_phase_events(apps, schema_editor):
    SessionMarketPhaseEvent = apps.get_model('trades', 'SessionMarketPhaseEvent')
    SessionMarketPhaseEvent.objects.filter(parent_block__isnull=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('trades', '0043_market_phase_models'),
    ]

    operations = [
        migrations.RunPython(delete_orphan_market_phase_events, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='sessionmarketphaseevent',
            name='parent_block',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='events',
                to='trades.sessionmarketphaseblock',
            ),
        ),
    ]
