# 🚀 Guide de Déploiement en Production

## ⚠️ Important : Migrations

Le système d'authentification utilise un modèle User personnalisé avec des colonnes supplémentaires. Pour un déploiement propre en production, suivez ces étapes :

## 📋 Prérequis

1. **Base de données PostgreSQL** configurée
2. **Python 3.9+** installé
3. **Variables d'environnement** configurées

## 🔧 Déploiement

### Option 1 : Déploiement Automatique (Recommandé)

```bash
cd /var/www/html/trading_journal/backend
source venv/bin/activate
python deploy_production.py
```

### Option 2 : Déploiement Manuel

```bash
# 1. Activer l'environnement virtuel
cd /var/www/html/trading_journal/backend
source venv/bin/activate

# 2. Installer les dépendances
pip install -r requirements.txt

# 3. Nettoyer l'historique des migrations (si nécessaire)
python manage.py shell -c "
from django.db import connection
cursor = connection.cursor()
cursor.execute(\"DELETE FROM django_migrations WHERE app IN ('admin', 'auth', 'trades')\")
print('Migrations nettoyées')
"

# 4. Appliquer les migrations
python manage.py migrate --fake-initial

# 5. Vérifier que les colonnes existent
python manage.py shell -c "
from django.db import connection
cursor = connection.cursor()
cursor.execute('ALTER TABLE auth_user ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT \\'user\\'')
cursor.execute('ALTER TABLE auth_user ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE')
cursor.execute('ALTER TABLE auth_user ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()')
cursor.execute('ALTER TABLE auth_user ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()')
print('Colonnes ajoutées')
"

# 6. Créer un superutilisateur
python manage.py shell -c "
from accounts.models import User
if not User.objects.filter(is_superuser=True).exists():
    User.objects.create_superuser('admin@trading.com', 'admin', 'admin123', 'Admin', 'User')
    print('Superutilisateur créé')
"

# 7. Collecter les fichiers statiques
python manage.py collectstatic --noinput

# 8. Démarrer le serveur
python manage.py runserver 0.0.0.0:8000
```

## 🔍 Vérification

### Test de l'API d'authentification

```bash
# Test d'inscription
curl -X POST http://localhost:8000/api/accounts/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "first_name": "Test",
    "last_name": "User",
    "password": "test123456",
    "password_confirm": "test123456"
  }'

# Test de connexion
curl -X POST http://localhost:8000/api/accounts/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123456"
  }'
```

## 🐳 Déploiement avec Docker (Optionnel)

```dockerfile
# Dockerfile pour la production
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
RUN python deploy_production.py

EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
```

## 🔧 Configuration Production

### Variables d'environnement

```bash
# .env.production
DEBUG=False
SECRET_KEY=your-secret-key-here
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
```

### Settings de production

```python
# settings_production.py
import os
from .settings import *

DEBUG = False
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '').split(',')

# Sécurité
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Base de données
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME'),
        'USER': os.environ.get('DB_USER'),
        'PASSWORD': os.environ.get('DB_PASSWORD'),
        'HOST': os.environ.get('DB_HOST', 'localhost'),
        'PORT': os.environ.get('DB_PORT', '5432'),
    }
}
```

## 🚨 Dépannage

### Erreur : "column role does not exist"

```bash
# Ajouter manuellement les colonnes
python manage.py shell -c "
from django.db import connection
cursor = connection.cursor()
cursor.execute('ALTER TABLE auth_user ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT \\'user\\'')
cursor.execute('ALTER TABLE auth_user ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE')
cursor.execute('ALTER TABLE auth_user ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()')
cursor.execute('ALTER TABLE auth_user ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()')
"
```

### Erreur : "InconsistentMigrationHistory"

```bash
# Nettoyer l'historique
python manage.py shell -c "
from django.db import connection
cursor = connection.cursor()
cursor.execute(\"DELETE FROM django_migrations WHERE app IN ('admin', 'auth', 'trades')\")
"
python manage.py migrate --fake-initial
```

## ✅ Checklist de Déploiement

- [ ] Base de données PostgreSQL configurée
- [ ] Variables d'environnement définies
- [ ] Migrations appliquées correctement
- [ ] Colonnes User personnalisées présentes
- [ ] Superutilisateur créé
- [ ] Fichiers statiques collectés
- [ ] Tests d'authentification passés
- [ ] Frontend connecté au backend
- [ ] CORS configuré
- [ ] Sécurité en production activée

## 📞 Support

En cas de problème, vérifiez :
1. Les logs Django : `python manage.py runserver --verbosity=2`
2. Les logs de la base de données
3. La configuration CORS
4. Les variables d'environnement
