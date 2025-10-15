#!/usr/bin/env python3
"""
Script de déploiement pour la production
Ce script gère correctement les migrations pour un déploiement propre
"""

import os
import sys
import django
from django.core.management import execute_from_command_line

def setup_django():
    """Configure Django pour le script"""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'trading_journal_api.settings')
    django.setup()

def clean_migration_history():
    """Nettoie l'historique des migrations problématiques"""
    from django.db import connection
    
    print("🧹 Nettoyage de l'historique des migrations...")
    
    with connection.cursor() as cursor:
        # Supprimer les migrations problématiques
        cursor.execute("""
            DELETE FROM django_migrations 
            WHERE app IN ('admin', 'auth', 'trades') 
            AND name IN (
                '0001_initial', '0002_logentry_remove_auto_add', 
                '0003_logentry_add_action_flag_choices',
                '0002_alter_permission_name_max_length',
                '0003_alter_user_email_max_length',
                '0004_alter_user_username_opts',
                '0005_alter_user_last_login_null',
                '0006_require_contenttypes_0002',
                '0007_alter_validators_add_error_messages',
                '0008_alter_user_username_max_length',
                '0009_alter_user_last_name_max_length',
                '0010_alter_group_name_max_length',
                '0011_update_proxy_permissions',
                '0012_alter_user_first_name_max_length'
            )
        """)
    
    print("✅ Historique des migrations nettoyé")

def apply_migrations():
    """Applique les migrations dans le bon ordre"""
    print("🔄 Application des migrations...")
    
    # Appliquer les migrations avec fake-initial pour les tables existantes
    execute_from_command_line(['manage.py', 'migrate', '--fake-initial'])
    
    print("✅ Migrations appliquées avec succès")

def verify_database():
    """Vérifie que la base de données est correctement configurée"""
    from django.db import connection
    from accounts.models import User
    
    print("🔍 Vérification de la base de données...")
    
    with connection.cursor() as cursor:
        # Vérifier que les colonnes existent
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'auth_user' 
            AND column_name IN ('role', 'is_verified', 'created_at', 'updated_at')
        """)
        
        columns = [row[0] for row in cursor.fetchall()]
        required_columns = ['role', 'is_verified', 'created_at', 'updated_at']
        
        missing_columns = set(required_columns) - set(columns)
        
        if missing_columns:
            print(f"❌ Colonnes manquantes: {missing_columns}")
            return False
        else:
            print("✅ Toutes les colonnes requises sont présentes")
            return True

def create_superuser():
    """Crée un superutilisateur si nécessaire"""
    from accounts.models import User
    
    print("👤 Vérification du superutilisateur...")
    
    if not User.objects.filter(is_superuser=True).exists():
        print("Création d'un superutilisateur...")
        User.objects.create_superuser(
            email='admin@trading.com',
            username='admin',
            password='admin123',
            first_name='Admin',
            last_name='User'
        )
        print("✅ Superutilisateur créé: admin@trading.com / admin123")
    else:
        print("✅ Superutilisateur existe déjà")

def main():
    """Fonction principale de déploiement"""
    print("🚀 Déploiement en production...")
    
    try:
        setup_django()
        clean_migration_history()
        apply_migrations()
        
        if verify_database():
            create_superuser()
            print("🎉 Déploiement réussi!")
        else:
            print("❌ Échec de la vérification de la base de données")
            sys.exit(1)
            
    except Exception as e:
        print(f"❌ Erreur lors du déploiement: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
