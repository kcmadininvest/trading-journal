from django.db import migrations, models


def copy_fk_links_to_m2m(apps, schema_editor):
    TradingActivityCredit = apps.get_model('trading_activity', 'TradingActivityCredit')
    for credit in TradingActivityCredit.objects.exclude(linked_account_transaction_id__isnull=True):
        credit.linked_account_transactions.add(credit.linked_account_transaction_id)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('trades', '0018_accounttransaction'),
        ('trading_activity', '0003_credit_fee_input_currency'),
    ]

    operations = [
        migrations.AddField(
            model_name='tradingactivitycredit',
            name='linked_account_transactions',
            field=models.ManyToManyField(
                blank=True,
                related_name='trading_activity_credits',
                to='trades.accounttransaction',
                verbose_name='Retraits liés',
            ),
        ),
        migrations.RunPython(copy_fk_links_to_m2m, noop_reverse),
        migrations.RemoveField(
            model_name='tradingactivitycredit',
            name='linked_account_transaction',
        ),
    ]
