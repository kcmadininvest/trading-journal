# Generated migration to remove caffeine_consumed and distractions_present fields

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('trades', '0036_remove_emotional_state'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='sessioncontext',
            name='caffeine_consumed',
        ),
        migrations.RemoveField(
            model_name='sessioncontext',
            name='distractions_present',
        ),
    ]
