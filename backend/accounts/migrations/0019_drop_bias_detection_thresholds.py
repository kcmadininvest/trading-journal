from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0018_sync_bias_detection_thresholds'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=(
                        "ALTER TABLE accounts_userpreferences "
                        "DROP COLUMN IF EXISTS bias_detection_thresholds;"
                    ),
                    reverse_sql=(
                        "ALTER TABLE accounts_userpreferences "
                        "ADD COLUMN IF NOT EXISTS bias_detection_thresholds jsonb "
                        "DEFAULT '{}'::jsonb NOT NULL;"
                    ),
                ),
            ],
            state_operations=[
                migrations.RemoveField(
                    model_name='userpreferences',
                    name='bias_detection_thresholds',
                ),
            ],
        ),
    ]

