from django.db import migrations


def create_billing_settings(apps, schema_editor):
    BillingPlatformSettings = apps.get_model('billing', 'BillingPlatformSettings')
    BillingPlatformSettings.objects.get_or_create(pk=1, defaults={'trial_period_days': 15})


class Migration(migrations.Migration):
    dependencies = [
        ('billing', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(create_billing_settings, migrations.RunPython.noop),
    ]

