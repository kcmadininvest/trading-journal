# Generated manually for per-user historical bar isolation

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def assign_or_purge_legacy_owner(apps, schema_editor):
    """
    Si un seul user a des jobs/sync historiques → lui assigner bars/coverages.
    Sinon purge (re-download requis).
    """
    HistoricalBar = apps.get_model('market_data', 'HistoricalBar')
    BarCoverage = apps.get_model('market_data', 'BarCoverage')
    HistoricalDownloadJob = apps.get_model('market_data', 'HistoricalDownloadJob')
    HistoricalSyncSettings = apps.get_model('market_data', 'HistoricalSyncSettings')

    owner_ids = set(
        HistoricalDownloadJob.objects.values_list('user_id', flat=True).distinct()
    )
    owner_ids.update(
        HistoricalSyncSettings.objects.values_list('user_id', flat=True).distinct()
    )
    owner_ids.discard(None)

    if len(owner_ids) == 1:
        owner_id = next(iter(owner_ids))
        HistoricalBar.objects.filter(user_id__isnull=True).update(user_id=owner_id)
        BarCoverage.objects.filter(user_id__isnull=True).update(user_id=owner_id)
        return

    # Plusieurs owners potentiels ou aucun : supprimer les orphelins
    HistoricalBar.objects.filter(user_id__isnull=True).delete()
    BarCoverage.objects.filter(user_id__isnull=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('market_data', '0005_download_job_requested_timeframes'),
    ]

    operations = [
        migrations.AddField(
            model_name='historicalbar',
            name='user',
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='historical_bars',
                to=settings.AUTH_USER_MODEL,
                verbose_name='Utilisateur',
            ),
        ),
        migrations.AddField(
            model_name='barcoverage',
            name='user',
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='bar_coverages',
                to=settings.AUTH_USER_MODEL,
                verbose_name='Utilisateur',
            ),
        ),
        migrations.RunPython(assign_or_purge_legacy_owner, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='historicalbar',
            name='user',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='historical_bars',
                to=settings.AUTH_USER_MODEL,
                verbose_name='Utilisateur',
            ),
        ),
        migrations.AlterField(
            model_name='barcoverage',
            name='user',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='bar_coverages',
                to=settings.AUTH_USER_MODEL,
                verbose_name='Utilisateur',
            ),
        ),
        migrations.RemoveConstraint(
            model_name='historicalbar',
            name='uniq_historical_bar_contract_tf_ts',
        ),
        migrations.RemoveIndex(
            model_name='historicalbar',
            name='md_bar_instr_tf_ts',
        ),
        migrations.RemoveIndex(
            model_name='historicalbar',
            name='md_bar_cid_tf_ts',
        ),
        migrations.RemoveIndex(
            model_name='historicalbar',
            name='md_bar_instr_tf_ny',
        ),
        migrations.RemoveIndex(
            model_name='historicalbar',
            name='md_bar_instr_tf_sess',
        ),
        migrations.RemoveIndex(
            model_name='barcoverage',
            name='md_cov_range',
        ),
        migrations.RemoveIndex(
            model_name='barcoverage',
            name='md_cov_status',
        ),
        migrations.AddConstraint(
            model_name='historicalbar',
            constraint=models.UniqueConstraint(
                fields=('user', 'contract_id', 'timeframe', 'timestamp_utc'),
                name='uniq_historical_bar_user_contract_tf_ts',
            ),
        ),
        migrations.AddConstraint(
            model_name='barcoverage',
            constraint=models.UniqueConstraint(
                fields=('user', 'contract_id', 'timeframe', 'start_utc', 'end_utc', 'source'),
                name='uniq_bar_coverage_user_range_source',
            ),
        ),
        migrations.AddIndex(
            model_name='historicalbar',
            index=models.Index(
                fields=['user', 'instrument', 'timeframe', 'timestamp_utc'],
                name='md_bar_user_instr_tf_ts',
            ),
        ),
        migrations.AddIndex(
            model_name='historicalbar',
            index=models.Index(
                fields=['user', 'contract_id', 'timeframe', 'timestamp_utc'],
                name='md_bar_user_cid_tf_ts',
            ),
        ),
        migrations.AddIndex(
            model_name='historicalbar',
            index=models.Index(
                fields=['user', 'instrument', 'timeframe', 'ny_date', 'ny_time'],
                name='md_bar_user_instr_tf_ny',
            ),
        ),
        migrations.AddIndex(
            model_name='historicalbar',
            index=models.Index(
                fields=['user', 'instrument', 'timeframe', 'session_date'],
                name='md_bar_user_instr_tf_sess',
            ),
        ),
        migrations.AddIndex(
            model_name='barcoverage',
            index=models.Index(
                fields=['user', 'instrument', 'contract_id', 'timeframe', 'start_utc', 'end_utc'],
                name='md_cov_user_range',
            ),
        ),
        migrations.AddIndex(
            model_name='barcoverage',
            index=models.Index(
                fields=['user', 'contract_id', 'timeframe', 'status'],
                name='md_cov_user_status',
            ),
        ),
    ]
