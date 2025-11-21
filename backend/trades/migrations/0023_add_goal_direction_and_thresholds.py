# Generated manually

from django.db import migrations, models
import django.db.models.deletion


def migrate_target_value_to_threshold_target(apps, schema_editor):
    """Migre target_value vers threshold_target pour les enregistrements existants."""
    TradingGoal = apps.get_model('trades', 'TradingGoal')
    for goal in TradingGoal.objects.all():
        if goal.target_value is not None and goal.threshold_target is None:
            goal.threshold_target = goal.target_value
            goal.direction = 'minimum'  # Par défaut, les anciens objectifs sont "minimum"
            goal.save()


class Migration(migrations.Migration):

    dependencies = [
        ('trades', '0022_daystrategycompliance'),
    ]

    operations = [
        # Ajouter direction avec valeur par défaut
        migrations.AddField(
            model_name='tradinggoal',
            name='direction',
            field=models.CharField(
                choices=[('minimum', 'Atteindre ou dépasser'), ('maximum', 'Ne pas dépasser')],
                default='minimum',
                help_text='Atteindre ou ne pas dépasser la valeur cible',
                max_length=10,
                verbose_name='Direction'
            ),
        ),
        # Ajouter threshold_target comme nullable d'abord
        migrations.AddField(
            model_name='tradinggoal',
            name='threshold_target',
            field=models.DecimalField(
                blank=True,
                decimal_places=9,
                help_text='Valeur cible à atteindre ou ne pas dépasser',
                max_digits=18,
                null=True,
                verbose_name='Seuil cible'
            ),
        ),
        # Ajouter threshold_warning comme nullable
        migrations.AddField(
            model_name='tradinggoal',
            name='threshold_warning',
            field=models.DecimalField(
                blank=True,
                decimal_places=9,
                help_text="Seuil d'alerte (optionnel) pour identifier les objectifs en danger",
                max_digits=18,
                null=True,
                verbose_name="Seuil d'alerte"
            ),
        ),
        # Rendre target_value nullable pour rétrocompatibilité
        migrations.AlterField(
            model_name='tradinggoal',
            name='target_value',
            field=models.DecimalField(
                blank=True,
                decimal_places=9,
                help_text='Valeur à atteindre (utiliser threshold_target à la place)',
                max_digits=18,
                null=True,
                verbose_name='Valeur cible (déprécié)'
            ),
        ),
        # Migrer les données
        migrations.RunPython(migrate_target_value_to_threshold_target, migrations.RunPython.noop),
        # Rendre threshold_target non-nullable après migration
        migrations.AlterField(
            model_name='tradinggoal',
            name='threshold_target',
            field=models.DecimalField(
                decimal_places=9,
                help_text='Valeur cible à atteindre ou ne pas dépasser',
                max_digits=18,
                verbose_name='Seuil cible'
            ),
        ),
    ]

