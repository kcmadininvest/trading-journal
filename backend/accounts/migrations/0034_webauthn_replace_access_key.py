from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0033_access_key_totp_security'),
    ]

    operations = [
        migrations.DeleteModel(name='AccessKey'),
        migrations.CreateModel(
            name='WebAuthnCredential',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('credential_id', models.CharField(db_index=True, max_length=1024, unique=True)),
                ('public_key', models.TextField()),
                ('sign_count', models.PositiveIntegerField(default=0)),
                ('transports', models.JSONField(blank=True, default=list)),
                ('label', models.CharField(blank=True, default='', max_length=128)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('last_used_at', models.DateTimeField(blank=True, null=True)),
                (
                    'user',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='webauthn_credentials',
                        to=settings.AUTH_USER_MODEL,
                        verbose_name='Utilisateur',
                    ),
                ),
            ],
            options={
                'verbose_name': 'Passkey WebAuthn',
                'verbose_name_plural': 'Passkeys WebAuthn',
                'db_table': 'accounts_webauthncredential',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AlterField(
            model_name='loginhistory',
            name='method',
            field=models.CharField(
                blank=True,
                choices=[
                    ('password', 'Mot de passe'),
                    ('passkey', 'Passkey'),
                    ('totp', 'Code 2FA'),
                    ('backup_code', 'Code de secours'),
                    ('', 'Inconnu'),
                ],
                default='',
                max_length=32,
                verbose_name='Moyen de connexion',
            ),
        ),
    ]
