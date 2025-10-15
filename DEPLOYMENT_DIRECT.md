# Guide de Déploiement Direct - Trading Journal

Déploiement sans Docker, directement sur votre serveur Apache existant.

## Prérequis

- Apache2 installé et configuré
- Python 3.11+ installé
- Node.js 18+ installé
- PostgreSQL (votre conteneur postgres17)
- Certificat SSL (Let's Encrypt)

## Étapes de Déploiement

### 1. Préparation du Serveur

```bash
# Mettre à jour le système
sudo apt update && sudo apt upgrade -y

# Installer Python et pip
sudo apt install python3 python3-pip python3-venv -y

# Installer Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Installer les dépendances système
sudo apt install postgresql-client build-essential libpq-dev -y

# Installer Apache et modules
sudo apt install apache2 -y
sudo a2enmod ssl rewrite proxy proxy_http headers
sudo systemctl restart apache2
```

### 2. Transfert et Configuration

```bash
# Sur votre machine de développement
tar -czf trading_journal.tar.gz trading_journal/

# Transférer vers le serveur
scp trading_journal.tar.gz user@your-server:/home/user/

# Sur le serveur
cd /home/user/
tar -xzf trading_journal.tar.gz
cd trading_journal/
```

### 3. Configuration Backend Django

```bash
# Créer un environnement virtuel
cd backend/
python3 -m venv venv
source venv/bin/activate

# Installer les dépendances
pip install -r requirements.txt

# Configurer l'environnement
cp ../env.production.example .env
nano .env  # Configurer vos paramètres

# Appliquer les migrations
python manage.py migrate

# Créer un superutilisateur
python manage.py createsuperuser

# Collecter les fichiers statiques
python manage.py collectstatic --noinput
```

### 4. Configuration Frontend React

```bash
# Installer les dépendances
cd ../frontend/
npm install

# Build pour la production
npm run build

# Copier les fichiers buildés vers Apache
sudo cp -r build/* /var/www/html/
```

### 5. Configuration Apache

```bash
# Créer la configuration Apache
sudo nano /etc/apache2/sites-available/trading-journal.conf
```

Contenu du fichier :

```apache
<VirtualHost *:80>
    ServerName your-domain.com
    ServerAlias www.your-domain.com
    
    # Redirection vers HTTPS
    RewriteEngine On
    RewriteCond %{HTTPS} off
    RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</VirtualHost>

<VirtualHost *:443>
    ServerName your-domain.com
    ServerAlias www.your-domain.com
    
    # Configuration SSL
    SSLEngine on
    SSLCertificateFile /path/to/your/certificate.crt
    SSLCertificateKeyFile /path/to/your/private.key
    
    # Document root pour React
    DocumentRoot /var/www/html
    <Directory /var/www/html>
        AllowOverride All
        Require all granted
    </Directory>
    
    # Proxy vers Django (port 8000)
    ProxyPreserveHost On
    ProxyPass /api/ http://localhost:8000/api/
    ProxyPassReverse /api/ http://localhost:8000/api/
    
    # Proxy pour les fichiers statiques Django
    ProxyPass /static/ http://localhost:8000/static/
    ProxyPassReverse /static/ http://localhost:8000/static/
    
    # Proxy pour les fichiers média Django
    ProxyPass /media/ http://localhost:8000/media/
    ProxyPassReverse /media/ http://localhost:8000/media/
    
    # Logs
    ErrorLog ${APACHE_LOG_DIR}/trading-journal_error.log
    CustomLog ${APACHE_LOG_DIR}/trading-journal_access.log combined
</VirtualHost>
```

### 6. Configuration .htaccess pour React Router

```bash
# Créer le fichier .htaccess
sudo nano /var/www/html/.htaccess
```

Contenu :

```apache
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
```

### 7. Service Systemd pour Django

```bash
# Créer le service systemd
sudo nano /etc/systemd/system/trading-journal.service
```

Contenu :

```ini
[Unit]
Description=Trading Journal Django Application
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/home/user/trading_journal/backend
Environment=PATH=/home/user/trading_journal/backend/venv/bin
ExecStart=/home/user/trading_journal/backend/venv/bin/python manage.py runserver 0.0.0.0:8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

### 8. Démarrage des Services

```bash
# Activer et démarrer le service Django
sudo systemctl enable trading-journal.service
sudo systemctl start trading-journal.service

# Activer le site Apache
sudo a2ensite trading-journal.conf
sudo a2dissite 000-default.conf
sudo systemctl restart apache2

# Vérifier le statut
sudo systemctl status trading-journal.service
```

### 9. Configuration SSL avec Let's Encrypt

```bash
# Installer Certbot
sudo apt install certbot python3-certbot-apache -y

# Obtenir un certificat SSL
sudo certbot --apache -d your-domain.com -d www.your-domain.com
```

## Commandes de Maintenance

### Redémarrage des Services

```bash
# Redémarrer Django
sudo systemctl restart trading-journal.service

# Redémarrer Apache
sudo systemctl restart apache2

# Voir les logs
sudo journalctl -u trading-journal.service -f
```

### Mise à Jour de l'Application

```bash
# Arrêter le service
sudo systemctl stop trading-journal.service

# Mettre à jour le code
cd /home/user/trading_journal/
git pull origin main  # ou transférer les nouveaux fichiers

# Mettre à jour le backend
cd backend/
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput

# Mettre à jour le frontend
cd ../frontend/
npm install
npm run build
sudo cp -r build/* /var/www/html/

# Redémarrer le service
sudo systemctl start trading-journal.service
```

### Sauvegarde de la Base de Données

```bash
# Sauvegarde
docker exec postgres17 pg_dump -U postgres trading_journal_prod > backup_$(date +%Y%m%d_%H%M%S).sql

# Restauration
docker exec -i postgres17 psql -U postgres trading_journal_prod < backup_file.sql
```

## Avantages de cette Approche

1. **Simplicité** : Moins de fichiers de configuration
2. **Performance** : Pas de surcharge Docker
3. **Debugging** : Plus facile de débugger
4. **Ressources** : Moins de consommation RAM/CPU
5. **Intégration** : Utilise directement Apache existant

## Inconvénients

1. **Dépendances** : Gestion manuelle des versions Python/Node
2. **Isolation** : Moins d'isolation entre services
3. **Portabilité** : Moins portable entre environnements

## Conclusion

Cette approche directe est plus simple et adaptée à votre cas d'usage. Docker reste utile pour :
- Environnements de développement
- Applications avec beaucoup de services
- Déploiements sur plusieurs serveurs
- Équipes avec des environnements différents

Pour votre cas, le déploiement direct est probablement plus approprié !
