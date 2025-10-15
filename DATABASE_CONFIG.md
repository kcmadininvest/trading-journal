# 🗄️ Configuration de la Base de Données - Trading Journal

## ✅ Configuration PostgreSQL

Votre projet Trading Journal est maintenant configuré pour utiliser **PostgreSQL** avec un schéma dédié.

### Détails de la Configuration

| Paramètre | Valeur |
|-----------|--------|
| **Base de données** | `portfolio` |
| **Schéma** | `trading_journal` |
| **Utilisateur** | `postgres` |
| **Host** | `localhost` |
| **Port** | `5432` |

### Schéma dédié

Un schéma `trading_journal` a été créé dans la base de données `portfolio`. Cela permet de :
- ✅ Isoler les tables du journal de trading
- ✅ Partager la même base de données avec d'autres projets (comme portfolio_manager_dev)
- ✅ Faciliter la gestion et les backups
- ✅ Éviter les conflits de noms de tables

### Tables créées

Les tables Django suivantes ont été créées dans le schéma `trading_journal` :

```
auth_group
auth_group_permissions
auth_permission
auth_user
auth_user_groups
auth_user_user_permissions
django_admin_log
django_content_type
django_migrations
django_session
```

## 🔍 Vérifier la Configuration

### 1. Lister les tables dans le schéma

```bash
PGPASSWORD='your_password' psql -U postgres -d portfolio -h localhost -c \
"SELECT table_name FROM information_schema.tables WHERE table_schema = 'trading_journal' ORDER BY table_name;"
```

### 2. Se connecter au schéma

```bash
PGPASSWORD='your_password' psql -U postgres -d portfolio -h localhost
\c portfolio
SET search_path TO trading_journal;
\dt
```

### 3. Tester la connexion Django

```bash
cd /var/www/html/trading_journal/backend
source venv/bin/activate
python manage.py check --database default
python manage.py dbshell
```

## 🔧 Configuration Django

Le fichier `settings.py` utilise maintenant le paramètre `search_path` pour PostgreSQL :

```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'portfolio',
        'USER': 'postgres',
        'PASSWORD': 'your_password',
        'HOST': 'localhost',
        'PORT': '5432',
        'OPTIONS': {
            'options': '-c search_path=trading_journal'
        },
    }
}
```

## 📝 Fichier .env

Le fichier `.env` actuel :

```env
# Database Settings - PostgreSQL avec schéma dédié
DB_ENGINE=django.db.backends.postgresql
DB_NAME=portfolio
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
DB_SCHEMA=trading_journal
```

## 🔄 Migrations

### Appliquer les migrations

```bash
cd backend
source venv/bin/activate
python manage.py migrate
```

### Créer de nouvelles migrations

```bash
python manage.py makemigrations
python manage.py migrate
```

### Voir l'état des migrations

```bash
python manage.py showmigrations
```

## 🎯 Prochaines Étapes

Maintenant que la base de données est configurée, vous pouvez :

1. **Créer les modèles de données** pour les trades
2. **Générer les migrations** : `python manage.py makemigrations`
3. **Appliquer les migrations** : `python manage.py migrate`
4. **Créer un superutilisateur** : `python manage.py createsuperuser`

## 🔐 Sécurité

⚠️ **IMPORTANT - Sécurité des Mots de Passe** :

**Dans cette documentation :**
- Les mots de passe sont remplacés par `your_password` pour des raisons de sécurité
- **NE JAMAIS** committer de vrais mots de passe dans la documentation ou le code
- Les mots de passe réels doivent être dans le fichier `.env` (déjà dans .gitignore)

**En production :**
- Utilisez des variables d'environnement système
- Utilisez un gestionnaire de secrets (AWS Secrets Manager, HashiCorp Vault, etc.)
- Ne commitez JAMAIS le fichier `.env` dans git (il est déjà dans .gitignore)
- Utilisez des mots de passe forts et uniques
- Changez les mots de passe par défaut immédiatement

## 🆘 Commandes Utiles PostgreSQL

### Créer un nouveau schéma

```bash
PGPASSWORD='your_password' psql -U postgres -d portfolio -h localhost -c \
"CREATE SCHEMA IF NOT EXISTS trading_journal;"
```

### Supprimer toutes les tables du schéma

```bash
PGPASSWORD='your_password' psql -U postgres -d portfolio -h localhost -c \
"DROP SCHEMA trading_journal CASCADE; CREATE SCHEMA trading_journal;"
```

### Backup du schéma

```bash
pg_dump -U postgres -h localhost -d portfolio -n trading_journal > trading_journal_backup.sql
```

### Restaurer le schéma

```bash
psql -U postgres -h localhost -d portfolio < trading_journal_backup.sql
```

## 📊 Avantages de cette Configuration

✅ **Isolation** : Le schéma est isolé des autres projets
✅ **Flexibilité** : Possibilité de basculer facilement vers SQLite en développement
✅ **Organisation** : Structure claire dans la base de données portfolio
✅ **Performance** : PostgreSQL offre de meilleures performances pour les données relationnelles
✅ **Fonctionnalités** : Support des transactions, contraintes, index avancés

## 🔄 Alternative SQLite

Si vous souhaitez revenir à SQLite pour le développement local, modifiez le `.env` :

```env
DB_ENGINE=django.db.backends.sqlite3
DB_NAME=db.sqlite3
# Commentez les autres paramètres DB_*
```

Puis réappliquez les migrations :

```bash
python manage.py migrate
```

---

**Configuration effectuée avec succès ! ✅**

