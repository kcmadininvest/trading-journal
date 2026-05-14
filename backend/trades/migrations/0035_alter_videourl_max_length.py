# Generated manually — URLs vidéo (YouTube, etc.) dépassent souvent 200 caractères.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('trades', '0034_topsteptrade_topstep_id_copy_imports'),
    ]

    operations = [
        migrations.AlterField(
            model_name='tradestrategy',
            name='video_url',
            field=models.URLField(
                blank=True,
                help_text='Lien vers une vidéo YouTube ou autre',
                max_length=2000,
                verbose_name='URL Vidéo',
            ),
        ),
        migrations.AlterField(
            model_name='daystrategycompliance',
            name='video_url',
            field=models.URLField(
                blank=True,
                help_text='Lien vers une vidéo YouTube ou autre',
                max_length=2000,
                verbose_name='URL Vidéo',
            ),
        ),
    ]
