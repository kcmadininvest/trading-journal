#!/usr/bin/env python3
"""
Script Python pour supprimer tous les utilisateurs et leurs données de manière sécurisée
Utilise Django ORM pour garantir l'intégrité des données
"""

import os
import sys
import django
from django.conf import settings

# Ajouter le répertoire backend au path Python
backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend')
sys.path.insert(0, backend_dir)

# Changer le répertoire de travail vers backend pour résoudre les imports
os.chdir(backend_dir)

# Configuration Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'trading_journal_api.settings')
django.setup()

def clear_all_data():
    """
    Supprime tous les utilisateurs et leurs données associées
    """
    print("=== SUPPRESSION SÉCURISÉE DE TOUTES LES DONNÉES ===")
    print("ATTENTION: Cette opération supprime TOUTES les données de la base de données!")
    
    # Demander confirmation
    confirmation = input("Êtes-vous sûr de vouloir continuer? (tapez 'SUPPRIMER' pour confirmer): ")
    if confirmation != 'SUPPRIMER':
        print("Opération annulée.")
        return
    
    try:
        # Importer les modèles
        from django.contrib.auth import get_user_model
        from django.contrib.auth.models import Group
        from django.contrib.sessions.models import Session
        from django.contrib.admin.models import LogEntry
        
        User = get_user_model()
        
        # Modèles Trading Journal (si disponibles)
        try:
            from django.apps import apps
            TopStepTrade = apps.get_model('trades', 'TopStepTrade')
            TopStepImportLog = apps.get_model('trades', 'TopStepImportLog')
            TradeStrategy = apps.get_model('trades', 'TradeStrategy')
            BlacklistedToken = apps.get_model('token_blacklist', 'BlacklistedToken')
            OutstandingToken = apps.get_model('token_blacklist', 'OutstandingToken')
            trading_journal_available = True
        except ImportError:
            trading_journal_available = False
            print("Modèles Trading Journal non disponibles - suppression des données système uniquement")
        
        # Modèles Allauth (si disponibles)
        try:
            from allauth.account.models import EmailAddress, EmailConfirmation
            allauth_available = True
        except ImportError:
            allauth_available = False
        
        # Afficher les données actuelles
        print("\nDonnées actuelles:")
        print(f"  - Utilisateurs: {User.objects.count()}")
        print(f"  - Groupes: {Group.objects.count()}")
        print(f"  - Sessions: {Session.objects.count()}")
        print(f"  - Logs admin: {LogEntry.objects.count()}")
        
        if trading_journal_available:
            print(f"  - Trades TopStep: {TopStepTrade.objects.count()}")
            print(f"  - Logs d'import: {TopStepImportLog.objects.count()}")
            print(f"  - Stratégies: {TradeStrategy.objects.count()}")
            print(f"  - Tokens blacklistés: {BlacklistedToken.objects.count()}")
            print(f"  - Tokens en cours: {OutstandingToken.objects.count()}")
        
        if allauth_available:
            print(f"  - Adresses email: {EmailAddress.objects.count()}")
            print(f"  - Confirmations email: {EmailConfirmation.objects.count()}")
        
        print("\nSuppression en cours...")
        
        # Suppression dans l'ordre des dépendances
        
        # 1. Supprimer les tokens blacklistés (Trading Journal)
        if trading_journal_available:
            blacklisted_count = BlacklistedToken.objects.count()
            BlacklistedToken.objects.all().delete()
            print(f"1. Suppression des tokens blacklistés... ✓ {blacklisted_count} supprimés")
            
            # 2. Supprimer les tokens en cours
            outstanding_count = OutstandingToken.objects.count()
            OutstandingToken.objects.all().delete()
            print(f"2. Suppression des tokens en cours... ✓ {outstanding_count} supprimés")
            
            # 3. Supprimer les stratégies de trades
            strategy_count = TradeStrategy.objects.count()
            TradeStrategy.objects.all().delete()
            print(f"3. Suppression des stratégies... ✓ {strategy_count} supprimés")
            
            # 4. Supprimer les logs d'import
            import_log_count = TopStepImportLog.objects.count()
            TopStepImportLog.objects.all().delete()
            print(f"4. Suppression des logs d'import... ✓ {import_log_count} supprimés")
            
            # 5. Supprimer tous les trades
            trade_count = TopStepTrade.objects.count()
            TopStepTrade.objects.all().delete()
            print(f"5. Suppression des trades... ✓ {trade_count} supprimés")
        
        # 6. Supprimer les données Allauth
        if allauth_available:
            email_confirmation_count = EmailConfirmation.objects.count()
            EmailConfirmation.objects.all().delete()
            print(f"6. Suppression des confirmations email... ✓ {email_confirmation_count} supprimés")
            
            email_address_count = EmailAddress.objects.count()
            EmailAddress.objects.all().delete()
            print(f"7. Suppression des adresses email... ✓ {email_address_count} supprimés")
        
        # 7. Supprimer les sessions Django
        session_count = Session.objects.count()
        Session.objects.all().delete()
        print(f"8. Suppression des sessions Django... ✓ {session_count} supprimés")
        
        # 8. Supprimer les logs d'administration
        log_count = LogEntry.objects.count()
        LogEntry.objects.all().delete()
        print(f"9. Suppression des logs admin... ✓ {log_count} supprimés")
        
        # 9. Supprimer les groupes et permissions
        group_count = Group.objects.count()
        Group.objects.all().delete()
        print(f"10. Suppression des groupes... ✓ {group_count} supprimés")
        
        # 10. Supprimer les utilisateurs
        user_count = User.objects.count()
        User.objects.all().delete()
        print(f"11. Suppression des utilisateurs... ✓ {user_count} supprimés")
        
        print("\n=== SUPPRESSION TERMINÉE AVEC SUCCÈS ===")
        print("Toutes les données ont été supprimées de la base de données.")
        
        # Vérification finale
        print("\nVérification finale:")
        print(f"  - Utilisateurs restants: {User.objects.count()}")
        print(f"  - Groupes restants: {Group.objects.count()}")
        print(f"  - Sessions restantes: {Session.objects.count()}")
        print(f"  - Logs admin restants: {LogEntry.objects.count()}")
        
        if trading_journal_available:
            print(f"  - Trades restants: {TopStepTrade.objects.count()}")
            print(f"  - Logs d'import restants: {TopStepImportLog.objects.count()}")
            print(f"  - Stratégies restantes: {TradeStrategy.objects.count()}")
            print(f"  - Tokens blacklistés restants: {BlacklistedToken.objects.count()}")
            print(f"  - Tokens en cours restants: {OutstandingToken.objects.count()}")
        
        if allauth_available:
            print(f"  - Adresses email restantes: {EmailAddress.objects.count()}")
            print(f"  - Confirmations email restantes: {EmailConfirmation.objects.count()}")
        
    except Exception as e:
        print(f"\nERREUR lors de la suppression: {str(e)}")
        print("La suppression a été interrompue. Vérifiez les logs pour plus de détails.")
        return False
    
    return True

if __name__ == '__main__':
    success = clear_all_data()
    sys.exit(0 if success else 1)
