from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0016_userpreferences_font_family'),
    ]

    operations = [
        migrations.AlterField(
            model_name='userpreferences',
            name='font_family',
            field=models.CharField(
                choices=[
                    ('inter', 'Inter'),
                    ('lato', 'Lato'),
                    ('montserrat', 'Montserrat'),
                    ('noto_sans', 'Noto Sans'),
                    ('nunito', 'Nunito'),
                    ('open_sans', 'Open Sans'),
                    ('poppins', 'Poppins'),
                    ('raleway', 'Raleway'),
                    ('roboto', 'Roboto'),
                    ('source_sans_3', 'Source Sans 3'),
                    ('ubuntu', 'Ubuntu'),
                    ('work_sans', 'Work Sans'),
                ],
                default='inter',
                max_length=32,
                verbose_name='Famille de police',
            ),
        ),
    ]
