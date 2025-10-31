from django.db import migrations, models


def seed_currencies(apps, schema_editor):
  Currency = apps.get_model('trades', 'Currency')
  data = [
    ('USD', 'Dollar américain', '$'),
    ('EUR', 'Euro', '€'),
    ('GBP', 'Livre sterling', '£'),
    ('JPY', 'Yen japonais', '¥'),
    ('CHF', 'Franc suisse', 'CHF'),
    ('CAD', 'Dollar canadien', '$'),
    ('AUD', 'Dollar australien', '$'),
    ('NZD', 'Dollar néo-zélandais', '$'),
    ('CNY', 'Yuan renminbi', '¥'),
    ('HKD', 'Dollar de Hong Kong', '$'),
    ('SEK', 'Couronne suédoise', 'kr'),
    ('NOK', 'Couronne norvégienne', 'kr'),
    ('DKK', 'Couronne danoise', 'kr'),
    ('ZAR', 'Rand sud-africain', 'R'),
    ('MXN', 'Peso mexicain', '$'),
    ('BRL', 'Real brésilien', 'R$'),
    ('INR', 'Roupie indienne', '₹'),
    ('SGD', 'Dollar de Singapour', '$'),
  ]
  for code, name, symbol in data:
    Currency.objects.get_or_create(code=code, defaults={'name': name, 'symbol': symbol})


class Migration(migrations.Migration):
  dependencies = [
    ('trades', '0007_make_trading_account_required'),
  ]

  operations = [
    migrations.CreateModel(
      name='Currency',
      fields=[
        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
        ('code', models.CharField(max_length=3, unique=True, verbose_name='Code')),
        ('name', models.CharField(max_length=50, verbose_name='Nom')),
        ('symbol', models.CharField(max_length=5, verbose_name='Symbole')),
      ],
      options={
        'ordering': ['code'],
        'verbose_name': 'Devise',
        'verbose_name_plural': 'Devises',
      },
    ),
    migrations.AddIndex(
      model_name='currency',
      index=models.Index(fields=['code'], name='trades_curr_code_idx'),
    ),
    migrations.RunPython(seed_currencies, reverse_code=migrations.RunPython.noop),
  ]


