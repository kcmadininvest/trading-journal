# 🚀 Guide de Déploiement en Production

Ce guide explique comment déployer les releases stables de la branche `main` vers le serveur de production.

## 🔄 Workflow Git

**Workflow recommandé** :
1. **Développement** : Tous les changements sont faits dans la branche `dev`
2. **Release** : Quand une version est prête, merger `dev` → `main` et créer un tag (ex: `v2.5.0`)
3. **Production** : Déployer depuis la branche `main` (seulement les versions taguées/testées)

## 📋 Informations du Serveur de Production

- **Serveur**: 185.217.126.243
- **Répertoire**: `/var/www/html/trading_journal/`
- **URL Production**: https://app.example.com
- **URL API**: https://app.example.com/api

## 🔧 Prérequis

1. Accès SSH au serveur de production
2. Permissions pour exécuter des commandes système (sudo pour Apache)
3. Git configuré sur le serveur
4. Node.js et npm installés
5. Python et pip installés
6. Apache configuré et actif

## 📝 Variables d'Environnement

Le fichier `.env.production` doit contenir les variables suivantes dans `/var/www/html/trading_journal/frontend/`:

```env
REACT_APP_API_URL=https://app.example.com/api
REACT_APP_ENVIRONMENT=production
```

## 🚀 Déploiement Automatique

### Méthode 1: Script Automatique (Recommandé)

Le script `deploy_production.sh` automatise tout le processus de déploiement.

1. **Se connecter au serveur de production**:
```bash
ssh root@185.217.126.243
```

2. **Naviguer vers le répertoire du projet**:
```bash
cd /var/www/html/trading_journal
```

3. **Exécuter le script de déploiement**:
```bash
./deploy_production.sh
```

Le script effectue automatiquement:
- ✅ Récupération des changements depuis la branche `main` (releases stables)
- ✅ Affichage de la version taguée (ex: v2.5.0)
- ✅ Nettoyage des fichiers obsolètes (comme `api.ts`)
- ✅ Configuration du fichier `.env.production`
- ✅ Compilation du frontend React en mode production
- ✅ Synchronisation des fichiers statiques avec Django
- ✅ Application des migrations Django
- ✅ Collecte des fichiers statiques Django
- ✅ Redémarrage d'Apache
- ✅ Vérifications finales

### Méthode 2: Déploiement Manuel

Si vous préférez déployer manuellement, suivez ces étapes:

#### 1. Récupérer les changements depuis main

```bash
cd /var/www/html/trading_journal
git fetch origin main
git checkout main
git pull origin main

# Vérifier la version taguée
git describe --tags --exact-match HEAD 2>/dev/null || git describe --tags --abbrev=0
```

#### 2. Nettoyer les fichiers obsolètes

```bash
# Supprimer l'ancien fichier api.ts s'il existe
rm -f /var/www/html/trading_journal/frontend/src/services/api.ts
```

#### 3. Configurer le fichier .env.production

```bash
cd /var/www/html/trading_journal/frontend
cat > .env.production << EOF
REACT_APP_API_URL=https://app.example.com/api
REACT_APP_ENVIRONMENT=production
EOF
```

#### 4. Installer les dépendances (si nécessaire)

```bash
cd /var/www/html/trading_journal/frontend
npm ci --production=false
```

#### 5. Compiler le frontend

```bash
npm run build
```

#### 6. Synchroniser avec Django

```bash
cd /var/www/html/trading_journal

# Sauvegarder l'ancien template
cp backend/trading_journal_api/templates/index.html backend/trading_journal_api/templates/index.html.backup

# Copier le nouveau template
cp frontend/build/index.html backend/trading_journal_api/templates/index.html

# Extraire les noms de fichiers hashés
JS_FILE=$(ls frontend/build/static/js/main.*.js | head -1 | xargs basename)
CSS_FILE=$(ls frontend/build/static/css/main.*.css | head -1 | xargs basename)

# Mettre à jour le template avec les nouveaux noms
sed -i "s/main\.[a-f0-9]*\.js/$JS_FILE/g" backend/trading_journal_api/templates/index.html
sed -i "s/main\.[a-f0-9]*\.css/$CSS_FILE/g" backend/trading_journal_api/templates/index.html

# Copier les autres fichiers
cp frontend/build/manifest.json backend/trading_journal_api/templates/manifest.json
cp frontend/build/favicon.ico backend/trading_journal_api/templates/favicon.ico

# Créer les répertoires statiques Django
mkdir -p backend/staticfiles/static/js
mkdir -p backend/staticfiles/static/css

# Copier les fichiers statiques vers les bons répertoires
cp frontend/build/static/js/* backend/staticfiles/static/js/
cp frontend/build/static/css/* backend/staticfiles/static/css/
```

#### 7. Appliquer les migrations Django

```bash
cd /var/www/html/trading_journal/backend

# Activer l'environnement virtuel si nécessaire
source venv/bin/activate  # ou ../venv/bin/activate

# Appliquer les migrations
python manage.py migrate --noinput
python manage.py collectstatic --noinput
```

#### 8. Redémarrer Apache

```bash
sudo systemctl reload httpd
# ou
sudo systemctl reload apache2
```

## 🔍 Vérifications Post-Déploiement

Après le déploiement, vérifiez que:

1. **Apache est actif**:
```bash
systemctl status httpd
# ou
systemctl status apache2
```

2. **L'application est accessible**:
```bash
curl -I https://app.example.com
```

3. **L'API répond correctement**:
```bash
curl -I https://app.example.com/api/
```

4. **Les fichiers sont bien déployés**:
```bash
# Vérifier le build
ls -la /var/www/html/trading_journal/frontend/build/index.html

# Vérifier les templates Django
ls -la /var/www/html/trading_journal/backend/trading_journal_api/templates/index.html
```

## 🐛 Dépannage

### Problème: Le build échoue

**Solution**: Vérifiez les erreurs dans la console et assurez-vous que:
- Les dépendances npm sont à jour: `npm ci`
- Le fichier `.env.production` est correctement configuré
- Node.js est à jour

### Problème: Apache ne redémarre pas

**Solution**: Exécutez manuellement avec sudo:
```bash
sudo systemctl reload httpd
```

Vérifiez les logs:
```bash
sudo tail -f /var/log/httpd/error_log
```

### Problème: Les fichiers statiques ne se chargent pas

**Solution**: 
1. Vérifiez les permissions:
```bash
sudo chown -R apache: /var/www/html/trading_journal
sudo chmod -R 755 /var/www/html/trading_journal
```

2. Vérifiez que les fichiers sont dans les bons répertoires:
```bash
ls -la /var/www/html/trading_journal/backend/staticfiles/static/js/
ls -la /var/www/html/trading_journal/backend/staticfiles/static/css/
```

3. Réexécutez collectstatic:
```bash
cd /var/www/html/trading_journal/backend
source venv/bin/activate
python manage.py collectstatic --noinput
```

### Problème: L'API ne répond pas correctement

**Solution**:
1. Vérifiez que Django est correctement configuré
2. Vérifiez les logs Django: `tail -f backend/logs/*.log`
3. Vérifiez que la configuration Apache pointe vers le bon répertoire WSGI

## 📦 Fichiers Obsolètes à Supprimer

Lors du déploiement, les fichiers suivants peuvent être supprimés s'ils existent:

- `frontend/src/services/api.ts` (remplacé par les nouveaux services)

Le script de déploiement automatique gère cela automatiquement.

## 🔄 Rollback (Retour en arrière)

Si quelque chose ne fonctionne pas après le déploiement:

1. **Revenir à la version précédente via Git**:
```bash
cd /var/www/html/trading_journal
git checkout <commit-hash-précédent>
./deploy_production.sh
```

2. **Ou restaurer depuis un backup**:
```bash
# Si vous avez fait un backup avant le déploiement
cp -r /backup/trading_journal/* /var/www/html/trading_journal/
```

## 📚 Structure des Fichiers de Production

```
/var/www/html/trading_journal/
├── frontend/
│   ├── .env.production          # Variables d'environnement production
│   ├── build/                   # Build compilé du frontend
│   │   ├── index.html          # Template HTML principal
│   │   └── static/             # Fichiers statiques (JS, CSS, media)
│   │       ├── js/             # Fichiers JavaScript hashés
│   │       ├── css/            # Fichiers CSS hashés
│   │       └── media/          # Images, fonts, etc.
│   └── src/
│       └── services/            # Services API (sans api.ts)
├── backend/
│   ├── trading_journal_api/
│   │   ├── templates/           # Templates Django
│   │   │   ├── index.html      # Template principal (mis à jour avec hash)
│   │   │   ├── manifest.json   # Manifest de l'app
│   │   │   └── favicon.ico     # Favicon
│   │   └── wsgi.py             # Configuration WSGI
│   ├── staticfiles/             # Fichiers statiques Django collectés
│   │   └── static/             
│   │       ├── js/             # Fichiers JavaScript copiés
│   │       ├── css/            # Fichiers CSS copiés
│   │       └── media/          # Fichiers média
│   ├── venv/                   # Environnement virtuel Python
│   └── manage.py
└── deploy_production.sh         # Script de déploiement
```

## 🔐 Sécurité

- Ne commitez **jamais** le fichier `.env.production` avec des secrets
- Utilisez des permissions restrictives sur les fichiers sensibles
- Vérifiez régulièrement les logs pour détecter les erreurs
- Maintenez les dépendances à jour pour éviter les vulnérabilités

## 📞 Support

En cas de problème, vérifiez:
1. Les logs Apache: `/var/log/httpd/error_log`
2. Les logs Django: `backend/logs/`
3. Les logs du build: Sortie de `npm run build`

---

**Note**: Ce processus de déploiement est conçu pour fonctionner avec la structure actuelle du projet. Si la structure change, mettez à jour ce document en conséquence.
