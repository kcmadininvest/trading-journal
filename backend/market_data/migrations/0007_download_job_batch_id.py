# batch_id : regroupe les jobs d'un même clic « Lancer » manuel

import uuid

from django.db import migrations, models


def backfill_manual_batch_ids(apps, schema_editor):
    """
    Regroupe les jobs manuels existants par user, instrument, période
    et seconde de création. Les jobs scheduled restent sans batch_id.
    """
    HistoricalDownloadJob = apps.get_model('market_data', 'HistoricalDownloadJob')
    qs = (
        HistoricalDownloadJob.objects.filter(trigger='manual', batch_id__isnull=True)
        .order_by('user_id', 'instrument', 'start_utc', 'end_utc', 'created_at', 'id')
    )
    groups: dict[tuple, list[int]] = {}
    for job in qs.iterator():
        created_second = job.created_at.replace(microsecond=0) if job.created_at else None
        key = (
            job.user_id,
            (job.instrument or '').upper().strip(),
            job.start_utc,
            job.end_utc,
            created_second,
        )
        groups.setdefault(key, []).append(job.pk)

    for job_ids in groups.values():
        batch = uuid.uuid4()
        HistoricalDownloadJob.objects.filter(pk__in=job_ids).update(batch_id=batch)


def clear_batch_ids(apps, schema_editor):
    HistoricalDownloadJob = apps.get_model('market_data', 'HistoricalDownloadJob')
    HistoricalDownloadJob.objects.filter(batch_id__isnull=False).update(batch_id=None)


class Migration(migrations.Migration):

    dependencies = [
        ('market_data', '0006_historicalbar_barcoverage_user'),
    ]

    operations = [
        migrations.AddField(
            model_name='historicaldownloadjob',
            name='batch_id',
            field=models.UUIDField(
                blank=True,
                db_index=True,
                help_text='Identifiant commun aux jobs d’un même clic « Lancer » manuel.',
                null=True,
            ),
        ),
        migrations.AddIndex(
            model_name='historicaldownloadjob',
            index=models.Index(
                fields=['user', 'trigger', 'batch_id', '-created_at'],
                name='md_job_user_trig_batch',
            ),
        ),
        migrations.RunPython(backfill_manual_batch_ids, clear_batch_ids),
    ]
