# Trading Journal - Application de Journal de Trading

Une application web complète pour suivre et analyser vos trades avec un backend Django REST Framework et un frontend React + TypeScript.

## 🚀 Caractéristiques

- **Backend Django REST Framework** : API RESTful robuste et sécurisée
- **Frontend React + TypeScript** : Interface utilisateur moderne et réactive
- **Authentification JWT** : Système d'authentification sécurisé
- **Gestion des trades** : Enregistrez, suivez et analysez vos trades
- **Visualisations** : Graphiques et statistiques de performance
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

4. **Appliquer les migrations**
   ```bash
   python manage.py migrate
   ```

5. **Créer un superutilisateur**
   ```bash
   python manage.py createsuperuser
   ```

6. **Lancer le serveur de développement**
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
