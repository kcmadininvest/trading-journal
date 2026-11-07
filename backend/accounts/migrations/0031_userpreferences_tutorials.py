from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0030_passwordresettoken'),
    ]

    operations = [
        migrations.AddField(
            model_name='userpreferences',
            name='tutorials_progress',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='Carte slug → {status, stepIndex, updatedAt}. Ne retire jamais l’accès au hub Aide.',
                verbose_name='Progression des tutoriels',
            ),
        ),
        migrations.AddField(
            model_name='userpreferences',
            name='tutorials_auto_prompt_dismissed',
            field=models.BooleanField(
                default=False,
                help_text=(
                    'Coupe uniquement le prompt / bannière automatiques au login ; '
                    'le menu Aide reste toujours accessible.'
                ),
                verbose_name='Rappel auto tutoriels désactivé',
            ),
        ),
    ]
