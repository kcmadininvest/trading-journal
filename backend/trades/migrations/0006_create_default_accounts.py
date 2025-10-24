# Generated migration for creating default trading accounts

from django.db import migrations


def create_default_accounts(apps, schema_editor):
    """
    Crée un compte de trading par défaut pour chaque utilisateur existant
    et associe les trades existants à ce compte.
    """
    User = apps.get_model('accounts', 'User')
    TradingAccount = apps.get_model('trades', 'TradingAccount')
    TopStepTrade = apps.get_model('trades', 'TopStepTrade')
    
    for user in User.objects.all():
        # Créer un compte par défaut pour l'utilisateur
        default_account, created = TradingAccount.objects.get_or_create(
            user=user,
            name=f"Compte principal {user.username}",
            defaults={
                'account_type': 'topstep',
                'currency': 'USD',
                'status': 'active',
                'is_default': True,
                'description': 'Compte créé automatiquement lors de la migration'
            }
        )
        
        # Associer tous les trades existants de l'utilisateur à ce compte
        TopStepTrade.objects.filter(
            user=user,
            trading_account__isnull=True
        ).update(trading_account=default_account)


def reverse_create_default_accounts(apps, schema_editor):
    """
    Supprime les comptes par défaut créés (les trades restent avec trading_account=None)
    """
    TradingAccount = apps.get_model('trades', 'TradingAccount')
    TradingAccount.objects.filter(
        name__startswith="Compte principal"
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('trades', '0005_tradingaccount_and_more'),
        ('accounts', '0002_add_custom_user_fields'),
    ]

    operations = [
        migrations.RunPython(
            create_default_accounts,
            reverse_create_default_accounts
        ),
    ]
