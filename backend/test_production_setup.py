#!/usr/bin/env python3
"""
Script de test pour vérifier que le setup de production fonctionne
"""

import os
import sys
import django
from django.core.management import execute_from_command_line

def setup_django():
    """Configure Django pour le script"""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'trading_journal_api.settings')
    django.setup()

def test_database_structure():
    """Teste la structure de la base de données"""
    from django.db import connection
    
    print("🔍 Test de la structure de la base de données...")
    
    with connection.cursor() as cursor:
        # Vérifier que les colonnes existent
        cursor.execute("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'auth_user' 
            AND column_name IN ('role', 'is_verified', 'created_at', 'updated_at')
            ORDER BY column_name
        """)
        
        columns = cursor.fetchall()
        required_columns = ['role', 'is_verified', 'created_at', 'updated_at']
        
        print("Colonnes trouvées:")
        for col in columns:
            print(f"  ✅ {col[0]} ({col[1]}) - Nullable: {col[2]} - Default: {col[3]}")
        
        found_columns = [col[0] for col in columns]
        missing_columns = set(required_columns) - set(found_columns)
        
        if missing_columns:
            print(f"❌ Colonnes manquantes: {missing_columns}")
            return False
        else:
            print("✅ Toutes les colonnes requises sont présentes")
            return True

def test_user_model():
    """Teste le modèle User personnalisé"""
    from accounts.models import User
    
    print("👤 Test du modèle User...")
    
    try:
        # Test de création d'un utilisateur
        user = User.objects.create_user(
            email='test_prod@example.com',
            username='test_prod',
            password='test123456',
            first_name='Test',
            last_name='Production'
        )
        
        print(f"✅ Utilisateur créé: {user.email}")
        print(f"  - Rôle: {user.role}")
        print(f"  - Vérifié: {user.is_verified}")
        print(f"  - Admin: {user.is_admin}")
        print(f"  - Utilisateur régulier: {user.is_regular_user}")
        print(f"  - Créé le: {user.created_at}")
        print(f"  - Modifié le: {user.updated_at}")
        
        # Nettoyer
        user.delete()
        print("✅ Utilisateur supprimé")
        
        return True
        
    except Exception as e:
        print(f"❌ Erreur lors du test du modèle User: {e}")
        return False

def test_authentication_api():
    """Teste l'API d'authentification"""
    import requests
    import json
    
    print("🔐 Test de l'API d'authentification...")
    
    base_url = "http://localhost:8000/api/accounts/auth"
    
    try:
        # Test d'inscription
        register_data = {
            "email": "api_test@example.com",
            "username": "api_test",
            "first_name": "API",
            "last_name": "Test",
            "password": "test123456",
            "password_confirm": "test123456"
        }
        
        response = requests.post(f"{base_url}/register/", json=register_data)
        
        if response.status_code == 201:
            print("✅ Inscription réussie")
            data = response.json()
            access_token = data.get('access')
            
            # Test de connexion
            login_data = {
                "email": "api_test@example.com",
                "password": "test123456"
            }
            
            response = requests.post(f"{base_url}/login/", json=login_data)
            
            if response.status_code == 200:
                print("✅ Connexion réussie")
                data = response.json()
                user_data = data.get('user', {})
                print(f"  - Utilisateur: {user_data.get('email')}")
                print(f"  - Rôle: {user_data.get('role')}")
                print(f"  - Vérifié: {user_data.get('is_verified')}")
                
                return True
            else:
                print(f"❌ Échec de la connexion: {response.status_code}")
                return False
        else:
            print(f"❌ Échec de l'inscription: {response.status_code}")
            print(f"  Réponse: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Erreur lors du test de l'API: {e}")
        return False

def test_migrations():
    """Teste l'état des migrations"""
    print("📋 Test des migrations...")
    
    try:
        from django.db import connection
        
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT app, name, applied 
                FROM django_migrations 
                WHERE app IN ('accounts', 'auth', 'admin')
                ORDER BY app, name
            """)
            
            migrations = cursor.fetchall()
            
            print("Migrations appliquées:")
            for migration in migrations:
                status = "✅" if migration[2] else "❌"
                print(f"  {status} {migration[0]}.{migration[1]}")
            
            return True
            
    except Exception as e:
        print(f"❌ Erreur lors du test des migrations: {e}")
        return False

def main():
    """Fonction principale de test"""
    print("🧪 Test du setup de production...")
    print("=" * 50)
    
    try:
        setup_django()
        
        tests = [
            ("Structure de la base de données", test_database_structure),
            ("Modèle User", test_user_model),
            ("Migrations", test_migrations),
            ("API d'authentification", test_authentication_api),
        ]
        
        results = []
        
        for test_name, test_func in tests:
            print(f"\n🔍 {test_name}...")
            result = test_func()
            results.append((test_name, result))
            print("-" * 30)
        
        print("\n📊 Résultats des tests:")
        print("=" * 50)
        
        all_passed = True
        for test_name, result in results:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{status} {test_name}")
            if not result:
                all_passed = False
        
        print("=" * 50)
        
        if all_passed:
            print("🎉 Tous les tests sont passés! Le système est prêt pour la production.")
        else:
            print("⚠️  Certains tests ont échoué. Vérifiez la configuration.")
            sys.exit(1)
            
    except Exception as e:
        print(f"❌ Erreur lors des tests: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
