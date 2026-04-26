from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0015_userpreferences_journal_filters'),
    ]

    operations = [
        migrations.AddField(
            model_name='userpreferences',
            name='font_family',
            field=models.CharField(
                choices=[
                    ('inter', 'Inter'),
                    ('roboto', 'Roboto'),
                    ('open_sans', 'Open Sans'),
                    ('lato', 'Lato'),
                    ('source_sans_3', 'Source Sans 3'),
                ],
                default='inter',
                max_length=32,
                verbose_name='Famille de police',
            ),
        ),
    ]
