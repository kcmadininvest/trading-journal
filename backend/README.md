# Trading Journal API - Backend

Backend Django REST Framework pour l'application de journal de trading.

## 🚀 Démarrage Rapide

### Installation

```bash
# Activer l'environnement virtuel
source venv/bin/activate

# Installer les dépendances
pip install -r requirements.txt

# Configurer les variables d'environnement
cp .env.example .env

# Appliquer les migrations
python manage.py migrate

# Créer un superutilisateur
python manage.py createsuperuser

# Lancer le serveur
python manage.py runserver
```

## 📁 Structure

```
backend/
├── trading_journal_api/  # Configuration du projet
│   ├── settings.py      # Paramètres Django
│   ├── urls.py          # URLs principales
│   └── wsgi.py          # Point d'entrée WSGI
├── accounts/            # Gestion des utilisateurs
├── trades/              # Gestion des trades
├── requirements.txt     # Dépendances Python
└── manage.py           # Script de gestion
```

## 🔌 Endpoints API

### Authentication
- `POST /api/token/` - Obtenir les tokens JWT
- `POST /api/token/refresh/` - Rafraîchir le token d'accès

### Accounts
- `GET /api/accounts/profile/` - Profil utilisateur
- `PUT /api/accounts/profile/` - Mettre à jour le profil

### Trades
- `GET /api/trades/` - Liste des trades
- `POST /api/trades/` - Créer un trade
- `GET /api/trades/{id}/` - Détails d'un trade
- `PUT /api/trades/{id}/` - Mettre à jour un trade
- `DELETE /api/trades/{id}/` - Supprimer un trade
- `GET /api/trades/statistics/` - Statistiques des trades

## 📚 Documentation

- Swagger UI : http://localhost:8000/api/docs/
- Admin Django : http://localhost:8000/admin/

## ⚙️ Configuration

Les paramètres peuvent être configurés via le fichier `.env` :

```env
SECRET_KEY=your-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database
DB_ENGINE=django.db.backends.postgresql
DB_NAME=trading_journal_db
DB_USER=postgres
DB_PASSWORD=password
DB_HOST=localhost
DB_PORT=5432

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000

# Redis
CELERY_BROKER_URL=redis://localhost:6379/0
REDIS_URL=redis://localhost:6379/1

# Login History (optionnel)
LOGIN_HISTORY_RETENTION_DAYS=90
LOGIN_HISTORY_MAX_ENTRIES_PER_USER=None
```

## 🧪 Tests

```bash
python manage.py test
```

## 🔧 Commandes de Gestion

### Nettoyage de l'Historique de Connexion

Pour nettoyer automatiquement l'historique de connexion :

```bash
# Mode dry-run (test sans suppression)
python manage.py cleanup_login_history --dry-run

# Exécution réelle
python manage.py cleanup_login_history

# Avec paramètres personnalisés
python manage.py cleanup_login_history --retention-days 30 --max-entries 50
```

Pour plus de détails, consultez le README principal du projet.

## 📦 Dépendances Principales

- Django 4.2
- Django REST Framework
- djangorestframework-simplejwt
- django-cors-headers
- drf-spectacular
- Celery
- Redis
- psycopg2-binary

## 🔐 Sécurité

- Authentification JWT
- CORS configuré
- Protection CSRF
- Validation des données
- Permissions par défaut (IsAuthenticated)


