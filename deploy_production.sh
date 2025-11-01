#!/bin/bash

# 🚀 Script de déploiement en production Trading Journal
# Ce script déploie les changements de la branche dev vers la production
# Serveur: 185.217.126.243
# Répertoire: /var/www/html/trading_journal/

set -e  # Arrêter en cas d'erreur

echo "🚀 Début du déploiement en production Trading Journal..."
echo "📅 Date: $(date)"
echo ""

# Variables
PROJECT_ROOT="/var/www/html/trading_journal"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
BACKEND_DIR="$PROJECT_ROOT/backend"
APACHE_CONFIG="/etc/httpd/conf.d/trading-journal.conf"
ENV_PRODUCTION="$FRONTEND_DIR/.env.production"

# Variables pour les fichiers hashés (définies plus tard)
JS_FILE=""
CSS_FILE=""

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
info() {
    echo -e "${GREEN}ℹ️  $1${NC}"
}

warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# 1. Vérifier qu'on est dans le bon répertoire
if [ ! -d "$PROJECT_ROOT" ]; then
    error "Le répertoire $PROJECT_ROOT n'existe pas"
    exit 1
fi

cd "$PROJECT_ROOT"

# 2. 🔄 Récupérer les changements de la branche dev
info "Récupération des changements depuis la branche dev..."
if git rev-parse --git-dir > /dev/null 2>&1; then
    CURRENT_BRANCH=$(git branch --show-current)
    info "Branche actuelle: $CURRENT_BRANCH"
    
    # Sauvegarder les modifications locales si elles existent
    if ! git diff-index --quiet HEAD --; then
        warn "Modifications locales détectées, création d'un stash..."
        git stash save "Stash avant déploiement production $(date +%Y%m%d_%H%M%S)"
    fi
    
    # Passer sur dev et récupérer les dernières modifications
    git fetch origin dev || warn "Impossible de récupérer depuis origin/dev"
    git checkout dev || error "Impossible de basculer sur la branche dev"
    git pull origin dev || warn "Impossible de pull depuis origin/dev"
    
    info "✅ Code à jour depuis la branche dev"
else
    warn "Pas de dépôt Git détecté, continuation avec le code local..."
fi

# 3. 🧹 Nettoyage des fichiers obsolètes
info "Nettoyage des fichiers obsolètes..."
OBSOLETE_FILES=(
    "$FRONTEND_DIR/src/services/api.ts"
)

for file in "${OBSOLETE_FILES[@]}"; do
    if [ -f "$file" ]; then
        warn "Suppression du fichier obsolète: $file"
        rm -f "$file"
        info "✅ Fichier supprimé: $file"
    fi
done

# Supprimer aussi les références dans node_modules si elles existent
if [ -d "$FRONTEND_DIR/node_modules" ]; then
    info "Vérification des modules npm..."
fi

# 4. ⚙️ Configuration du fichier .env.production
info "Configuration du fichier .env.production..."

if [ ! -f "$ENV_PRODUCTION" ]; then
    warn "Le fichier .env.production n'existe pas, création..."
    cat > "$ENV_PRODUCTION" << EOF
REACT_APP_API_URL=https://app.kcmadininvest.fr/api
REACT_APP_ENVIRONMENT=production
EOF
    info "✅ Fichier .env.production créé"
else
    # Vérifier et mettre à jour le contenu si nécessaire
    if ! grep -q "REACT_APP_API_URL=https://app.kcmadininvest.fr/api" "$ENV_PRODUCTION"; then
        warn "Mise à jour de REACT_APP_API_URL dans .env.production..."
        # Sauvegarder l'ancien fichier
        cp "$ENV_PRODUCTION" "$ENV_PRODUCTION.backup.$(date +%Y%m%d_%H%M%S)"
        
        # Créer le nouveau fichier avec les bonnes valeurs
        cat > "$ENV_PRODUCTION" << EOF
REACT_APP_API_URL=https://app.kcmadininvest.fr/api
REACT_APP_ENVIRONMENT=production
EOF
        info "✅ .env.production mis à jour"
    else
        info "✅ .env.production déjà configuré correctement"
    fi
fi

# Définir les permissions pour le fichier .env.production
if [ -f "$ENV_PRODUCTION" ]; then
    chmod 644 "$ENV_PRODUCTION" 2>/dev/null || warn "Impossible de modifier les permissions de .env.production"
    info "✅ Permissions .env.production configurées (644)"
fi

# 5. 📦 Installation des dépendances (si package.json a changé)
info "Vérification des dépendances npm..."
cd "$FRONTEND_DIR"

# Vérifier si node_modules existe et est à jour
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    info "Installation/mise à jour des dépendances npm..."
    npm ci --production=false || npm install
    info "✅ Dépendances npm installées"
else
    info "✅ Dépendances npm à jour"
fi

# 6. 🔧 Build du frontend React
info "Compilation du frontend React en mode production..."
echo "Utilisation du fichier .env.production: $ENV_PRODUCTION"

# Vérifier que le fichier .env.production est bien présent
if [ ! -f ".env.production" ]; then
    error "Le fichier .env.production n'existe pas dans $FRONTEND_DIR"
    exit 1
fi

# Afficher le contenu (sans afficher les secrets)
info "Configuration .env.production:"
cat .env.production | grep -v "SECRET" | grep -v "KEY" || true

# Build avec le fichier .env.production
npm run build

if [ ! -d "build" ] || [ ! -f "build/index.html" ]; then
    error "Le build a échoué ou le dossier build n'existe pas"
    exit 1
fi

info "✅ Frontend compilé avec succès"

# 7. 🔄 Synchronisation des templates Django et fichiers statiques
info "Synchronisation des fichiers statiques avec Django..."
cd "$PROJECT_ROOT"

TEMPLATE_DIR="$BACKEND_DIR/trading_journal_api/templates"
TEMPLATE_FILE="$TEMPLATE_DIR/index.html"

if [ ! -d "$TEMPLATE_DIR" ]; then
    error "Le répertoire templates Django n'existe pas: $TEMPLATE_DIR"
    exit 1
fi

# Sauvegarder l'ancien template
if [ -f "$TEMPLATE_FILE" ]; then
    info "💾 Sauvegarde du template existant..."
    cp "$TEMPLATE_FILE" "${TEMPLATE_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Copier le nouveau template
info "📝 Copie du nouveau template..."
cp "$FRONTEND_DIR/build/index.html" "$TEMPLATE_FILE"

# Extraire les noms de fichiers hashés du build
info "🔍 Extraction des noms de fichiers hashés..."
JS_FILE=$(ls "$FRONTEND_DIR/build/static/js/main."*.js 2>/dev/null | head -1 | xargs basename)
CSS_FILE=$(ls "$FRONTEND_DIR/build/static/css/main."*.css 2>/dev/null | head -1 | xargs basename)

if [ -z "$JS_FILE" ] || [ -z "$CSS_FILE" ]; then
    warn "⚠️  Impossible de détecter les fichiers JS/CSS hashés, utilisation du template tel quel"
else
    info "📄 Fichiers détectés: JS=$JS_FILE, CSS=$CSS_FILE"
    
    # Mettre à jour le template avec les nouveaux noms de fichiers hashés
    info "🔄 Mise à jour du template avec les nouveaux noms de fichiers..."
    sed -i "s/main\.[a-f0-9]*\.js/$JS_FILE/g" "$TEMPLATE_FILE"
    sed -i "s/main\.[a-f0-9]*\.css/$CSS_FILE/g" "$TEMPLATE_FILE"
    info "✅ Template mis à jour avec les fichiers hashés"
fi

# Copier les autres fichiers du template
[ -f "$FRONTEND_DIR/build/manifest.json" ] && cp "$FRONTEND_DIR/build/manifest.json" "$TEMPLATE_DIR/manifest.json"
[ -f "$FRONTEND_DIR/build/favicon.ico" ] && cp "$FRONTEND_DIR/build/favicon.ico" "$TEMPLATE_DIR/favicon.ico"

# Créer les répertoires statiques Django s'ils n'existent pas
info "📁 Création des répertoires statiques Django..."
STATICFILES_DIR="$BACKEND_DIR/staticfiles"
mkdir -p "$STATICFILES_DIR/static/js"
mkdir -p "$STATICFILES_DIR/static/css"
mkdir -p "$STATICFILES_DIR/static/media" 2>/dev/null || true

# Copier les fichiers statiques vers les bons répertoires Django
info "📋 Copie des fichiers statiques..."
if [ -d "$FRONTEND_DIR/build/static/js" ]; then
    cp "$FRONTEND_DIR/build/static/js/"* "$STATICFILES_DIR/static/js/" 2>/dev/null || true
    info "✅ Fichiers JS copiés"
fi

if [ -d "$FRONTEND_DIR/build/static/css" ]; then
    cp "$FRONTEND_DIR/build/static/css/"* "$STATICFILES_DIR/static/css/" 2>/dev/null || true
    info "✅ Fichiers CSS copiés"
fi

# Copier les autres fichiers statiques (images, fonts, etc.)
if [ -d "$FRONTEND_DIR/build/static/media" ]; then
    mkdir -p "$STATICFILES_DIR/static/media"
    cp -r "$FRONTEND_DIR/build/static/media/"* "$STATICFILES_DIR/static/media/" 2>/dev/null || true
    info "✅ Fichiers média copiés"
fi

# Copier robots.txt et autres fichiers racine si présents
if [ -f "$FRONTEND_DIR/build/robots.txt" ]; then
    cp "$FRONTEND_DIR/build/robots.txt" "$STATICFILES_DIR/" 2>/dev/null || true
fi

info "✅ Fichiers statiques synchronisés"

# 8. 🔐 Vérification de la configuration WSGI
info "Vérification de la configuration WSGI..."
WSGI_FILE="$BACKEND_DIR/trading_journal_api/wsgi.py"
if [ -f "$WSGI_FILE" ]; then
    if grep -q "trading_journal_api.settings" "$WSGI_FILE"; then
        info "✅ Configuration WSGI correcte"
    else
        warn "Correction de la configuration WSGI..."
        sed -i "s/trading_journal.settings/trading_journal_api.settings/g" "$WSGI_FILE"
        info "✅ Configuration WSGI corrigée"
    fi
else
    warn "Fichier WSGI non trouvé: $WSGI_FILE"
fi

# 9. 🌐 Mise à jour de la configuration Apache
info "Vérification de la configuration Apache..."
if [ -f "$APACHE_CONFIG" ]; then
    info "✅ Configuration Apache trouvée"
else
    if [ -f "$PROJECT_ROOT/apache/trading-journal.conf" ]; then
        warn "Copie de la configuration Apache..."
        cp "$PROJECT_ROOT/apache/trading-journal.conf" "$APACHE_CONFIG"
        info "✅ Configuration Apache copiée"
    else
        warn "Configuration Apache non trouvée, vérification manuelle requise"
    fi
fi

# 10. 👤 Correction des permissions
info "Correction des permissions..."
# Utiliser chown avec apache: (sans spécifier le groupe apache explicitement)
chown -R apache: "$PROJECT_ROOT" 2>/dev/null || warn "Impossible de changer les permissions (peut nécessiter sudo)"
# S'assurer que les répertoires sont accessibles
chmod -R 755 "$PROJECT_ROOT" 2>/dev/null || true
chmod -R 644 "$PROJECT_ROOT"/*.py 2>/dev/null || true

# Permissions spécifiques pour les fichiers .env (sécurité)
ENV_FRONTEND="$FRONTEND_DIR/.env.production"
ENV_BACKEND="$BACKEND_DIR/.env"

if [ -f "$ENV_FRONTEND" ]; then
    chmod 644 "$ENV_FRONTEND" 2>/dev/null || true
    info "✅ Permissions .env.production (644)"
fi

if [ -f "$ENV_BACKEND" ]; then
    chmod 644 "$ENV_BACKEND" 2>/dev/null || true
    info "✅ Permissions backend/.env (644)"
fi

info "✅ Permissions mises à jour"

# 11. 🧹 Nettoyage des migrations Django (si nécessaire)
info "Vérification des migrations Django..."
cd "$BACKEND_DIR"

# Activer l'environnement virtuel si il existe
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
elif [ -f "../venv/bin/activate" ]; then
    source ../venv/bin/activate
fi

python manage.py makemigrations --dry-run > /dev/null 2>&1 || warn "Migrations à appliquer détectées"
python manage.py migrate --noinput
info "✅ Migrations Django appliquées"

# 12. 📊 Collecte des fichiers statiques Django
info "Collecte des fichiers statiques Django..."
python manage.py collectstatic --noinput
info "✅ Fichiers statiques Django collectés"

# 13. 🔄 Redémarrage d'Apache
info "Redémarrage d'Apache..."
if systemctl restart httpd 2>/dev/null || systemctl restart apache2 2>/dev/null; then
    info "✅ Apache redémarré"
else
    warn "Impossible de redémarrer Apache (peut nécessiter sudo)"
    warn "Veuillez exécuter manuellement: sudo systemctl restart httpd"
fi

# 14. 🔍 Vérification finale
info "Vérification finale..."

# Vérifier Apache
if systemctl is-active --quiet httpd 2>/dev/null || systemctl is-active --quiet apache2 2>/dev/null; then
    info "✅ Apache est actif"
else
    error "Apache n'est pas actif"
    exit 1
fi

# Vérifier le build
if [ -f "$FRONTEND_DIR/build/index.html" ]; then
    info "✅ Frontend compilé correctement"
else
    error "Frontend non compilé"
    exit 1
fi

# Vérifier les templates
if [ -f "$BACKEND_DIR/trading_journal_api/templates/index.html" ]; then
    info "✅ Templates Django synchronisés"
else
    error "Templates Django non synchronisés"
    exit 1
fi

# 15. 📋 Résumé du déploiement
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
info "✅ Déploiement terminé avec succès !"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Application accessible à : https://app.kcmadininvest.fr"
echo "📚 API accessible à : https://app.kcmadininvest.fr/api/"
echo "🔧 Admin Django : https://app.kcmadininvest.fr/admin/"
echo ""
echo "📦 Fichiers déployés:"
echo "   - Frontend build: $FRONTEND_DIR/build/"
echo "   - Templates Django: $BACKEND_DIR/trading_journal_api/templates/"
echo "   - Fichiers statiques: $BACKEND_DIR/staticfiles/static/"
if [ ! -z "$JS_FILE" ] && [ ! -z "$CSS_FILE" ]; then
    echo "   - JS: $JS_FILE"
    echo "   - CSS: $CSS_FILE"
fi
echo "   - Configuration: $ENV_PRODUCTION"
echo ""
echo "🎉 Tous les changements de la branche dev sont maintenant en production !"
echo ""

