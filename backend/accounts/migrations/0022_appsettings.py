from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0021_userpreferences_pnl_display'),
    ]

    operations = [
        migrations.CreateModel(
            name='AppSettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                (
                    'premium_restrictions_enabled',
                    models.BooleanField(
                        default=True,
                        help_text='Si désactivé, toutes les fonctionnalités premium sont accessibles à tous les utilisateurs authentifiés.',
                        verbose_name='Restrictions premium activées',
                    ),
                ),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Paramètres application',
                'verbose_name_plural': 'Paramètres application',
                'db_table': 'accounts_appsettings',
            },
        ),
    ]
