# Trading Journal - Application de Journal de Trading

Une application web complète pour suivre et analyser vos trades avec un backend Django REST Framework et un frontend React + TypeScript.

## 🚀 Caractéristiques

### Fonctionnalités Principales

- **Backend Django REST Framework** : API RESTful robuste et sécurisée
- **Frontend React + TypeScript** : Interface utilisateur moderne et réactive
- **Authentification JWT** : Système d'authentification sécurisé avec historique de connexion
- **Gestion des trades** : Enregistrez, suivez et analysez vos trades
  - Import CSV pour l'enregistrement en masse
  - Export CSV des trades filtrés
  - Filtres avancés (compte, date, instrument, etc.)
- **Multi-comptes** : Gestion de plusieurs comptes de trading (TopStep, IBKR, NinjaTrader, etc.)
- **Visualisations** : Graphiques et statistiques de performance avancées
  - Graphique de drawdown
  - Évolution du solde du compte
  - Heatmaps de performance
  - Analyses par jour de la semaine et par heure
- **Statistiques détaillées** : Métriques avancées (profit factor, win rate, drawdown, etc.)
- **Préférences utilisateur** : Personnalisation (format de date, format de nombre, langue, fuseau horaire, thème, taille de police)
- **Documentation API** : Documentation Swagger/OpenAPI intégrée

## 📁 Structure du Projet

```
trading_journal/
├── docs/                    # Documentation du projet
│   ├── README.md           # Documentation principale
│   └── guides/             # Guides utilisateurs
├── backend/                 # Application Django REST Framework
│   ├── trading_journal_api/ # Configuration du projet Django
│   ├── accounts/            # App pour la gestion des utilisateurs
│   │   └── management/
│   │       └── commands/    # Commandes de gestion Django
│   │           └── cleanup_login_history.py  # Nettoyage de l'historique
│   ├── trades/              # App pour la gestion des trades
│   ├── requirements.txt     # Dépendances Python
│   └── manage.py           # Script de gestion Django
│
└── frontend/               # Application React
    ├── src/
    │   ├── components/     # Composants réutilisables
    │   ├── pages/          # Pages de l'application
    │   ├── services/       # Services API
    │   ├── hooks/          # Hooks React personnalisés
    │   ├── contexts/       # Contextes React
    │   ├── types/          # Types TypeScript
    │   └── utils/          # Utilitaires
    └── package.json        # Dépendances Node.js
```

## 🛠️ Installation et Configuration

### Prérequis

- Python 3.9+
- Node.js 16+
- PostgreSQL (optionnel, SQLite par défaut)
- Redis (optionnel, pour Celery et cache)

### Backend

1. **Naviguer vers le dossier backend**
   ```bash
   cd backend
   ```

2. **Activer l'environnement virtuel**
   ```bash
   source venv/bin/activate
   ```

3. **Configurer les variables d'environnement**
   ```bash
   cp .env.example .env
   # Éditer .env avec vos paramètres
   ```

4. **Configurer les variables d'environnement** (fichier `.env`)
   ```env
   SECRET_KEY=your-secret-key-here
   DEBUG=True
   ALLOWED_HOSTS=localhost,127.0.0.1
   
   # Base de données (optionnel, SQLite par défaut)
   DB_ENGINE=django.db.backends.postgresql
   DB_NAME=trading_journal_db
   DB_USER=postgres
   DB_PASSWORD=password
   DB_HOST=localhost
   DB_PORT=5432
   
   # Historique de connexion (optionnel)
   LOGIN_HISTORY_RETENTION_DAYS=90
   LOGIN_HISTORY_MAX_ENTRIES_PER_USER=None
   
   # CORS
   CORS_ALLOWED_ORIGINS=http://localhost:3000
   ```

5. **Appliquer les migrations**
   ```bash
   python manage.py migrate
   ```

6. **Créer un superutilisateur**
   ```bash
   python manage.py createsuperuser
   ```

7. **Lancer le serveur de développement**
   ```bash
   python manage.py runserver
   ```

   Le backend sera accessible sur : http://localhost:8000
   - Admin : http://localhost:8000/admin
   - API Docs : http://localhost:8000/api/docs

### Frontend

1. **Naviguer vers le dossier frontend**
   ```bash
   cd frontend
   ```

2. **Configurer les variables d'environnement**
   ```bash
   cp .env.example .env
   ```

3. **Lancer le serveur de développement**
   ```bash
   npm start
   ```

   Le frontend sera accessible sur : http://localhost:3000

## 🔧 Technologies Utilisées

### Backend
- **Django 4.2** : Framework web Python
- **Django REST Framework** : Framework pour créer des APIs REST
- **djangorestframework-simplejwt** : Authentification JWT
- **django-cors-headers** : Gestion CORS
- **drf-spectacular** : Documentation OpenAPI/Swagger
- **Celery** : Tâches asynchrones
- **Redis** : Cache et broker pour Celery
- **PostgreSQL / SQLite** : Base de données

### Frontend
- **React 18** : Bibliothèque UI
- **TypeScript** : Typage statique
- **React Router** : Routing
- **Axios** : Client HTTP
- **TanStack Query** : Gestion d'état serveur
- **Tailwind CSS** : Framework CSS
- **Recharts** : Visualisation de données
- **React Hot Toast** : Notifications

## 📚 Documentation API

Une fois le backend lancé, la documentation complète de l'API est disponible sur :
- Swagger UI : http://localhost:8000/api/docs
- Schema OpenAPI : http://localhost:8000/api/schema

## 🔐 Authentification

L'application utilise JWT (JSON Web Tokens) pour l'authentification :

1. **Obtenir un token** : POST `/api/token/`
   ```json
   {
     "username": "your_username",
     "password": "your_password"
   }
   ```

2. **Rafraîchir le token** : POST `/api/token/refresh/`
   ```json
   {
     "refresh": "your_refresh_token"
   }
   ```

3. **Utiliser le token** : Ajouter dans les headers
   ```
   Authorization: Bearer <access_token>
   ```

## 🧪 Tests

### Backend
```bash
cd backend
source venv/bin/activate
python manage.py test
```

### Frontend
```bash
cd frontend
npm test
```

## 🔧 Commandes de Gestion (Management Commands)

### Nettoyage de l'Historique de Connexion

L'application conserve un historique des connexions utilisateur. Pour éviter que cet historique ne devienne trop volumineux, une commande de nettoyage automatique est disponible.

#### Configuration

Les paramètres peuvent être configurés dans le fichier `.env` du backend :

```env
# Durée de rétention en jours (défaut: 90 jours)
LOGIN_HISTORY_RETENTION_DAYS=90

# Nombre maximum d'entrées par utilisateur (None = illimité)
LOGIN_HISTORY_MAX_ENTRIES_PER_USER=None
```

Ou directement dans `backend/trading_journal_api/settings.py` :

```python
LOGIN_HISTORY_RETENTION_DAYS = 90  # Jours de rétention par défaut
LOGIN_HISTORY_MAX_ENTRIES_PER_USER = None  # None = illimité
```

#### Utilisation

**Mode dry-run (test sans suppression)** :
```bash
cd backend
source venv/bin/activate
python manage.py cleanup_login_history --dry-run
```

**Exécution réelle** :
```bash
python manage.py cleanup_login_history
```

**Avec paramètres personnalisés** :
```bash
# Rétention de 30 jours
python manage.py cleanup_login_history --retention-days 30

# Limite de 50 entrées par utilisateur
python manage.py cleanup_login_history --max-entries 50

# Combinaison des deux
python manage.py cleanup_login_history --retention-days 30 --max-entries 50
```

#### Automatisation avec Cron

Pour automatiser le nettoyage quotidien, ajoutez une tâche cron :

```bash
# Ouvrir le crontab
crontab -e

# Ajouter cette ligne pour exécuter le nettoyage tous les jours à 2h du matin
0 2 * * * cd /var/www/html/trading_journal/backend && source venv/bin/activate && python manage.py cleanup_login_history >> /var/log/trading_journal_cleanup.log 2>&1
```

#### Aide de la commande

```bash
python manage.py cleanup_login_history --help
```

La commande supprime automatiquement :
1. Les entrées plus anciennes que `LOGIN_HISTORY_RETENTION_DAYS` jours
2. Les entrées excédentaires si `LOGIN_HISTORY_MAX_ENTRIES_PER_USER` est défini

**Bonnes pratiques** :
- Utilisez `--dry-run` régulièrement pour vérifier ce qui sera supprimé
- Configurez une rétention de 60-90 jours selon vos besoins
- Automatisez le nettoyage avec un cron job pour éviter l'accumulation de données
- Surveillez les logs pour détecter d'éventuels problèmes

## 📦 Déploiement

### Backend (Production)

1. Configurer les variables d'environnement de production
2. Utiliser PostgreSQL au lieu de SQLite
3. Configurer un serveur WSGI (Gunicorn)
4. Configurer un reverse proxy (Nginx)
5. Collecter les fichiers statiques :
   ```bash
   python manage.py collectstatic
   ```

### Frontend (Production)

1. Build de production :
   ```bash
   npm run build
   ```
2. Servir les fichiers statiques avec Nginx ou un CDN

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.

## 📝 Licence

Ce projet est sous licence MIT.

## 👨‍💻 Auteur

Développé pour le suivi et l'analyse de trading.

## 🆘 Support

Pour toute question ou problème, veuillez ouvrir une issue sur le dépôt GitHub.


# trading-journal
