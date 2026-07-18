# Generated manually — pointe QuestionnaireAnswer.trade vers ImportedTrade

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('trades', '0048_rename_topsteptrade_to_importedtrade'),
        ('daily_journal', '0003_questionnaires'),
    ]

    operations = [
        migrations.AlterField(
            model_name='questionnaireanswer',
            name='trade',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='questionnaire_answers',
                to='trades.importedtrade',
                verbose_name='Trade',
            ),
        ),
    ]
