from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0027_userpreferences_market_replay_chart_prefs'),
    ]

    operations = [
        migrations.AddField(
            model_name='userpreferences',
            name='daily_journal_table_editor',
            field=models.BooleanField(
                default=True,
                help_text='Afficher le mini-éditeur visuel lors de l’édition d’un tableau dans le journal quotidien.',
                verbose_name='Journal — mini-éditeur de tableau',
            ),
        ),
        migrations.AddField(
            model_name='userpreferences',
            name='daily_journal_view_mode',
            field=models.CharField(
                choices=[('grid', 'Grille'), ('list', 'Liste')],
                default='grid',
                help_text='Vue grille ou liste des entrées du journal quotidien.',
                max_length=10,
                verbose_name='Journal — mode d’affichage',
            ),
        ),
    ]
