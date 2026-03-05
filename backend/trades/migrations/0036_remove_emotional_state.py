# Generated migration to remove emotional_state field from SessionContext

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('trades', '0035_allow_null_plan_respect_fields'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='sessioncontext',
            name='emotional_state',
        ),
    ]
