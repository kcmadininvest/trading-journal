# Generated manually — remove duplicate session phase blocks left by old saves.

from collections import defaultdict

from django.db import migrations


def dedupe_session_phase_blocks(apps, schema_editor):
    Block = apps.get_model('trades', 'SessionMarketPhaseBlock')
    groups: dict[tuple, list] = defaultdict(list)
    for block in Block.objects.all().order_by('id'):
        key = (
            block.user_id,
            block.trading_account_id,
            block.session_date,
            block.instrument_key,
            block.range_start,
            block.range_end,
        )
        groups[key].append(block)

    for blocks in groups.values():
        if len(blocks) <= 1:
            continue
        # Conserve le bloc le plus récent (id max) ; CASCADE efface ses events frères.
        for block in blocks[:-1]:
            block.delete()


class Migration(migrations.Migration):

    dependencies = [
        ('trades', '0044_cleanup_orphan_phase_events_cascade'),
    ]

    operations = [
        migrations.RunPython(dedupe_session_phase_blocks, migrations.RunPython.noop),
    ]
