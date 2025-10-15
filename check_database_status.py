#!/usr/bin/env python3
"""
Script pour vérifier l'état de la base de données
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

def check_database_status():
    """
    Vérifie l'état actuel de la base de données
    """
    print("=== ÉTAT ACTUEL DE LA BASE DE DONNÉES ===")
    
    try:
        # Importer les modèles
        from django.contrib.auth import get_user_model
        from django.contrib.auth.models import Group
        from django.contrib.sessions.models import Session
        from django.contrib.admin.models import LogEntry
        
        User = get_user_model()
        
        # Modèles Trading Journal
        try:
            from django.apps import apps
            TopStepTrade = apps.get_model('trades', 'TopStepTrade')
            TopStepImportLog = apps.get_model('trades', 'TopStepImportLog')
            TradeStrategy = apps.get_model('trades', 'TradeStrategy')
            BlacklistedToken = apps.get_model('token_blacklist', 'BlacklistedToken')
            OutstandingToken = apps.get_model('token_blacklist', 'OutstandingToken')
            trading_journal_available = True
        except Exception as e:
            trading_journal_available = False
            print(f"Modèles Trading Journal non disponibles: {e}")
        
        # Modèles Allauth
        try:
            from allauth.account.models import EmailAddress, EmailConfirmation
            allauth_available = True
        except ImportError:
            allauth_available = False
        
        print(f"Base de données: {settings.DATABASES['default']['NAME']}")
        print(f"Engine: {settings.DATABASES['default']['ENGINE']}")
        print()
        
        # Vérifier les données actuelles
        print("Données actuelles:")
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
        
        # Vérifier les utilisateurs par rôle
        if User.objects.count() > 0:
            print()
            print("Utilisateurs par rôle:")
            for role, _ in User.ROLE_CHOICES:
                count = User.objects.filter(role=role).count()
                print(f"  - {role}: {count}")
            
            print()
            print("Utilisateurs superuser:")
            superuser_count = User.objects.filter(is_superuser=True).count()
            print(f"  - Superusers: {superuser_count}")
        else:
            print()
            print("⚠️  AUCUN UTILISATEUR DANS LA BASE DE DONNÉES")
            print("   La base de données est vide.")
            print("   Vous devez créer un utilisateur pour utiliser l'application.")
        
        print()
        print("=== VÉRIFICATION TERMINÉE ===")
        
    except Exception as e:
        print(f"ERREUR lors de la vérification: {str(e)}")
        return False
    
    return True

if __name__ == '__main__':
    success = check_database_status()
    sys.exit(0 if success else 1)
