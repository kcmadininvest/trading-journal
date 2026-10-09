from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0028_userpreferences_daily_journal_prefs'),
    ]

    operations = [
        migrations.AddField(
            model_name='userpreferences',
            name='journal_questions_positions_collapsed',
            field=models.BooleanField(
                default=False,
                help_text='Replier la section des réponses par position sur la page Questions du jour.',
                verbose_name='Questions des positions repliées',
            ),
        ),
    ]
