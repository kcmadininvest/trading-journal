from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0032_userpreferences_trading_activity_ledger_sort'),
    ]

    operations = [
        migrations.AddField(
            model_name='loginhistory',
            name='method',
            field=models.CharField(
                blank=True,
                choices=[
                    ('password', 'Mot de passe'),
                    ('access_key', "Clé d'accès"),
                    ('totp', 'Code 2FA'),
                    ('backup_code', 'Code de secours'),
                    ('', 'Inconnu'),
                ],
                default='',
                max_length=32,
                verbose_name='Moyen de connexion',
            ),
        ),
        migrations.CreateModel(
            name='AccessKey',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('lookup_id', models.CharField(db_index=True, max_length=16, unique=True)),
                ('secret_hash', models.CharField(max_length=255)),
                ('prefix', models.CharField(max_length=32)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                (
                    'user',
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='access_key',
                        to=settings.AUTH_USER_MODEL,
                        verbose_name='Utilisateur',
                    ),
                ),
            ],
            options={
                'verbose_name': "Clé d'accès",
                'verbose_name_plural': "Clés d'accès",
                'db_table': 'accounts_accesskey',
            },
        ),
        migrations.CreateModel(
            name='TotpDevice',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('secret_encrypted', models.TextField()),
                ('enabled', models.BooleanField(default=False)),
                ('confirmed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'user',
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='totp_device',
                        to=settings.AUTH_USER_MODEL,
                        verbose_name='Utilisateur',
                    ),
                ),
            ],
            options={
                'verbose_name': 'Appareil TOTP',
                'verbose_name_plural': 'Appareils TOTP',
                'db_table': 'accounts_totpdevice',
            },
        ),
        migrations.CreateModel(
            name='BackupCode',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code_hash', models.CharField(max_length=64)),
                ('used_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                (
                    'user',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='backup_codes',
                        to=settings.AUTH_USER_MODEL,
                        verbose_name='Utilisateur',
                    ),
                ),
            ],
            options={
                'verbose_name': 'Code de secours',
                'verbose_name_plural': 'Codes de secours',
                'db_table': 'accounts_backupcode',
            },
        ),
        migrations.CreateModel(
            name='TwoFactorRecoveryRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('token', models.UUIDField(default=uuid.uuid4, unique=True)),
                ('cancel_token', models.UUIDField(default=uuid.uuid4, unique=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('usable_from', models.DateTimeField()),
                ('expires_at', models.DateTimeField()),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('cancelled_at', models.DateTimeField(blank=True, null=True)),
                (
                    'user',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='two_factor_recovery_requests',
                        to=settings.AUTH_USER_MODEL,
                        verbose_name='Utilisateur',
                    ),
                ),
            ],
            options={
                'verbose_name': 'Récupération 2FA',
                'verbose_name_plural': 'Récupérations 2FA',
                'db_table': 'accounts_twofactorrecoveryrequest',
            },
        ),
        migrations.AddIndex(
            model_name='backupcode',
            index=models.Index(fields=['user', 'used_at'], name='acc_backup_user_used_idx'),
        ),
        migrations.AddIndex(
            model_name='twofactorrecoveryrequest',
            index=models.Index(fields=['token'], name='acc_2fa_rec_token_idx'),
        ),
        migrations.AddIndex(
            model_name='twofactorrecoveryrequest',
            index=models.Index(fields=['cancel_token'], name='acc_2fa_rec_cancel_idx'),
        ),
        migrations.AddIndex(
            model_name='twofactorrecoveryrequest',
            index=models.Index(fields=['user', '-created_at'], name='acc_2fa_rec_user_idx'),
        ),
    ]
