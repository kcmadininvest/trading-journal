from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0031_userpreferences_tutorials'),
    ]

    operations = [
        migrations.AddField(
            model_name='userpreferences',
            name='trading_activity_ledger_sort',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text=(
                    'Tri par onglet (debit/credit/tax) : {field, direction}. '
                    'Défaut implicite : date desc.'
                ),
                verbose_name='Tri ledger activité trading',
            ),
        ),
    ]
