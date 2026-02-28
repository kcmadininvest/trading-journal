# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('trades', '0026_add_analytics_models'),
    ]

    operations = [
        migrations.AddField(
            model_name='tradecontext',
            name='trend_m1',
            field=models.CharField(blank=True, choices=[('bullish', 'Bullish'), ('bearish', 'Bearish'), ('ranging', 'Ranging'), ('unclear', 'Unclear')], max_length=10, null=True, verbose_name='Tendance M1'),
        ),
        migrations.AddField(
            model_name='tradecontext',
            name='trend_m2',
            field=models.CharField(blank=True, choices=[('bullish', 'Bullish'), ('bearish', 'Bearish'), ('ranging', 'Ranging'), ('unclear', 'Unclear')], max_length=10, null=True, verbose_name='Tendance M2'),
        ),
        migrations.AddField(
            model_name='tradecontext',
            name='trend_m30',
            field=models.CharField(blank=True, choices=[('bullish', 'Bullish'), ('bearish', 'Bearish'), ('ranging', 'Ranging'), ('unclear', 'Unclear')], max_length=10, null=True, verbose_name='Tendance M30'),
        ),
        migrations.AddField(
            model_name='tradecontext',
            name='trend_h4',
            field=models.CharField(blank=True, choices=[('bullish', 'Bullish'), ('bearish', 'Bearish'), ('ranging', 'Ranging'), ('unclear', 'Unclear')], max_length=10, null=True, verbose_name='Tendance H4'),
        ),
        migrations.AddField(
            model_name='tradecontext',
            name='trend_daily',
            field=models.CharField(blank=True, choices=[('bullish', 'Bullish'), ('bearish', 'Bearish'), ('ranging', 'Ranging'), ('unclear', 'Unclear')], max_length=10, null=True, verbose_name='Tendance Daily'),
        ),
        migrations.AddField(
            model_name='tradecontext',
            name='trend_weekly',
            field=models.CharField(blank=True, choices=[('bullish', 'Bullish'), ('bearish', 'Bearish'), ('ranging', 'Ranging'), ('unclear', 'Unclear')], max_length=10, null=True, verbose_name='Tendance Weekly'),
        ),
    ]
