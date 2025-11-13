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

# 2. 🔄 Récupérer les changements de la branche main (production)
info "Récupération des changements depuis la branche main (production)..."
DEPLOYMENT_LOG="$PROJECT_ROOT/deployment.log"
DEPLOYMENT_INFO="$PROJECT_ROOT/deployment_info.txt"

# Variables pour stocker les infos de déploiement
PREVIOUS_COMMIT=""
PREVIOUS_COMMIT_SHORT=""
CURRENT_COMMIT=""
CURRENT_COMMIT_SHORT=""
CURRENT_COMMIT_MSG=""
COMMITS_PULLED=""
FILES_CHANGED=""
CHANGED_COUNT=0

# Vérifier si on est dans un dépôt Git (vérifier .git ou git rev-parse)
GIT_REPO_URL="https://github.com/kcmadininvest/trading-journal.git"

if [ -d ".git" ] || git rev-parse --git-dir > /dev/null 2>&1; then
    CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
    info "Branche actuelle: $CURRENT_BRANCH"
    
    # Capturer le commit actuel AVANT le pull
    PREVIOUS_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")
    if [ ! -z "$PREVIOUS_COMMIT" ]; then
        PREVIOUS_COMMIT_SHORT=$(echo "$PREVIOUS_COMMIT" | cut -c1-7)
        info "📌 Commit actuel: $PREVIOUS_COMMIT_SHORT ($(git log -1 --format='%s' $PREVIOUS_COMMIT 2>/dev/null || echo 'unknown'))"
    fi
    
    # Sauvegarder les modifications locales si elles existent
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        warn "Modifications locales détectées, création d'un stash..."
        git stash save "Stash avant déploiement production $(date +%Y%m%d_%H%M%S)" 2>/dev/null || true
    fi
    
    # Passer sur main et récupérer les dernières modifications
    info "🔄 Récupération des changements depuis origin/main..."
    git fetch origin main 2>/dev/null || warn "Impossible de récupérer depuis origin/main"
    
    # Vérifier s'il y a des nouveaux commits
    LOCAL_COMMIT=$(git rev-parse main 2>/dev/null || echo "")
    REMOTE_COMMIT=$(git rev-parse origin/main 2>/dev/null || echo "")
    
    if [ ! -z "$LOCAL_COMMIT" ] && [ ! -z "$REMOTE_COMMIT" ] && [ "$LOCAL_COMMIT" != "$REMOTE_COMMIT" ]; then
        info "📥 Nouveaux commits détectés sur origin/main"
        # Lister les commits qui seront récupérés
        COMMITS_PULLED=$(git log --oneline $LOCAL_COMMIT..$REMOTE_COMMIT 2>/dev/null || echo "")
        if [ ! -z "$COMMITS_PULLED" ]; then
            info "📋 Commits à récupérer:"
            echo "$COMMITS_PULLED" | head -5 | while IFS= read -r commit_line; do
                info "   - $commit_line"
            done
            REMAINING=$(echo "$COMMITS_PULLED" | wc -l)
            if [ "$REMAINING" -gt 5 ]; then
                info "   ... et $(($REMAINING - 5)) autres commits"
            fi
            
            # Afficher les tags associés s'il y en a
            LATEST_TAG=$(git describe --tags --abbrev=0 $REMOTE_COMMIT 2>/dev/null || echo "")
            if [ ! -z "$LATEST_TAG" ]; then
                info "🏷️  Version: $LATEST_TAG"
            fi
        fi
    else
        info "✅ Déjà à jour avec origin/main"
        # Afficher le tag actuel même si pas de nouveaux commits
        CURRENT_TAG=$(git describe --tags --exact-match HEAD 2>/dev/null || git describe --tags --abbrev=0 2>/dev/null || echo "")
        if [ ! -z "$CURRENT_TAG" ]; then
            info "🏷️  Version actuelle: $CURRENT_TAG"
        fi
    fi
    
    git checkout main 2>/dev/null || warn "Impossible de basculer sur la branche main"
    git pull origin main 2>/dev/null || warn "Impossible de pull depuis origin/main"
    
    # Capturer le commit APRÈS le pull
    CURRENT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")
    if [ ! -z "$CURRENT_COMMIT" ]; then
        CURRENT_COMMIT_SHORT=$(echo "$CURRENT_COMMIT" | cut -c1-7)
        CURRENT_COMMIT_MSG=$(git log -1 --format='%s' $CURRENT_COMMIT 2>/dev/null || echo 'unknown')
        info "📌 Commit déployé: $CURRENT_COMMIT_SHORT ($CURRENT_COMMIT_MSG)"
        
        # Vérifier si des changements ont été récupérés
        if [ ! -z "$PREVIOUS_COMMIT" ] && [ "$PREVIOUS_COMMIT" != "$CURRENT_COMMIT" ]; then
            FILES_CHANGED=$(git diff --name-status $PREVIOUS_COMMIT..$CURRENT_COMMIT 2>/dev/null || echo "")
            if [ ! -z "$FILES_CHANGED" ]; then
                CHANGED_COUNT=$(echo "$FILES_CHANGED" | wc -l)
                info "📝 $CHANGED_COUNT fichier(s) modifié(s) récupéré(s)"
                
                # Afficher un résumé des fichiers modifiés
                info "📋 Résumé des changements:"
                echo "$FILES_CHANGED" | head -10 | while IFS= read -r change; do
                    STATUS=$(echo "$change" | cut -c1)
                    FILE=$(echo "$change" | cut -c2- | xargs)
                    case $STATUS in
                        A) info "   ✅ Ajouté: $FILE" ;;
                        M) info "   🔄 Modifié: $FILE" ;;
                        D) warn "   ❌ Supprimé: $FILE" ;;
                        *) info "   📝 $FILE" ;;
                    esac
                done
                if [ "$CHANGED_COUNT" -gt 10 ]; then
                    info "   ... et $(($CHANGED_COUNT - 10)) autres fichiers"
                fi
            fi
        fi
    fi
    
    info "✅ Code à jour depuis la branche main (production)"
else
    warn "Pas de dépôt Git détecté"
    warn "Continuation avec le code local..."
    
    # Si pas de Git, utiliser la date du fichier package.json comme référence
    if [ -f "$FRONTEND_DIR/package.json" ]; then
        PACKAGE_DATE=$(stat -c %y "$FRONTEND_DIR/package.json" 2>/dev/null | cut -d' ' -f1 || echo "unknown")
        info "📅 Date du package.json: $PACKAGE_DATE"
    fi
fi

# 3. 🧹 Nettoyage des fichiers obsolètes
info "Nettoyage des fichiers obsolètes..."

# Supprimer l'ancien fichier api.ts et autres fichiers obsolètes (si présents)
OBSOLETE_FILES=(
    "$FRONTEND_DIR/src/services/api.ts"
    "$FRONTEND_DIR/src/lib/apiClient.ts"
)

for file in "${OBSOLETE_FILES[@]}"; do
    if [ -f "$file" ]; then
        warn "Suppression du fichier obsolète: $file"
        rm -f "$file"
        info "✅ Fichier supprimé: $file"
    fi
done

# 4. ⚙️ Configuration du fichier .env.production
info "Configuration du fichier .env.production..."

if [ ! -f "$ENV_PRODUCTION" ]; then
    warn "Le fichier .env.production n'existe pas, création..."
    cat > "$ENV_PRODUCTION" << EOF
REACT_APP_API_URL=https://app.kctradingjournal.com/api
REACT_APP_ENVIRONMENT=production
EOF
    info "✅ Fichier .env.production créé"
else
    # Vérifier et mettre à jour le contenu si nécessaire
    if ! grep -q "REACT_APP_API_URL=https://app.kctradingjournal.com/api" "$ENV_PRODUCTION"; then
        warn "Mise à jour de REACT_APP_API_URL dans .env.production..."
        # Sauvegarder l'ancien fichier
        cp "$ENV_PRODUCTION" "$ENV_PRODUCTION.backup.$(date +%Y%m%d_%H%M%S)"
        
        # Créer le nouveau fichier avec les bonnes valeurs
        cat > "$ENV_PRODUCTION" << EOF
REACT_APP_API_URL=https://app.kctradingjournal.com/api
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

# 5. 🔧 Vérification et installation des dépendances npm (si nécessaire)
cd "$FRONTEND_DIR"

# Vérifier si package-lock.json a changé depuis le dernier déploiement
LOCKFILE_HASH_FILE="$FRONTEND_DIR/.package-lock.hash"
CURRENT_LOCKFILE_HASH=""
NEEDS_INSTALL=false

if [ -f "package-lock.json" ]; then
    # Calculer le hash du package-lock.json actuel
    CURRENT_LOCKFILE_HASH=$(md5sum package-lock.json 2>/dev/null | cut -d' ' -f1 || sha256sum package-lock.json 2>/dev/null | cut -d' ' -f1 || echo "")
    
    if [ ! -z "$CURRENT_LOCKFILE_HASH" ]; then
        # Vérifier si le hash a changé
        if [ -f "$LOCKFILE_HASH_FILE" ]; then
            PREVIOUS_HASH=$(cat "$LOCKFILE_HASH_FILE" 2>/dev/null || echo "")
            if [ "$CURRENT_LOCKFILE_HASH" != "$PREVIOUS_HASH" ]; then
                info "📦 package-lock.json a changé, installation des dépendances nécessaire..."
                NEEDS_INSTALL=true
            else
                info "✅ package-lock.json inchangé, pas besoin de réinstaller les dépendances"
            fi
        else
            # Pas de hash précédent, installation nécessaire
            info "📦 Première installation ou hash manquant, installation des dépendances..."
            NEEDS_INSTALL=true
        fi
    else
        warn "Impossible de calculer le hash de package-lock.json, installation par précaution..."
        NEEDS_INSTALL=true
    fi
else
    warn "package-lock.json introuvable, installation des dépendances..."
    NEEDS_INSTALL=true
fi

# Installer les dépendances seulement si nécessaire
if [ "$NEEDS_INSTALL" = true ]; then
    info "Installation des dépendances npm..."
    # Utiliser --legacy-peer-deps pour résoudre les conflits de peer dependencies
    npm ci --production=false --legacy-peer-deps || npm install --legacy-peer-deps
    
    # Sauvegarder le hash pour la prochaine fois
    if [ ! -z "$CURRENT_LOCKFILE_HASH" ]; then
        echo "$CURRENT_LOCKFILE_HASH" > "$LOCKFILE_HASH_FILE"
        info "✅ Hash du package-lock.json sauvegardé"
    fi
    
    info "✅ Dépendances npm installées"
else
    info "⏭️  Installation des dépendances ignorée (environnement identique)"
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

# Copier les autres fichiers du template (manifest, favicon, logos)
[ -f "$FRONTEND_DIR/build/manifest.json" ] && \cp -f "$FRONTEND_DIR/build/manifest.json" "$TEMPLATE_DIR/manifest.json"
[ -f "$FRONTEND_DIR/build/favicon.ico" ] && \cp -f "$FRONTEND_DIR/build/favicon.ico" "$TEMPLATE_DIR/favicon.ico"
[ -f "$FRONTEND_DIR/build/favicon.svg" ] && \cp -f "$FRONTEND_DIR/build/favicon.svg" "$TEMPLATE_DIR/favicon.svg"
[ -f "$FRONTEND_DIR/build/logo192.png" ] && \cp -f "$FRONTEND_DIR/build/logo192.png" "$TEMPLATE_DIR/logo192.png"
[ -f "$FRONTEND_DIR/build/logo512.png" ] && \cp -f "$FRONTEND_DIR/build/logo512.png" "$TEMPLATE_DIR/logo512.png"
# Si les fichiers ne sont pas dans build, les copier depuis public
[ ! -f "$TEMPLATE_DIR/favicon.svg" ] && [ -f "$FRONTEND_DIR/public/favicon.svg" ] && \cp -f "$FRONTEND_DIR/public/favicon.svg" "$TEMPLATE_DIR/favicon.svg"
[ ! -f "$TEMPLATE_DIR/logo192.png" ] && [ -f "$FRONTEND_DIR/public/logo192.png" ] && \cp -f "$FRONTEND_DIR/public/logo192.png" "$TEMPLATE_DIR/logo192.png"
[ ! -f "$TEMPLATE_DIR/logo512.png" ] && [ -f "$FRONTEND_DIR/public/logo512.png" ] && \cp -f "$FRONTEND_DIR/public/logo512.png" "$TEMPLATE_DIR/logo512.png"

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

# Créer un fichier d'information de déploiement
cat > "$DEPLOYMENT_INFO" << EOF
# Informations de déploiement
Date: $(date)
Serveur: $(hostname)

## Informations Git
Branche: ${CURRENT_BRANCH:-"N/A (pas de Git)"}
Commit précédent: ${PREVIOUS_COMMIT:-"N/A"}
Commit déployé: ${CURRENT_COMMIT:-"N/A"}
Commit court: ${CURRENT_COMMIT_SHORT:-"N/A"}

## Fichiers déployés
- Frontend build: $FRONTEND_DIR/build/
- Templates Django: $BACKEND_DIR/trading_journal_api/templates/
- Fichiers statiques: $BACKEND_DIR/staticfiles/static/
- JS: ${JS_FILE:-"N/A"}
- CSS: ${CSS_FILE:-"N/A"}
- Configuration: $ENV_PRODUCTION

## Vérifications
Apache: $(systemctl is-active httpd 2>/dev/null || systemctl is-active apache2 2>/dev/null || echo "inactif")
Build: $([ -f "$FRONTEND_DIR/build/index.html" ] && echo "OK" || echo "ERREUR")
Template: $([ -f "$BACKEND_DIR/trading_journal_api/templates/index.html" ] && echo "OK" || echo "ERREUR")
EOF

# Afficher le résumé
echo "🌐 Application accessible à : https://app.kctradingjournal.com"
echo "📚 API accessible à : https://app.kctradingjournal.com/api/"
echo "🔧 Admin Django : https://app.kctradingjournal.com/admin/"
echo ""

# Afficher les informations Git si disponibles
if [ ! -z "$CURRENT_COMMIT" ]; then
    echo "📌 Informations de version:"
    echo "   - Branche: ${CURRENT_BRANCH:-main}"
    echo "   - Commit: ${CURRENT_COMMIT_SHORT:-N/A}"
    if [ ! -z "$CURRENT_COMMIT_MSG" ]; then
        echo "   - Message: $CURRENT_COMMIT_MSG"
    fi
    
    if [ ! -z "$PREVIOUS_COMMIT" ] && [ "$PREVIOUS_COMMIT" != "$CURRENT_COMMIT" ]; then
        echo "   - Commit précédent: $(echo $PREVIOUS_COMMIT | cut -c1-7)"
        echo "   - ✅ Nouvelles modifications récupérées et déployées"
    else
        echo "   - ℹ️  Aucun nouveau commit (déjà à jour)"
    fi
    echo ""
fi

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

# Afficher le chemin du fichier d'information
info "📄 Détails du déploiement enregistrés dans: $DEPLOYMENT_INFO"
echo ""

if [ ! -z "$CURRENT_COMMIT" ] && [ ! -z "$PREVIOUS_COMMIT" ] && [ "$PREVIOUS_COMMIT" != "$CURRENT_COMMIT" ]; then
    echo "🎉 Nouvelle release de la branche main déployée avec succès !"
    CURRENT_TAG=$(git describe --tags --exact-match HEAD 2>/dev/null || git describe --tags --abbrev=0 2>/dev/null || echo "")
    if [ ! -z "$CURRENT_TAG" ]; then
        echo "🏷️  Version déployée: $CURRENT_TAG"
    fi
else
    echo "✅ Déploiement terminé (code déjà à jour)"
fi
echo ""