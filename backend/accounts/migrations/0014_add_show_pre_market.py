# Generated migration for adding show_pre_market field to UserPreferences

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0013_userpreferences_items_per_page'),
    ]

    operations = [
        migrations.AddField(
            model_name='userpreferences',
            name='show_pre_market',
            field=models.BooleanField(
                default=False,
                help_text='Afficher l\'indicateur de pré-marché sur les horloges de marché',
                verbose_name='Afficher le pré-marché'
            ),
        ),
    ]
