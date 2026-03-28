# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('trades', '0025_exporttemplate'),
    ]

    operations = [
        migrations.AddField(
            model_name='tradingaccount',
            name='profit_target',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='Objectif de profit à atteindre (saisie manuelle)', max_digits=15, null=True, verbose_name='Objectif de profit'),
        ),
        migrations.AddField(
            model_name='tradingaccount',
            name='profit_target_enabled',
            field=models.BooleanField(default=False, help_text="Activer l'affichage de l'objectif de profit", verbose_name="Activer l'objectif de profit"),
        ),
    ]
