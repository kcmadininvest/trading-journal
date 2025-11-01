from django.db import migrations


def seed_more_currencies(apps, schema_editor):
  Currency = apps.get_model('trades', 'Currency')
  data = [
    ('TRY', 'Livre turque', '₺'),
    ('RUB', 'Rouble russe', '₽'),
    ('PLN', 'Zloty polonais', 'zł'),
    ('HUF', 'Forint hongrois', 'Ft'),
    ('CZK', 'Couronne tchèque', 'Kč'),
    ('KRW', 'Won sud-coréen', '₩'),
    ('THB', 'Baht thaïlandais', '฿'),
    ('AED', 'Dirham des É.A.U.', 'د.إ'),
    ('SAR', 'Riyal saoudien', '﷼'),
    ('ILS', 'Shekel israélien', '₪'),
    ('TWD', 'Nouveau dollar taïwanais', 'NT$'),
    ('MYR', 'Ringgit malaisien', 'RM'),
    ('IDR', 'Roupie indonésienne', 'Rp'),
    ('PHP', 'Peso philippin', '₱'),
  ]
  for code, name, symbol in data:
    Currency.objects.get_or_create(code=code, defaults={'name': name, 'symbol': symbol})


class Migration(migrations.Migration):
  dependencies = [
    ('trades', '0008_create_currencies'),
  ]

  operations = [
    migrations.RunPython(seed_more_currencies, reverse_code=migrations.RunPython.noop),
  ]


