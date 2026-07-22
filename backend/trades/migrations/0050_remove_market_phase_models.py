# Remove market phases feature models and tables.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('trades', '0049_rename_importedtrade_indexes'),
    ]

    operations = [
        migrations.DeleteModel(name='SessionMarketPhaseEvent'),
        migrations.DeleteModel(name='SessionMarketPhaseBlock'),
        migrations.DeleteModel(name='SessionMarketPhaseSlotGrid'),
        migrations.DeleteModel(name='MarketPhaseSlotConfig'),
        migrations.DeleteModel(name='MarketPhaseEventDefinition'),
        migrations.DeleteModel(name='MarketPhaseDefinition'),
    ]
