from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

import daily_journal.models
import daily_journal.validators


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('trades', '0023_add_goal_direction_and_thresholds'),
    ]

    operations = [
        migrations.CreateModel(
            name='DailyJournalEntry',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField(verbose_name='Date')),
                ('content', models.TextField(blank=True, verbose_name='Contenu')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Créé le')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Modifié le')),
                ('trading_account', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='daily_journal_entries', to='trades.tradingaccount', verbose_name='Compte de trading')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='daily_journal_entries', to=settings.AUTH_USER_MODEL, verbose_name='Utilisateur')),
            ],
            options={
                'verbose_name': 'Entrée de journal quotidienne',
                'verbose_name_plural': 'Entrées de journal quotidiennes',
                'ordering': ['-date', '-updated_at'],
                'unique_together': {('user', 'trading_account', 'date')},
            },
        ),
        migrations.CreateModel(
            name='DailyJournalImage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('image', models.ImageField(upload_to=daily_journal.models.daily_journal_image_path, validators=[daily_journal.validators.validate_journal_image], verbose_name='Image')),
                ('caption', models.CharField(blank=True, max_length=255, verbose_name='Légende')),
                ('order', models.PositiveIntegerField(default=0, verbose_name='Ordre')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Créé le')),
                ('entry', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='images', to='daily_journal.dailyjournalentry', verbose_name='Entrée')),
            ],
            options={
                'verbose_name': 'Image du journal',
                'verbose_name_plural': 'Images du journal',
                'ordering': ['order', 'created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='dailyjournalentry',
            index=models.Index(fields=['user', 'date'], name='daily_journ_user_id_7b6ae0_idx'),
        ),
        migrations.AddIndex(
            model_name='dailyjournalentry',
            index=models.Index(fields=['trading_account', 'date'], name='daily_journ_trading_e410cf_idx'),
        ),
        migrations.AddIndex(
            model_name='dailyjournalimage',
            index=models.Index(fields=['entry', 'order'], name='daily_journ_entry_i_23cdb6_idx'),
        ),
    ]
