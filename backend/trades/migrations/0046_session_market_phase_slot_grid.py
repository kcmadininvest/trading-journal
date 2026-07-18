# Generated manually — grille de créneaux de session (account + date).

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('trades', '0045_dedupe_session_phase_blocks'),
    ]

    operations = [
        migrations.CreateModel(
            name='SessionMarketPhaseSlotGrid',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('session_date', models.DateField(db_index=True)),
                (
                    'slots',
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text='[{"key":"09:30-10:00","label":"…","start":"09:30","end":"10:00"}]',
                    ),
                ),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'trading_account',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='market_phase_slot_grids',
                        to='trades.tradingaccount',
                    ),
                ),
                (
                    'user',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='market_phase_slot_grids',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                'verbose_name': 'Grille créneaux session phases marché',
                'verbose_name_plural': 'Grilles créneaux session phases marché',
            },
        ),
        migrations.AddConstraint(
            model_name='sessionmarketphaseslotgrid',
            constraint=models.UniqueConstraint(
                fields=('user', 'trading_account', 'session_date'),
                name='uniq_market_phase_slot_grid_session',
            ),
        ),
        migrations.AddIndex(
            model_name='sessionmarketphaseslotgrid',
            index=models.Index(
                fields=['trading_account', 'session_date'],
                name='trades_sess_trading_6f8a1d_idx',
            ),
        ),
    ]
