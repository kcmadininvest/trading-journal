from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0017_alter_userpreferences_font_family_choices'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=(
                        "ALTER TABLE accounts_userpreferences "
                        "ADD COLUMN IF NOT EXISTS bias_detection_thresholds jsonb "
                        "DEFAULT '{}'::jsonb NOT NULL;"
                    ),
                    reverse_sql=(
                        "ALTER TABLE accounts_userpreferences "
                        "DROP COLUMN IF EXISTS bias_detection_thresholds;"
                    ),
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='userpreferences',
                    name='bias_detection_thresholds',
                    field=models.JSONField(
                        blank=True,
                        default=dict,
                        help_text='Configuration avancée des seuils de détection des biais comportementaux.',
                        verbose_name='Seuils de détection des biais',
                    ),
                ),
            ],
        ),
    ]

