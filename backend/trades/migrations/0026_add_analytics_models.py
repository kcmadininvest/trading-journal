# Generated manually for analytics models

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.core.validators
from decimal import Decimal


class Migration(migrations.Migration):

    dependencies = [
        ('trades', '0025_exporttemplate'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # TradeContext
        migrations.CreateModel(
            name='TradeContext',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('trend_m15', models.CharField(blank=True, choices=[('bullish', 'Bullish'), ('bearish', 'Bearish'), ('ranging', 'Ranging'), ('unclear', 'Unclear')], max_length=10, null=True, verbose_name='Tendance M15')),
                ('trend_m5', models.CharField(blank=True, choices=[('bullish', 'Bullish'), ('bearish', 'Bearish'), ('ranging', 'Ranging'), ('unclear', 'Unclear')], max_length=10, null=True, verbose_name='Tendance M5')),
                ('trend_h1', models.CharField(blank=True, choices=[('bullish', 'Bullish'), ('bearish', 'Bearish'), ('ranging', 'Ranging'), ('unclear', 'Unclear')], max_length=10, null=True, verbose_name='Tendance H1')),
                ('trend_alignment', models.BooleanField(blank=True, null=True, verbose_name='Tendances alignées')),
                ('fibonacci_level', models.CharField(choices=[('23.6', '23.6%'), ('38.2', '38.2%'), ('50', '50%'), ('61.8', '61.8%'), ('78.6', '78.6%'), ('none', 'None')], default='none', max_length=10, verbose_name='Niveau Fibonacci')),
                ('at_support_resistance', models.BooleanField(default=False, verbose_name='Au support/résistance')),
                ('distance_from_key_level', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True, verbose_name='Distance du niveau clé (points)')),
                ('market_structure', models.CharField(blank=True, choices=[('higher_highs', 'Higher Highs'), ('lower_lows', 'Lower Lows'), ('consolidation', 'Consolidation')], max_length=20, null=True, verbose_name='Structure de marché')),
                ('break_of_structure', models.BooleanField(default=False, verbose_name='Break of structure')),
                ('within_previous_day_range', models.BooleanField(default=False, verbose_name='Dans le range de la veille')),
                ('range_position', models.CharField(blank=True, choices=[('top_third', 'Top Third'), ('middle_third', 'Middle Third'), ('bottom_third', 'Bottom Third')], max_length=15, null=True, verbose_name='Position dans le range')),
                ('atr_percentile', models.IntegerField(blank=True, null=True, validators=[django.core.validators.MinValueValidator(0), django.core.validators.MaxValueValidator(100)], verbose_name='ATR percentile')),
                ('volume_profile', models.CharField(blank=True, choices=[('high', 'High'), ('medium', 'Medium'), ('low', 'Low')], max_length=10, null=True, verbose_name='Profil de volume')),
                ('at_volume_node', models.BooleanField(default=False, verbose_name='Au nœud de volume')),
                ('rsi_value', models.IntegerField(blank=True, null=True, validators=[django.core.validators.MinValueValidator(0), django.core.validators.MaxValueValidator(100)], verbose_name='Valeur RSI')),
                ('macd_signal', models.CharField(blank=True, choices=[('bullish', 'Bullish'), ('bearish', 'Bearish'), ('neutral', 'Neutral')], max_length=10, null=True, verbose_name='Signal MACD')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Créé le')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Modifié le')),
                ('trade', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='context', to='trades.topsteptrade', verbose_name='Trade')),
            ],
            options={
                'verbose_name': 'Contexte de Trade',
                'verbose_name_plural': 'Contextes de Trades',
                'ordering': ['-created_at'],
            },
        ),
        
        # TradeSetup
        migrations.CreateModel(
            name='TradeSetup',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('setup_category', models.CharField(choices=[('pullback', 'Pullback'), ('breakout', 'Breakout'), ('reversal', 'Reversal'), ('continuation', 'Continuation'), ('range_bound', 'Range Bound'), ('news_driven', 'News Driven'), ('scalp', 'Scalp'), ('other', 'Other')], max_length=20, verbose_name='Catégorie de setup')),
                ('setup_subcategory', models.CharField(blank=True, max_length=100, verbose_name='Sous-catégorie')),
                ('chart_pattern', models.CharField(choices=[('double_top', 'Double Top'), ('double_bottom', 'Double Bottom'), ('head_shoulders', 'Head & Shoulders'), ('triangle', 'Triangle'), ('flag', 'Flag'), ('wedge', 'Wedge'), ('channel', 'Channel'), ('none', 'None')], default='none', max_length=20, verbose_name='Pattern chartiste')),
                ('confluence_factors', models.JSONField(default=list, verbose_name='Facteurs de confluence')),
                ('confluence_count', models.IntegerField(default=0, verbose_name='Nombre de confluences')),
                ('setup_quality', models.CharField(choices=[('A', 'A - Excellent'), ('B', 'B - Good'), ('C', 'C - Average'), ('D', 'D - Poor'), ('F', 'F - Very Poor')], max_length=1, verbose_name='Qualité du setup')),
                ('setup_confidence', models.IntegerField(blank=True, null=True, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(10)], verbose_name='Confiance (1-10)')),
                ('entry_timing', models.CharField(blank=True, choices=[('early', 'Early'), ('optimal', 'Optimal'), ('late', 'Late'), ('missed', 'Missed')], max_length=10, null=True, verbose_name="Timing d'entrée")),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Créé le')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Modifié le')),
                ('trade', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='setup', to='trades.topsteptrade', verbose_name='Trade')),
            ],
            options={
                'verbose_name': 'Setup de Trade',
                'verbose_name_plural': 'Setups de Trades',
                'ordering': ['-created_at'],
            },
        ),
        
        # SessionContext
        migrations.CreateModel(
            name='SessionContext',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('trading_session', models.CharField(choices=[('asian', 'Asian'), ('london', 'London'), ('new_york', 'New York'), ('overlap_london_ny', 'London/NY Overlap'), ('after_hours', 'After Hours')], max_length=20, verbose_name='Session de trading')),
                ('session_time_slot', models.CharField(blank=True, max_length=20, verbose_name='Créneau horaire')),
                ('news_event', models.BooleanField(default=False, verbose_name='Événement news')),
                ('news_impact', models.CharField(choices=[('high', 'High'), ('medium', 'Medium'), ('low', 'Low'), ('none', 'None')], default='none', max_length=10, verbose_name='Impact de la news')),
                ('news_description', models.CharField(blank=True, max_length=200, verbose_name='Description de la news')),
                ('day_of_week', models.CharField(choices=[('monday', 'Monday'), ('tuesday', 'Tuesday'), ('wednesday', 'Wednesday'), ('thursday', 'Thursday'), ('friday', 'Friday')], max_length=10, verbose_name='Jour de la semaine')),
                ('is_first_trade_of_day', models.BooleanField(default=False, verbose_name='Premier trade du jour')),
                ('is_last_trade_of_day', models.BooleanField(default=False, verbose_name='Dernier trade du jour')),
                ('physical_state', models.CharField(blank=True, choices=[('rested', 'Rested'), ('tired', 'Tired'), ('sick', 'Sick'), ('optimal', 'Optimal')], max_length=10, null=True, verbose_name='État physique')),
                ('mental_state', models.CharField(blank=True, choices=[('focused', 'Focused'), ('distracted', 'Distracted'), ('stressed', 'Stressed'), ('confident', 'Confident')], max_length=15, null=True, verbose_name='État mental')),
                ('emotional_state', models.CharField(blank=True, choices=[('calm', 'Calm'), ('anxious', 'Anxious'), ('excited', 'Excited'), ('frustrated', 'Frustrated')], max_length=15, null=True, verbose_name='État émotionnel')),
                ('hours_of_sleep', models.IntegerField(blank=True, null=True, validators=[django.core.validators.MinValueValidator(0), django.core.validators.MaxValueValidator(24)], verbose_name='Heures de sommeil')),
                ('caffeine_consumed', models.BooleanField(default=False, verbose_name='Caféine consommée')),
                ('distractions_present', models.BooleanField(default=False, verbose_name='Distractions présentes')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Créé le')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Modifié le')),
                ('trade', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='session_context', to='trades.topsteptrade', verbose_name='Trade')),
            ],
            options={
                'verbose_name': 'Contexte de Session',
                'verbose_name_plural': 'Contextes de Sessions',
                'ordering': ['-created_at'],
            },
        ),
        
        # TradeExecution
        migrations.CreateModel(
            name='TradeExecution',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('followed_trading_plan', models.BooleanField(blank=True, null=True, verbose_name='Plan de trading respecté')),
                ('entry_as_planned', models.BooleanField(default=True, verbose_name='Entrée comme prévu')),
                ('exit_as_planned', models.BooleanField(default=True, verbose_name='Sortie comme prévu')),
                ('position_size_as_planned', models.BooleanField(default=True, verbose_name='Taille de position comme prévu')),
                ('moved_stop_loss', models.BooleanField(default=False, verbose_name='Stop loss déplacé')),
                ('stop_loss_direction', models.CharField(choices=[('tighter', 'Tighter'), ('wider', 'Wider'), ('none', 'None')], default='none', max_length=10, verbose_name='Direction du stop loss')),
                ('partial_exit_taken', models.BooleanField(default=False, verbose_name='Sortie partielle effectuée')),
                ('partial_exit_percentage', models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True, validators=[django.core.validators.MinValueValidator(Decimal('0.01')), django.core.validators.MaxValueValidator(Decimal('100.00'))], verbose_name='Pourcentage de sortie partielle')),
                ('exit_reason', models.CharField(blank=True, choices=[('take_profit_hit', 'Take Profit Hit'), ('stop_loss_hit', 'Stop Loss Hit'), ('manual_exit', 'Manual Exit'), ('time_based', 'Time Based'), ('target_reached', 'Target Reached'), ('setup_invalidated', 'Setup Invalidated'), ('emotional', 'Emotional'), ('news_event', 'News Event')], max_length=20, null=True, verbose_name='Raison de sortie')),
                ('execution_errors', models.JSONField(default=list, verbose_name="Erreurs d'exécution")),
                ('slippage_points', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True, verbose_name='Slippage (points)')),
                ('would_take_again', models.BooleanField(blank=True, null=True, verbose_name='Reprendrait ce trade')),
                ('lesson_learned', models.TextField(blank=True, verbose_name='Leçon apprise')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Créé le')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Modifié le')),
                ('trade', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='execution', to='trades.topsteptrade', verbose_name='Trade')),
            ],
            options={
                'verbose_name': 'Exécution de Trade',
                'verbose_name_plural': 'Exécutions de Trades',
                'ordering': ['-created_at'],
            },
        ),
        
        # TradeProbabilityFactor
        migrations.CreateModel(
            name='TradeProbabilityFactor',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('factor_category', models.CharField(max_length=50, verbose_name='Catégorie')),
                ('factor_name', models.CharField(max_length=100, unique=True, verbose_name='Nom du facteur')),
                ('factor_type', models.CharField(choices=[('boolean', 'Boolean'), ('categorical', 'Categorical'), ('numerical', 'Numerical')], max_length=15, verbose_name='Type de facteur')),
                ('possible_values', models.JSONField(default=list, verbose_name='Valeurs possibles')),
                ('description', models.TextField(blank=True, verbose_name='Description')),
                ('is_active', models.BooleanField(default=True, verbose_name='Actif')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Créé le')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Modifié le')),
            ],
            options={
                'verbose_name': 'Facteur de Probabilité',
                'verbose_name_plural': 'Facteurs de Probabilité',
                'ordering': ['factor_category', 'factor_name'],
            },
        ),
        
        # TradeTag
        migrations.CreateModel(
            name='TradeTag',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=50, verbose_name='Nom du tag')),
                ('color', models.CharField(default='#3B82F6', max_length=7, verbose_name='Couleur')),
                ('category', models.CharField(choices=[('setup', 'Setup'), ('mistake', 'Mistake'), ('market_condition', 'Market Condition'), ('strategy', 'Strategy'), ('other', 'Other')], default='other', max_length=20, verbose_name='Catégorie')),
                ('description', models.TextField(blank=True, verbose_name='Description')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Créé le')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Modifié le')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='trade_tags', to=settings.AUTH_USER_MODEL, verbose_name='Utilisateur')),
            ],
            options={
                'verbose_name': 'Tag de Trade',
                'verbose_name_plural': 'Tags de Trades',
                'ordering': ['category', 'name'],
            },
        ),
        
        # TradeTagAssignment
        migrations.CreateModel(
            name='TradeTagAssignment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Créé le')),
                ('tag', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='trade_assignments', to='trades.tradetag', verbose_name='Tag')),
                ('trade', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tag_assignments', to='trades.topsteptrade', verbose_name='Trade')),
            ],
            options={
                'verbose_name': 'Attribution de Tag',
                'verbose_name_plural': 'Attributions de Tags',
                'ordering': ['-created_at'],
            },
        ),
        
        # TradeStatistics
        migrations.CreateModel(
            name='TradeStatistics',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('filter_criteria', models.JSONField(default=dict, verbose_name='Critères de filtrage')),
                ('total_trades', models.IntegerField(default=0, verbose_name='Total de trades')),
                ('winning_trades', models.IntegerField(default=0, verbose_name='Trades gagnants')),
                ('losing_trades', models.IntegerField(default=0, verbose_name='Trades perdants')),
                ('win_rate', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=5, verbose_name='Taux de réussite (%)')),
                ('average_win', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=15, verbose_name='Gain moyen')),
                ('average_loss', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=15, verbose_name='Perte moyenne')),
                ('profit_factor', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True, verbose_name='Profit factor')),
                ('expectancy', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=15, verbose_name='Expectancy')),
                ('largest_win', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=15, verbose_name='Plus gros gain')),
                ('largest_loss', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=15, verbose_name='Plus grosse perte')),
                ('average_duration', models.DurationField(blank=True, null=True, verbose_name='Durée moyenne')),
                ('calculated_at', models.DateTimeField(auto_now=True, verbose_name='Calculé le')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Créé le')),
                ('trading_account', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='statistics', to='trades.tradingaccount', verbose_name='Compte de trading')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='trade_statistics', to=settings.AUTH_USER_MODEL, verbose_name='Utilisateur')),
            ],
            options={
                'verbose_name': 'Statistique de Trade',
                'verbose_name_plural': 'Statistiques de Trades',
                'ordering': ['-calculated_at'],
            },
        ),
        
        # ConditionalProbability
        migrations.CreateModel(
            name='ConditionalProbability',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('condition_set', models.JSONField(verbose_name='Ensemble de conditions')),
                ('sample_size', models.IntegerField(verbose_name="Taille de l'échantillon")),
                ('win_rate', models.DecimalField(decimal_places=2, max_digits=5, verbose_name='Taux de réussite (%)')),
                ('average_rr', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True, verbose_name='R:R moyen')),
                ('expectancy', models.DecimalField(decimal_places=2, max_digits=15, verbose_name='Expectancy')),
                ('confidence_interval', models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True, verbose_name='Intervalle de confiance (%)')),
                ('is_statistically_significant', models.BooleanField(default=False, verbose_name='Statistiquement significatif')),
                ('calculated_at', models.DateTimeField(auto_now=True, verbose_name='Calculé le')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Créé le')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='conditional_probabilities', to=settings.AUTH_USER_MODEL, verbose_name='Utilisateur')),
            ],
            options={
                'verbose_name': 'Probabilité Conditionnelle',
                'verbose_name_plural': 'Probabilités Conditionnelles',
                'ordering': ['-calculated_at'],
            },
        ),
        
        # Indexes
        migrations.AddIndex(
            model_name='tradecontext',
            index=models.Index(fields=['trade'], name='trades_trad_trade_i_idx001'),
        ),
        migrations.AddIndex(
            model_name='tradecontext',
            index=models.Index(fields=['trend_m15', 'fibonacci_level'], name='trades_trad_trend_m_idx002'),
        ),
        migrations.AddIndex(
            model_name='tradecontext',
            index=models.Index(fields=['trend_alignment'], name='trades_trad_trend_a_idx003'),
        ),
        migrations.AddIndex(
            model_name='tradesetup',
            index=models.Index(fields=['trade'], name='trades_trad_trade_i_idx004'),
        ),
        migrations.AddIndex(
            model_name='tradesetup',
            index=models.Index(fields=['setup_category', 'setup_quality'], name='trades_trad_setup_c_idx005'),
        ),
        migrations.AddIndex(
            model_name='sessioncontext',
            index=models.Index(fields=['trade'], name='trades_sess_trade_i_idx006'),
        ),
        migrations.AddIndex(
            model_name='sessioncontext',
            index=models.Index(fields=['trading_session', 'day_of_week'], name='trades_sess_trading_idx007'),
        ),
        migrations.AddIndex(
            model_name='tradeexecution',
            index=models.Index(fields=['trade'], name='trades_trad_trade_i_idx008'),
        ),
        migrations.AddIndex(
            model_name='tradeexecution',
            index=models.Index(fields=['followed_trading_plan'], name='trades_trad_followe_idx009'),
        ),
        migrations.AddIndex(
            model_name='tradeexecution',
            index=models.Index(fields=['exit_reason'], name='trades_trad_exit_re_idx010'),
        ),
        migrations.AddIndex(
            model_name='tradeprobabilityfactor',
            index=models.Index(fields=['factor_category'], name='trades_trad_factor__idx011'),
        ),
        migrations.AddIndex(
            model_name='tradeprobabilityfactor',
            index=models.Index(fields=['is_active'], name='trades_trad_is_acti_idx012'),
        ),
        migrations.AddIndex(
            model_name='tradetagassignment',
            index=models.Index(fields=['trade'], name='trades_trad_trade_i_idx013'),
        ),
        migrations.AddIndex(
            model_name='tradetagassignment',
            index=models.Index(fields=['tag'], name='trades_trad_tag_id__idx014'),
        ),
        migrations.AddIndex(
            model_name='tradestatistics',
            index=models.Index(fields=['user', '-calculated_at'], name='trades_trad_user_id_idx015'),
        ),
        migrations.AddIndex(
            model_name='tradestatistics',
            index=models.Index(fields=['trading_account', '-calculated_at'], name='trades_trad_trading_idx016'),
        ),
        migrations.AddIndex(
            model_name='conditionalprobability',
            index=models.Index(fields=['user', '-calculated_at'], name='trades_cond_user_id_idx017'),
        ),
        migrations.AddIndex(
            model_name='conditionalprobability',
            index=models.Index(fields=['is_statistically_significant'], name='trades_cond_is_stat_idx018'),
        ),
        
        # Constraints
        migrations.AddConstraint(
            model_name='tradetag',
            constraint=models.UniqueConstraint(fields=['user', 'name'], name='unique_user_tag_name'),
        ),
        migrations.AddConstraint(
            model_name='tradetagassignment',
            constraint=models.UniqueConstraint(fields=['trade', 'tag'], name='unique_trade_tag'),
        ),
        migrations.AddIndex(
            model_name='tradetag',
            index=models.Index(fields=['user', 'category'], name='trades_trad_user_id_idx019'),
        ),
    ]
