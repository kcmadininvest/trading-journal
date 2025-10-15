"""
Configuration Django pour les tests.
Utilise PostgreSQL avec le schéma public pour les tests.
"""
from .settings import *

# Pour les tests, utiliser le schéma 'public' au lieu de 'trading_journal'
# Django créera automatiquement une base de test (test_portfolio)
DATABASES = {
    'default': {
        'ENGINE': config('DB_ENGINE', default='django.db.backends.postgresql'),
        'NAME': config('DB_NAME', default='portfolio'),
        'USER': config('DB_USER', default=''),
        'PASSWORD': config('DB_PASSWORD', default=''),
        'HOST': config('DB_HOST', default=''),
        'PORT': config('DB_PORT', default=''),
        'OPTIONS': {
            'options': '-c search_path=public'  # Utiliser le schéma public pour les tests
        },
        'TEST': {
            'NAME': 'test_trading_journal',  # Nom de la base de test
        }
    }
}

# Désactiver les caches pour les tests
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    }
}

# Accélérer les tests en utilisant un hasheur de mot de passe plus rapide
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]

