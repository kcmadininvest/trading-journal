# 📋 Plan de Déploiement en Production - Trading Journal

Basé sur l'analyse du projet, voici un plan complet pour déployer l'application Trading Journal sur votre serveur AlmaLinux 9 avec httpd et le domaine `app.kcmadininvest.fr`.

## 🎯 Vue d'ensemble du Projet

Votre projet **Trading Journal** est une application web complète avec :
- **Backend** : Django 4.2 + Django REST Framework + JWT Authentication
- **Frontend** : React 19 + TypeScript + Tailwind CSS
- **Base de données** : PostgreSQL (votre conteneur postgres17)
- **Cache** : Redis
- **Authentification** : JWT avec blacklist et rotation automatique

## 🚀 Plan de Déploiement Détaillé

### Phase 1 : Préparation du Serveur

#### 1.1 Mise à jour du système
```bash
sudo dnf update -y
sudo dnf install -y epel-release
```

#### 1.2 Installation des dépendances
```bash
# Python 3.11+ et outils
sudo dnf install -y python3.11 python3.11-pip python3.11-devel python3.11-venv

# Node.js 18+
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs

# Outils de développement
sudo dnf install -y gcc gcc-c++ make postgresql-devel

# Apache et modules
sudo dnf install -y httpd
sudo systemctl enable httpd
sudo systemctl start httpd
```

#### 1.3 Activation des modules Apache nécessaires
```bash
sudo dnf install -y httpd-devel
sudo a2enmod ssl rewrite proxy proxy_http headers
sudo systemctl restart httpd
```

### Phase 2 : Transfert et Configuration du Projet

#### 2.1 Préparation du package de production
```bash
# Sur votre machine de développement
cd /var/www/html/trading_journal

# Créer un package propre pour la production (exclure les fichiers inutiles)
tar --exclude='node_modules' \
    --exclude='venv' \
    --exclude='.env' \
    --exclude='*.log' \
    --exclude='__pycache__' \
    --exclude='.git' \
    --exclude='build' \
    --exclude='dist' \
    --exclude='.pytest_cache' \
    --exclude='coverage' \
    -czf trading_journal_production.tar.gz .

# Transférer vers le serveur
scp trading_journal_production.tar.gz user@your-server:/tmp/
```

#### 2.2 Extraction sur le serveur
```bash
# Sur le serveur de production
sudo mkdir -p /var/www/html/trading_journal
sudo chown -R apache:apache /var/www/html/trading_journal

# Extraire le package
cd /var/www/html
sudo tar -xzf /tmp/trading_journal_production.tar.gz -C trading_journal/
sudo chown -R apache:apache /var/www/html/trading_journal

# Configuration des droits de sécurité
sudo find /var/www/html/trading_journal -type d -exec chmod 755 {} \;
sudo find /var/www/html/trading_journal -type f -exec chmod 644 {} \;

# Fichiers de configuration sensibles
sudo chmod 640 /var/www/html/trading_journal/backend/.env
sudo chmod 640 /var/www/html/trading_journal/frontend/.env.production

# Fichiers exécutables
sudo chmod 755 /var/www/html/trading_journal/backend/manage.py
```

#### 2.3 Variables d'environnement de production
```bash
cd /var/www/html/trading_journal/backend
cp ../env.production.example .env
```

Configuration du fichier `.env` :
```bash
# Django Configuration
DEBUG=False
SECRET_KEY=your-super-secret-key-change-this-in-production-$(openssl rand -base64 32)
ALLOWED_HOSTS=app.kcmadininvest.fr,www.app.kcmadininvest.fr
CORS_ALLOWED_ORIGINS=https://app.kcmadininvest.fr,https://www.app.kcmadininvest.fr

# Database Configuration (utilise le conteneur postgres17 existant)
DB_ENGINE=django.db.backends.postgresql
DB_NAME=trading_journal_prod
DB_USER=postgres
DB_PASSWORD=your-postgres-password
DB_HOST=172.17.0.1
DB_PORT=5432

# Redis Configuration
REDIS_URL=redis://localhost:6379/1
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# Superuser Configuration
DJANGO_SUPERUSER_USERNAME=admin
DJANGO_SUPERUSER_EMAIL=admin@kcmadininvest.fr
DJANGO_SUPERUSER_PASSWORD=your-secure-admin-password

# Security Settings
SECURE_SSL_REDIRECT=True
SECURE_HSTS_SECONDS=31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS=True
SECURE_HSTS_PRELOAD=True
```

### Phase 3 : Configuration de la Base de Données

#### 3.1 Création de la base de données
```bash
# Se connecter au conteneur PostgreSQL
docker exec -it postgres17 psql -U postgres

# Créer la base de données
CREATE DATABASE trading_journal_prod;
CREATE USER trading_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE trading_journal_prod TO trading_user;
\q
```

### Phase 4 : Déploiement du Backend

#### 4.1 Configuration de l'environnement virtuel
```bash
cd /var/www/html/trading_journal/backend
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn  # Serveur WSGI pour la production
```

#### 4.2 Configuration Django
```bash
# Appliquer les migrations
python manage.py migrate

# Créer un superutilisateur
python manage.py createsuperuser

# Collecter les fichiers statiques
python manage.py collectstatic --noinput
```

#### 4.3 Configuration Gunicorn
```bash
# Créer le fichier de configuration Gunicorn
cat > gunicorn.conf.py << 'EOF'
bind = "127.0.0.1:8000"
workers = 3
worker_class = "sync"
worker_connections = 1000
timeout = 30
keepalive = 2
max_requests = 1000
max_requests_jitter = 100
preload_app = True
user = "apache"
group = "apache"
EOF
```

### Phase 5 : Déploiement du Frontend

#### 5.1 Build de production
```bash
cd /var/www/html/trading_journal/frontend

# Configuration des variables d'environnement
cat > .env.production << 'EOF'
REACT_APP_API_URL=https://app.kcmadininvest.fr/api
REACT_APP_ENVIRONMENT=production
EOF

# Installation et build
npm install
npm run build

# Copier les fichiers buildés vers le répertoire Apache
sudo cp -r build/* /var/www/html/
```

### Phase 6 : Configuration Apache

#### 6.1 Configuration du VirtualHost
```bash
sudo tee /etc/httpd/conf.d/trading-journal.conf << 'EOF'
<VirtualHost *:80>
    ServerName app.kcmadininvest.fr
    ServerAlias www.app.kcmadininvest.fr
    
    # Redirection vers HTTPS
    RewriteEngine On
    RewriteCond %{HTTPS} off
    RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</VirtualHost>

<VirtualHost *:443>
    ServerName app.kcmadininvest.fr
    ServerAlias www.app.kcmadininvest.fr
    
    # Configuration SSL (sera configurée par Let's Encrypt)
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/app.kcmadininvest.fr/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/app.kcmadininvest.fr/privkey.pem
    
    # Headers de sécurité
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    
    # Document root pour React
    DocumentRoot /var/www/html
    <Directory /var/www/html>
        AllowOverride All
        Require all granted
    </Directory>
    
    # Proxy vers l'API Django (port 8000)
    ProxyPreserveHost On
    ProxyPass /api/ http://127.0.0.1:8000/api/
    ProxyPassReverse /api/ http://127.0.0.1:8000/api/
    
    # Proxy pour les fichiers statiques Django
    ProxyPass /static/ http://127.0.0.1:8000/static/
    ProxyPassReverse /static/ http://127.0.0.1:8000/static/
    
    # Proxy pour les fichiers média Django
    ProxyPass /media/ http://127.0.0.1:8000/media/
    ProxyPassReverse /media/ http://127.0.0.1:8000/media/
    
    # Configuration des timeouts
    ProxyTimeout 300
    
    # Logs
    ErrorLog /var/log/httpd/trading-journal_error.log
    CustomLog /var/log/httpd/trading-journal_access.log combined
</VirtualHost>
EOF
```

#### 6.2 Configuration .htaccess pour React Router
```bash
sudo tee /var/www/html/.htaccess << 'EOF'
RewriteEngine On
RewriteBase /

# Gérer les routes React Router
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteCond %{REQUEST_URI} !^/api/
RewriteCond %{REQUEST_URI} !^/static/
RewriteCond %{REQUEST_URI} !^/media/
RewriteRule . /index.html [L]

# Headers de sécurité
<IfModule mod_headers.c>
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-XSS-Protection "1; mode=block"
</IfModule>
EOF
```

### Phase 7 : Configuration SSL avec Let's Encrypt

#### 7.1 Installation de Certbot
```bash
sudo dnf install -y certbot python3-certbot-apache
```

#### 7.2 Obtenir le certificat SSL
```bash
sudo certbot --apache -d app.kcmadininvest.fr -d www.app.kcmadininvest.fr
```

### Phase 8 : Services Systemd

#### 8.1 Service Django/Gunicorn
```bash
sudo tee /etc/systemd/system/trading-journal.service << 'EOF'
[Unit]
Description=Trading Journal Django Application
After=network.target postgresql.service

[Service]
Type=notify
User=apache
Group=apache
WorkingDirectory=/var/www/html/trading_journal/backend
Environment=PATH=/var/www/html/trading_journal/backend/venv/bin
ExecStart=/var/www/html/trading_journal/backend/venv/bin/gunicorn --config gunicorn.conf.py trading_journal_api.wsgi:application
ExecReload=/bin/kill -s HUP $MAINPID
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
```

#### 8.2 Service Redis (si pas déjà installé)
```bash
sudo dnf install -y redis
sudo systemctl enable redis
sudo systemctl start redis
```

### Phase 9 : Démarrage et Test

#### 9.1 Démarrage des services
```bash
# Activer et démarrer le service Django
sudo systemctl enable trading-journal.service
sudo systemctl start trading-journal.service

# Redémarrer Apache
sudo systemctl restart httpd

# Vérifier le statut
sudo systemctl status trading-journal.service
sudo systemctl status httpd
```

#### 9.2 Tests de fonctionnement
```bash
# Test de l'API
curl -X GET https://app.kcmadininvest.fr/api/

# Test de l'authentification
curl -X POST https://app.kcmadininvest.fr/api/accounts/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@kcmadininvest.fr", "password": "your-password"}'
```

## 🔧 Scripts de Maintenance

### Script de configuration des droits
```bash
#!/bin/bash
# configure-permissions.sh

PROJECT_DIR="/var/www/html/trading_journal"
WEB_USER="apache"
WEB_GROUP="apache"

echo "🔒 Configuration des droits de sécurité..."

# Propriétaire principal
sudo chown -R $WEB_USER:$WEB_GROUP $PROJECT_DIR

# Droits généraux du projet
sudo find $PROJECT_DIR -type d -exec chmod 755 {} \;
sudo find $PROJECT_DIR -type f -exec chmod 644 {} \;

# Fichiers de configuration sensibles (lecture seule pour le propriétaire)
sudo chmod 640 $PROJECT_DIR/backend/.env
sudo chmod 640 $PROJECT_DIR/frontend/.env.production

# Fichiers exécutables
sudo chmod 755 $PROJECT_DIR/backend/manage.py
sudo chmod 755 $PROJECT_DIR/backend/venv/bin/*

# Répertoires spéciaux
sudo chmod 755 $PROJECT_DIR/backend/staticfiles
sudo chmod 755 $PROJECT_DIR/backend/media
sudo chmod 755 $PROJECT_DIR/backend/logs

# Fichiers de logs (écriture pour Apache)
sudo chmod 664 $PROJECT_DIR/backend/logs/*.log 2>/dev/null || true

echo "✅ Droits configurés avec succès!"
```

### Script de mise à jour
```bash
#!/bin/bash
# update-trading-journal.sh

echo "🔄 Mise à jour de Trading Journal..."

# Arrêter le service
sudo systemctl stop trading-journal.service

# Sauvegarder les fichiers de configuration
cp /var/www/html/trading_journal/backend/.env /tmp/.env.backup
cp /var/www/html/trading_journal/frontend/.env.production /tmp/.env.production.backup

# Extraire la nouvelle version
cd /var/www/html
sudo tar -xzf /tmp/trading_journal_production.tar.gz -C trading_journal/ --overwrite

# Restaurer les fichiers de configuration
cp /tmp/.env.backup /var/www/html/trading_journal/backend/.env
cp /tmp/.env.production.backup /var/www/html/trading_journal/frontend/.env.production

# Mettre à jour le backend
cd /var/www/html/trading_journal/backend
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput

# Mettre à jour le frontend
cd ../frontend
npm install
npm run build
sudo cp -r build/* /var/www/html/

# Redémarrer le service
sudo systemctl start trading-journal.service

echo "✅ Mise à jour terminée!"
```

### Script de sauvegarde
```bash
#!/bin/bash
# backup-trading-journal.sh

BACKUP_DIR="/var/backups/trading-journal"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Sauvegarde de la base de données
docker exec postgres17 pg_dump -U postgres trading_journal_prod > $BACKUP_DIR/db_backup_$DATE.sql

# Sauvegarde des fichiers média
tar -czf $BACKUP_DIR/media_backup_$DATE.tar.gz /var/www/html/trading_journal/backend/media/

echo "✅ Sauvegarde créée: $BACKUP_DIR"
```

## 📊 Monitoring et Logs

### Configuration des logs
```bash
# Logs Django
sudo journalctl -u trading-journal.service -f

# Logs Apache
sudo tail -f /var/log/httpd/trading-journal_error.log
sudo tail -f /var/log/httpd/trading-journal_access.log
```

## 🚨 Checklist de Déploiement

- [ ] Serveur AlmaLinux 9 mis à jour
- [ ] Python 3.11+ et Node.js 18+ installés
- [ ] Apache httpd configuré avec les modules nécessaires
- [ ] Base de données PostgreSQL créée
- [ ] Variables d'environnement configurées
- [ ] Backend Django déployé avec Gunicorn
- [ ] Frontend React buildé et déployé
- [ ] Configuration Apache créée
- [ ] SSL/TLS configuré avec Let's Encrypt
- [ ] Services systemd configurés
- [ ] Tests de fonctionnement effectués
- [ ] Scripts de maintenance créés
- [ ] Monitoring configuré

## 🎯 Avantages de cette Configuration

1. **Performance** : Gunicorn + Apache pour une performance optimale
2. **Sécurité** : SSL/TLS, headers de sécurité, JWT avec blacklist
3. **Scalabilité** : Architecture modulaire et services séparés
4. **Maintenance** : Scripts automatisés et monitoring
5. **Compatibilité** : Utilise votre infrastructure existante (postgres17)

## 📝 Notes Importantes

### Gestion des Migrations
Le système d'authentification utilise un modèle User personnalisé avec des colonnes supplémentaires. En cas de problème avec les migrations :

```bash
# Nettoyer l'historique des migrations si nécessaire
python manage.py shell -c "
from django.db import connection
cursor = connection.cursor()
cursor.execute(\"DELETE FROM django_migrations WHERE app IN ('admin', 'auth', 'trades')\")
print('Migrations nettoyées')
"

# Appliquer les migrations
python manage.py migrate --fake-initial

# Vérifier que les colonnes existent
python manage.py shell -c "
from django.db import connection
cursor = connection.cursor()
cursor.execute('ALTER TABLE auth_user ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT \\'user\\'')
cursor.execute('ALTER TABLE auth_user ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE')
cursor.execute('ALTER TABLE auth_user ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()')
cursor.execute('ALTER TABLE auth_user ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()')
print('Colonnes ajoutées')
"
```

### Configuration CORS
Assurez-vous que les origines CORS sont correctement configurées pour votre domaine de production.

### Sécurité
- Changez tous les mots de passe par défaut
- Utilisez des clés secrètes fortes
- Configurez un pare-feu approprié
- Activez les logs de sécurité

## 🆘 Dépannage

### Erreurs courantes
1. **Erreur de connexion à la base de données** : Vérifiez les paramètres de connexion et l'IP du conteneur PostgreSQL
2. **Erreur CORS** : Vérifiez la configuration CORS_ALLOWED_ORIGINS
3. **Erreur de permissions** : Vérifiez les permissions des fichiers et dossiers
4. **Erreur SSL** : Vérifiez la configuration du certificat Let's Encrypt

### Commandes utiles
```bash
# Vérifier le statut des services
sudo systemctl status trading-journal.service
sudo systemctl status httpd
sudo systemctl status redis

# Vérifier les logs
sudo journalctl -u trading-journal.service --since "1 hour ago"
sudo tail -f /var/log/httpd/error_log

# Tester la configuration Apache
sudo httpd -t

# Redémarrer les services
sudo systemctl restart trading-journal.service
sudo systemctl restart httpd
```

---

**Date de création** : $(date)
**Version** : 1.0
**Auteur** : Assistant IA
**Projet** : Trading Journal - Déploiement Production
