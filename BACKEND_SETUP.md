# Configuration du Backend (sans Docker)

## Installation des dépendances

### 1. Installer pip (si nécessaire)
```bash
# Sur CentOS/RHEL/Rocky Linux
sudo yum install -y python3-pip

# Ou sur Ubuntu/Debian
sudo apt-get install -y python3-pip
```

### 2. Installer les dépendances Python
```bash
cd /var/www/html/trading_journal/backend
pip3 install -r requirements.txt
```

### 3. Configuration de la base de données
Le projet utilise PostgreSQL. Assurez-vous que PostgreSQL est installé et configuré.

### 4. Variables d'environnement
Créer un fichier `.env` dans le dossier backend avec :
```
DEBUG=True
DB_ENGINE=django.db.backends.postgresql
DB_NAME=trading_journal_db
DB_USER=trading_user
DB_PASSWORD=trading_password
DB_HOST=localhost
DB_PORT=5432
```

### 5. Migrations et superutilisateur
```bash
cd /var/www/html/trading_journal/backend
python3 manage.py migrate
python3 manage.py createsuperuser
```

### 6. Démarrer le serveur
```bash
python3 manage.py runserver 0.0.0.0:8000
```

## Endpoints disponibles

- **Métriques de trading** : `GET /api/trades/topstep/trading_metrics/`
- **Statistiques** : `GET /api/trades/topstep/statistics/`
- **Évolution du capital** : `GET /api/trades/topstep/capital_evolution/`
- **Performance par jour** : `GET /api/trades/topstep/weekday_performance/`

## Test de l'endpoint des métriques

Une fois le serveur démarré, vous pouvez tester l'endpoint :
```bash
curl http://localhost:8000/api/trades/topstep/trading_metrics/
```

L'endpoint retourne :
```json
{
  "risk_reward_ratio": 1.8,
  "profit_factor": 2.3,
  "max_drawdown": 12.5
}
```
