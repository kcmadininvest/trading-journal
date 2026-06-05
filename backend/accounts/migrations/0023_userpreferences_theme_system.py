from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0022_appsettings'),
    ]

    operations = [
        migrations.AlterField(
            model_name='userpreferences',
            name='theme',
            field=models.CharField(
                choices=[('light', 'Clair'), ('dark', 'Sombre'), ('system', 'Système')],
                default='light',
                max_length=10,
                verbose_name='Thème',
            ),
        ),
    ]
