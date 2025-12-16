#!/bin/bash

# 🚀 Script de déploiement en production Trading Journal
# Ce script déploie les changements de la branche dev vers la production
# 
# CONFIGURATION:
# Les valeurs sensibles sont externalisées dans le fichier deploy.config
# Créez ce fichier à partir de deploy.config.example

set -e  # Arrêter en cas d'erreur

echo "🚀 Début du déploiement en production Trading Journal..."
echo "📅 Date: $(date)"
echo ""

# ============================================================================
# CHARGEMENT DE LA CONFIGURATION
# ============================================================================

# Déterminer le répertoire du script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/deploy.config"

# Fonction pour charger la configuration
load_config() {
    if [ ! -f "$CONFIG_FILE" ]; then
        echo "⚠️  Fichier de configuration $CONFIG_FILE non trouvé"
        echo "📝 Créez-le à partir de deploy.config.example"
        echo ""
        # Utiliser les valeurs par défaut si le fichier n'existe pas
        PROJECT_ROOT="${PROJECT_ROOT:-/var/www/html/trading_journal}"
        APACHE_CONFIG="${APACHE_CONFIG:-/etc/httpd/conf.d/trading-journal.conf}"
        GIT_REPO_URL="${GIT_REPO_URL:-}"
        API_URL="${API_URL:-https://app.kctradingjournal.com/api}"
        FRONTEND_URL="${FRONTEND_URL:-https://app.kctradingjournal.com}"
        ADMIN_URL="${ADMIN_URL:-https://app.kctradingjournal.com/admin}"
        REACT_APP_API_URL="${REACT_APP_API_URL:-https://app.kctradingjournal.com/api}"
        REACT_APP_ENVIRONMENT="${REACT_APP_ENVIRONMENT:-production}"
    else
        # Charger les variables depuis le fichier de configuration
        # Ignorer les lignes de commentaires et les lignes vides
        while IFS='=' read -r key value || [ -n "$key" ]; do
            # Ignorer les lignes vides et les commentaires
            [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue
            # Supprimer les espaces autour de la clé et de la valeur
            key=$(echo "$key" | xargs)
            value=$(echo "$value" | xargs)
            # Exporter la variable si elle n'est pas vide
            if [ ! -z "$key" ] && [ ! -z "$value" ]; then
                export "$key=$value"
            fi
        done < "$CONFIG_FILE"
    fi
}

# Charger la configuration
load_config

# Variables dérivées (basées sur la configuration chargée)
PROJECT_ROOT="${PROJECT_ROOT:-/var/www/html/trading_journal}"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
BACKEND_DIR="$PROJECT_ROOT/backend"
APACHE_CONFIG="${APACHE_CONFIG:-/etc/httpd/conf.d/trading-journal.conf}"
ENV_PRODUCTION="$FRONTEND_DIR/.env.production"
GIT_REPO_URL="${GIT_REPO_URL:-}"
API_URL="${API_URL:-https://app.kctradingjournal.com/api}"
FRONTEND_URL="${FRONTEND_URL:-https://app.kctradingjournal.com}"
ADMIN_URL="${ADMIN_URL:-https://app.kctradingjournal.com/admin}"
REACT_APP_API_URL="${REACT_APP_API_URL:-https://app.kctradingjournal.com/api}"
REACT_APP_ENVIRONMENT="${REACT_APP_ENVIRONMENT:-production}"

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
DEPLOY_TAG=""

# Vérifier si on est dans un dépôt Git (vérifier .git ou git rev-parse)
# GIT_REPO_URL est maintenant chargé depuis la configuration

if [ -d ".git" ] || git rev-parse --git-dir > /dev/null 2>&1; then
    CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
    info "Branche actuelle: $CURRENT_BRANCH"
    
    # Capturer le commit actuel AVANT le pull
    PREVIOUS_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")
    if [ ! -z "$PREVIOUS_COMMIT" ]; then
        PREVIOUS_COMMIT_SHORT=$(echo "$PREVIOUS_COMMIT" | cut -c1-7)
        info "📌 Commit actuel: $PREVIOUS_COMMIT_SHORT ($(git log -1 --format='%s' $PREVIOUS_COMMIT 2>/dev/null || echo 'unknown'))"
    fi
    
    # Récupérer les tags distants avant de vérifier les modifications
    info "🔄 Récupération des tags distants..."
    git fetch origin --tags --quiet 2>/dev/null || warn "Impossible de récupérer les tags distants"
    
    # Sauvegarder les modifications locales si elles existent (en excluant les fichiers générés)
    # Note: Le template index.html est marqué assume-unchanged et sera mis à jour plus tard dans le script
    TEMPLATE_FILE="$BACKEND_DIR/trading_journal_api/templates/index.html"
    TEMPLATE_WAS_MODIFIED=false
    # S'assurer que le template est marqué comme assume-unchanged avant de vérifier les modifications
    if [ -f "$TEMPLATE_FILE" ]; then
        git update-index --assume-unchanged "$TEMPLATE_FILE" 2>/dev/null || true
        # Vérifier si le template était modifié (même s'il est assume-unchanged)
        if ! git diff-index --quiet HEAD -- "$TEMPLATE_FILE" 2>/dev/null; then
            TEMPLATE_WAS_MODIFIED=true
        fi
    fi
    
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        # Vérifier s'il y a des modifications autres que les fichiers générés
        MODIFIED_FILES=$(git diff-index --name-only HEAD -- 2>/dev/null | grep -v "frontend/src/version.ts" || true)
        if [ ! -z "$MODIFIED_FILES" ]; then
            warn "Modifications locales détectées, création d'un stash..."
            git stash save "Stash avant déploiement production $(date +%Y%m%d_%H%M%S)" 2>/dev/null || true
        else
            # Seulement version.ts modifié, on le restaure
            info "ℹ️  Seul le fichier version.ts (généré) est modifié, restauration..."
            git checkout -- frontend/src/version.ts 2>/dev/null || true
        fi
    fi
    
    # Nettoyer les anciens stashes de déploiement (garder seulement les 5 derniers)
    STASH_COUNT=$(git stash list | grep -c "Stash avant déploiement production" || echo "0")
    if [ "$STASH_COUNT" -gt 5 ]; then
        info "Nettoyage des anciens stashes de déploiement (garder les 5 derniers)..."
        # Récupérer les stashes à supprimer (tous sauf les 5 derniers)
        STASHES_TO_DROP=$(git stash list | grep "Stash avant déploiement production" | tail -n +6 | cut -d: -f1)
        for stash in $STASHES_TO_DROP; do
            git stash drop "$stash" 2>/dev/null || true
        done
        info "✅ Anciens stashes nettoyés"
    fi
    
    # Récupérer les tags distants et déterminer le tag à déployer
    info "🔄 Récupération des tags distants..."
    git fetch origin --tags 2>/dev/null || warn "Impossible de récupérer les tags distants"
    git fetch origin main 2>/dev/null || warn "Impossible de récupérer depuis origin/main"
    
    # Détecter le dernier tag (par version)
    DEPLOY_TAG=$(git tag --sort=-version:refname 2>/dev/null | head -1 || echo "")
    
    if [ -z "$DEPLOY_TAG" ]; then
        warn "⚠️  Aucun tag trouvé, utilisation du dernier commit de main"
        git checkout main 2>/dev/null || warn "Impossible de basculer sur la branche main"
        git pull origin main 2>/dev/null || warn "Impossible de pull depuis origin/main"
    else
        info "🏷️  Tag détecté: $DEPLOY_TAG"
        
        # Vérifier si le tag existe localement ou à distance
        TAG_COMMIT=$(git rev-parse "$DEPLOY_TAG" 2>/dev/null || echo "")
        if [ -z "$TAG_COMMIT" ]; then
            # Le tag n'existe pas localement, essayer de le récupérer depuis origin
            TAG_COMMIT=$(git rev-parse "origin/$DEPLOY_TAG" 2>/dev/null || git ls-remote --tags origin "$DEPLOY_TAG" 2>/dev/null | cut -f1 || echo "")
        fi
        
        if [ -z "$TAG_COMMIT" ]; then
            warn "⚠️  Impossible de trouver le commit du tag $DEPLOY_TAG, utilisation du dernier commit de main"
            DEPLOY_TAG=""  # Réinitialiser car le tag n'a pas pu être utilisé
            git checkout main 2>/dev/null || warn "Impossible de basculer sur la branche main"
            git pull origin main 2>/dev/null || warn "Impossible de pull depuis origin/main"
        else
            # Vérifier le commit actuel pour voir s'il y a des changements
            CURRENT_HEAD=$(git rev-parse HEAD 2>/dev/null || echo "")
            if [ ! -z "$CURRENT_HEAD" ] && [ "$CURRENT_HEAD" = "$TAG_COMMIT" ]; then
                info "✅ Déjà sur le commit du tag $DEPLOY_TAG"
            else
                info "🔄 Checkout du tag $DEPLOY_TAG (commit: $(echo $TAG_COMMIT | cut -c1-7))"
                # Essayer le checkout (les avertissements sur detached HEAD sont normaux et peuvent être ignorés)
                if git checkout "$DEPLOY_TAG" > /dev/null 2>&1; then
                    # Vérifier que le checkout a bien abouti au bon commit
                    CURRENT_HEAD_AFTER=$(git rev-parse HEAD 2>/dev/null || echo "")
                    if [ ! -z "$CURRENT_HEAD_AFTER" ] && [ "$CURRENT_HEAD_AFTER" = "$TAG_COMMIT" ]; then
                        info "✅ Checkout du tag $DEPLOY_TAG réussi (commit: $(echo $CURRENT_HEAD_AFTER | cut -c1-7))"
                    else
                        warn "⚠️  Le checkout n'a pas abouti au bon commit (attendu: $(echo $TAG_COMMIT | cut -c1-7), obtenu: $(echo $CURRENT_HEAD_AFTER | cut -c1-7))"
                        warn "Tentative avec fetch du tag depuis origin..."
                        git fetch origin tag "$DEPLOY_TAG" 2>/dev/null || true
                        if git checkout "$DEPLOY_TAG" > /dev/null 2>&1; then
                            CURRENT_HEAD_AFTER=$(git rev-parse HEAD 2>/dev/null || echo "")
                            if [ ! -z "$CURRENT_HEAD_AFTER" ] && [ "$CURRENT_HEAD_AFTER" = "$TAG_COMMIT" ]; then
                                info "✅ Checkout du tag $DEPLOY_TAG réussi après fetch"
                            else
                                warn "Échec du checkout du tag, utilisation de main"
                                DEPLOY_TAG=""  # Réinitialiser car le tag n'a pas pu être utilisé
                                git checkout main 2>/dev/null || warn "Impossible de basculer sur la branche main"
                                git pull origin main 2>/dev/null || warn "Impossible de pull depuis origin/main"
                            fi
                        else
                            warn "Échec du checkout du tag, utilisation de main"
                            DEPLOY_TAG=""  # Réinitialiser car le tag n'a pas pu être utilisé
                            git checkout main 2>/dev/null || warn "Impossible de basculer sur la branche main"
                            git pull origin main 2>/dev/null || warn "Impossible de pull depuis origin/main"
                        fi
                    fi
                else
                    warn "Impossible de checkout le tag $DEPLOY_TAG, tentative avec fetch depuis origin..."
                    git fetch origin tag "$DEPLOY_TAG" 2>/dev/null || true
                    if git checkout "$DEPLOY_TAG" > /dev/null 2>&1; then
                        CURRENT_HEAD_AFTER=$(git rev-parse HEAD 2>/dev/null || echo "")
                        if [ ! -z "$CURRENT_HEAD_AFTER" ] && [ "$CURRENT_HEAD_AFTER" = "$TAG_COMMIT" ]; then
                            info "✅ Checkout du tag $DEPLOY_TAG réussi après fetch"
                        else
                            warn "Échec du checkout du tag, utilisation de main"
                            DEPLOY_TAG=""  # Réinitialiser car le tag n'a pas pu être utilisé
                            git checkout main 2>/dev/null || warn "Impossible de basculer sur la branche main"
                            git pull origin main 2>/dev/null || warn "Impossible de pull depuis origin/main"
                        fi
                    else
                        warn "Échec du checkout du tag, utilisation de main"
                        DEPLOY_TAG=""  # Réinitialiser car le tag n'a pas pu être utilisé
                        git checkout main 2>/dev/null || warn "Impossible de basculer sur la branche main"
                        git pull origin main 2>/dev/null || warn "Impossible de pull depuis origin/main"
                    fi
                fi
            fi
        fi
    fi
    
    # Si le template était modifié avant le checkout, le restaurer depuis le stash
    # (il sera mis à jour plus tard dans le script avec les nouveaux hash)
    if [ "$TEMPLATE_WAS_MODIFIED" = true ] && [ -f "$TEMPLATE_FILE" ]; then
        # Le template sera mis à jour plus tard, donc on ne fait rien ici
        # mais on s'assure qu'il n'est pas restauré depuis Git
        git update-index --assume-unchanged "$TEMPLATE_FILE" 2>/dev/null || true
    fi
    
    # Capturer le commit APRÈS le checkout
    CURRENT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")
    if [ ! -z "$CURRENT_COMMIT" ]; then
        CURRENT_COMMIT_SHORT=$(echo "$CURRENT_COMMIT" | cut -c1-7)
        CURRENT_COMMIT_MSG=$(git log -1 --format='%s' $CURRENT_COMMIT 2>/dev/null || echo 'unknown')
        
        # Vérifier si on est sur un tag
        CURRENT_TAG=$(git describe --tags --exact-match HEAD 2>/dev/null || echo "")
        if [ ! -z "$CURRENT_TAG" ]; then
            info "📌 Commit déployé: $CURRENT_COMMIT_SHORT ($CURRENT_COMMIT_MSG) [Tag: $CURRENT_TAG]"
        else
            info "📌 Commit déployé: $CURRENT_COMMIT_SHORT ($CURRENT_COMMIT_MSG)"
        fi
        
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
    
    # Afficher le tag déployé si disponible
    if [ ! -z "$DEPLOY_TAG" ]; then
        info "✅ Code déployé depuis le tag $DEPLOY_TAG"
    else
        info "✅ Code à jour depuis la branche main (production)"
    fi
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
REACT_APP_API_URL=${REACT_APP_API_URL}
REACT_APP_ENVIRONMENT=${REACT_APP_ENVIRONMENT}
EOF
    info "✅ Fichier .env.production créé"
else
    # Vérifier et mettre à jour le contenu si nécessaire
    if ! grep -q "REACT_APP_API_URL=${REACT_APP_API_URL}" "$ENV_PRODUCTION"; then
        warn "Mise à jour de REACT_APP_API_URL dans .env.production..."
        # Sauvegarder l'ancien fichier
        cp "$ENV_PRODUCTION" "$ENV_PRODUCTION.backup.$(date +%Y%m%d_%H%M%S)"
        
        # Créer le nouveau fichier avec les bonnes valeurs
        cat > "$ENV_PRODUCTION" << EOF
REACT_APP_API_URL=${REACT_APP_API_URL}
REACT_APP_ENVIRONMENT=${REACT_APP_ENVIRONMENT}
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
# IMPORTANT: Cette vérification se fait APRÈS le git pull pour comparer avec le fichier à jour
LOCKFILE_HASH_FILE="$FRONTEND_DIR/.package-lock.hash"
CURRENT_LOCKFILE_HASH=""
NEEDS_INSTALL=false

if [ -f "package-lock.json" ]; then
    # Calculer le hash du package-lock.json actuel (après le pull)
    CURRENT_LOCKFILE_HASH=$(md5sum package-lock.json 2>/dev/null | cut -d' ' -f1 || sha256sum package-lock.json 2>/dev/null | cut -d' ' -f1 || echo "")
    
    if [ ! -z "$CURRENT_LOCKFILE_HASH" ]; then
        # Vérifier si le hash a changé
        if [ -f "$LOCKFILE_HASH_FILE" ]; then
            PREVIOUS_HASH=$(cat "$LOCKFILE_HASH_FILE" 2>/dev/null || echo "")
            if [ "$CURRENT_LOCKFILE_HASH" != "$PREVIOUS_HASH" ]; then
                info "📦 package-lock.json a changé (hash: ${CURRENT_LOCKFILE_HASH:0:8}...), installation des dépendances nécessaire..."
                NEEDS_INSTALL=true
            else
                info "✅ package-lock.json inchangé (hash: ${CURRENT_LOCKFILE_HASH:0:8}...), pas besoin de réinstaller les dépendances"
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
    
    info "✅ Dépendances npm installées"
else
    info "⏭️  Installation des dépendances ignorée (environnement identique)"
fi

# Sauvegarder le hash pour la prochaine fois (même si on n'a pas installé)
# Cela permet de ne pas réinstaller si le fichier n'a pas changé
if [ ! -z "$CURRENT_LOCKFILE_HASH" ]; then
    echo "$CURRENT_LOCKFILE_HASH" > "$LOCKFILE_HASH_FILE"
    info "✅ Hash du package-lock.json sauvegardé pour la prochaine fois"
fi

# 5.5. 🔧 Vérification et installation des dépendances Python (si nécessaire)
cd "$BACKEND_DIR"

# Activer l'environnement virtuel si il existe
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
    info "✅ Environnement virtuel activé"
elif [ -f "../venv/bin/activate" ]; then
    source ../venv/bin/activate
    info "✅ Environnement virtuel activé (depuis le répertoire parent)"
else
    warn "⚠️  Aucun environnement virtuel trouvé, utilisation de pip3 système"
fi

# Vérifier si requirements.txt a changé depuis le dernier déploiement
REQUIREMENTS_FILE="$BACKEND_DIR/requirements.txt"
REQUIREMENTS_HASH_FILE="$BACKEND_DIR/.requirements.hash"
CURRENT_REQUIREMENTS_HASH=""
NEEDS_PIP_INSTALL=false

if [ -f "$REQUIREMENTS_FILE" ]; then
    # Calculer le hash du requirements.txt actuel
    CURRENT_REQUIREMENTS_HASH=$(md5sum "$REQUIREMENTS_FILE" 2>/dev/null | cut -d' ' -f1 || sha256sum "$REQUIREMENTS_FILE" 2>/dev/null | cut -d' ' -f1 || echo "")
    
    if [ ! -z "$CURRENT_REQUIREMENTS_HASH" ]; then
        # Vérifier si le hash a changé
        if [ -f "$REQUIREMENTS_HASH_FILE" ]; then
            PREVIOUS_REQUIREMENTS_HASH=$(cat "$REQUIREMENTS_HASH_FILE" 2>/dev/null || echo "")
            if [ "$CURRENT_REQUIREMENTS_HASH" != "$PREVIOUS_REQUIREMENTS_HASH" ]; then
                info "📦 requirements.txt a changé (hash: ${CURRENT_REQUIREMENTS_HASH:0:8}...), installation des paquets nécessaire..."
                NEEDS_PIP_INSTALL=true
            else
                info "✅ requirements.txt inchangé (hash: ${CURRENT_REQUIREMENTS_HASH:0:8}...), pas besoin de réinstaller les paquets"
            fi
        else
            # Pas de hash précédent, installation nécessaire
            info "📦 Première installation ou hash manquant, installation des paquets Python..."
            NEEDS_PIP_INSTALL=true
        fi
    else
        warn "Impossible de calculer le hash de requirements.txt, installation par précaution..."
        NEEDS_PIP_INSTALL=true
    fi
else
    warn "requirements.txt introuvable, vérification des paquets..."
    # Vérifier si pip peut lister les paquets installés
    if ! pip list > /dev/null 2>&1; then
        error "Impossible d'accéder à pip, vérification manuelle requise"
        exit 1
    fi
fi

# Installer les paquets seulement si nécessaire
if [ "$NEEDS_PIP_INSTALL" = true ]; then
    info "Installation des paquets Python depuis requirements.txt..."
    
    # Mettre à jour pip d'abord
    pip install --upgrade pip --quiet 2>/dev/null || warn "Impossible de mettre à jour pip"
    
    # Installer les requirements
    pip install -r "$REQUIREMENTS_FILE" || {
        error "Échec de l'installation des paquets Python"
        exit 1
    }
    
    info "✅ Paquets Python installés"
else
    info "⏭️  Installation des paquets Python ignorée (requirements.txt inchangé)"
fi

# Sauvegarder le hash pour la prochaine fois (même si on n'a pas installé)
if [ ! -z "$CURRENT_REQUIREMENTS_HASH" ]; then
    echo "$CURRENT_REQUIREMENTS_HASH" > "$REQUIREMENTS_HASH_FILE"
    info "✅ Hash du requirements.txt sauvegardé pour la prochaine fois"
fi

# 6. 🔧 Build du frontend React
cd "$FRONTEND_DIR"
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

# Sauvegarder l'ancien template (dans un répertoire temporaire, pas dans templates/)
if [ -f "$TEMPLATE_FILE" ]; then
    BACKUP_DIR="$PROJECT_ROOT/.deploy_backups"
    mkdir -p "$BACKUP_DIR"
    info "💾 Sauvegarde du template existant..."
    cp "$TEMPLATE_FILE" "$BACKUP_DIR/index.html.backup.$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true
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
[ ! -f "$TEMPLATE_DIR/favicon.ico" ] && [ -f "$FRONTEND_DIR/public/favicon.ico" ] && \cp -f "$FRONTEND_DIR/public/favicon.ico" "$TEMPLATE_DIR/favicon.ico"
[ ! -f "$TEMPLATE_DIR/favicon.svg" ] && [ -f "$FRONTEND_DIR/public/favicon.svg" ] && \cp -f "$FRONTEND_DIR/public/favicon.svg" "$TEMPLATE_DIR/favicon.svg"
[ ! -f "$TEMPLATE_DIR/logo192.png" ] && [ -f "$FRONTEND_DIR/public/logo192.png" ] && \cp -f "$FRONTEND_DIR/public/logo192.png" "$TEMPLATE_DIR/logo192.png"
[ ! -f "$TEMPLATE_DIR/logo512.png" ] && [ -f "$FRONTEND_DIR/public/logo512.png" ] && \cp -f "$FRONTEND_DIR/public/logo512.png" "$TEMPLATE_DIR/logo512.png"

# Créer les répertoires statiques Django s'ils n'existent pas
info "📁 Création des répertoires statiques Django..."
STATICFILES_DIR="$BACKEND_DIR/staticfiles"
mkdir -p "$STATICFILES_DIR/static/js"
mkdir -p "$STATICFILES_DIR/static/css"
mkdir -p "$STATICFILES_DIR/static/media" 2>/dev/null || true

# Copier les autres fichiers statiques (images, fonts, etc.) avant collectstatic
if [ -d "$FRONTEND_DIR/build/static/media" ]; then
    mkdir -p "$STATICFILES_DIR/static/media"
    cp -r "$FRONTEND_DIR/build/static/media/"* "$STATICFILES_DIR/static/media/" 2>/dev/null || true
    info "✅ Fichiers média copiés"
fi

# Copier robots.txt et autres fichiers racine si présents
if [ -f "$FRONTEND_DIR/build/robots.txt" ]; then
    cp "$FRONTEND_DIR/build/robots.txt" "$STATICFILES_DIR/" 2>/dev/null || true
fi

# Copier le fichier de vérification Google Search Console (s'il existe)
if [ -f "$FRONTEND_DIR/build/google"*.html ]; then
    GOOGLE_VERIFICATION_FILE=$(ls "$FRONTEND_DIR/build/google"*.html 2>/dev/null | head -1)
    if [ ! -z "$GOOGLE_VERIFICATION_FILE" ]; then
        cp "$GOOGLE_VERIFICATION_FILE" "$STATICFILES_DIR/" 2>/dev/null || true
        info "✅ Fichier de vérification Google Search Console copié: $(basename "$GOOGLE_VERIFICATION_FILE")"
    fi
fi

info "✅ Fichiers statiques préparés (JS/CSS seront copiés après collectstatic)"

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

# Créer le répertoire de logs Django AVANT de corriger les permissions
# pour qu'il soit inclus dans le chown -R
LOGS_DIR="$BACKEND_DIR/logs"
if [ ! -d "$LOGS_DIR" ]; then
    info "Création du répertoire de logs Django: $LOGS_DIR"
    mkdir -p "$LOGS_DIR" 2>/dev/null || warn "Impossible de créer le répertoire de logs"
fi

# Utiliser chown avec apache: (sans spécifier le groupe apache explicitement)
# Cela appliquera les permissions à tout le projet, y compris le répertoire de logs
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

# 12b. 📋 Copier les fichiers JS/CSS du build React APRÈS collectstatic
info "📋 Copie des fichiers JS/CSS du build React..."
if [ -d "$FRONTEND_DIR/build/static/js" ]; then
    # Nettoyer les anciens fichiers JS avant de copier les nouveaux
    rm -f "$STATICFILES_DIR/static/js/main."*.js 2>/dev/null || true
    # Copier explicitement le fichier JS détecté
    if [ ! -z "$JS_FILE" ] && [ -f "$FRONTEND_DIR/build/static/js/$JS_FILE" ]; then
        cp -f "$FRONTEND_DIR/build/static/js/$JS_FILE" "$STATICFILES_DIR/static/js/$JS_FILE" 2>/dev/null || true
        info "✅ Fichier JS copié: $JS_FILE"
    else
        # Fallback: copier tous les fichiers JS
        cp -f "$FRONTEND_DIR/build/static/js/"* "$STATICFILES_DIR/static/js/" 2>/dev/null || true
        info "✅ Fichiers JS copiés"
    fi
fi

if [ -d "$FRONTEND_DIR/build/static/css" ]; then
    # Nettoyer les anciens fichiers CSS avant de copier les nouveaux
    rm -f "$STATICFILES_DIR/static/css/main."*.css 2>/dev/null || true
    # Copier explicitement le fichier CSS détecté
    if [ ! -z "$CSS_FILE" ] && [ -f "$FRONTEND_DIR/build/static/css/$CSS_FILE" ]; then
        cp -f "$FRONTEND_DIR/build/static/css/$CSS_FILE" "$STATICFILES_DIR/static/css/$CSS_FILE" 2>/dev/null || true
        info "✅ Fichier CSS copié: $CSS_FILE"
    else
        # Fallback: copier tous les fichiers CSS
        cp -f "$FRONTEND_DIR/build/static/css/"* "$STATICFILES_DIR/static/css/" 2>/dev/null || true
        info "✅ Fichiers CSS copiés"
    fi
fi

info "✅ Fichiers statiques synchronisés"

# 13. 🔄 Redémarrage d'Apache
info "Redémarrage d'Apache..."
if systemctl restart httpd 2>/dev/null || systemctl restart apache2 2>/dev/null; then
    info "✅ Apache redémarré"
else
    warn "Impossible de redémarrer Apache (peut nécessiter sudo)"
    warn "Veuillez exécuter manuellement: sudo systemctl restart httpd"
fi

# 13.5. 🔧 Installation et configuration du service systemd Daphne
info "Vérification du service systemd Daphne..."

# Vérifier si le service existe déjà
if [ -f "/etc/systemd/system/trading-journal-daphne.service" ]; then
    info "✅ Service systemd Daphne existe déjà, aucune modification nécessaire"
    info "ℹ️  Le service existant sera conservé tel quel"
    
    # Vérifier seulement le statut du service existant
    if sudo systemctl is-active --quiet trading-journal-daphne.service 2>/dev/null; then
        info "✅ Service Daphne est actif"
    else
        warn "⚠️  Service Daphne n'est pas actif, vérifiez les logs:"
        warn "   sudo journalctl -u trading-journal-daphne.service -n 50"
        warn "   sudo tail -f /var/log/trading-journal/daphne_error.log"
    fi
else
    # Le service n'existe pas, on peut le créer
    info "Service systemd Daphne non trouvé, installation..."
    
    # Vérifier si le fichier de service existe dans le dépôt
    SERVICE_FILE="$PROJECT_ROOT/systemd/trading-journal-daphne.service"
    if [ -f "$SERVICE_FILE" ]; then
        info "Copie du fichier de service systemd..."
        if sudo cp "$SERVICE_FILE" /etc/systemd/system/ 2>/dev/null; then
            info "✅ Fichier de service copié"
        else
            warn "Impossible de copier le fichier de service (peut nécessiter sudo)"
            warn "Veuillez exécuter manuellement: sudo cp $SERVICE_FILE /etc/systemd/system/"
        fi
    else
        warn "Fichier de service non trouvé: $SERVICE_FILE"
        warn "Le service systemd ne sera pas configuré automatiquement"
    fi
    
    # Vérifier et configurer le script de démarrage Daphne
    DAPHNE_SCRIPT="$BACKEND_DIR/start-daphne.sh"
    if [ -f "$DAPHNE_SCRIPT" ]; then
        info "Configuration du script de démarrage Daphne..."
        if sudo chmod +x "$DAPHNE_SCRIPT" 2>/dev/null; then
            info "✅ Script de démarrage rendu exécutable"
        else
            warn "Impossible de rendre le script exécutable (peut nécessiter sudo)"
        fi
        
        if sudo chown apache:apache "$DAPHNE_SCRIPT" 2>/dev/null; then
            info "✅ Propriétaire du script configuré (apache:apache)"
        else
            warn "Impossible de changer le propriétaire du script (peut nécessiter sudo)"
        fi
    else
        warn "Script de démarrage Daphne non trouvé: $DAPHNE_SCRIPT"
        warn "Le service systemd ne pourra pas démarrer sans ce script"
    fi
    
    # Créer le répertoire de logs si nécessaire
    LOG_DIR="/var/log/trading-journal"
    if [ ! -d "$LOG_DIR" ]; then
        info "Création du répertoire de logs: $LOG_DIR"
        if sudo mkdir -p "$LOG_DIR" 2>/dev/null; then
            info "✅ Répertoire de logs créé"
        else
            warn "Impossible de créer le répertoire de logs (peut nécessiter sudo)"
        fi
    fi
    
    # Configurer les permissions du répertoire de logs
    if [ -d "$LOG_DIR" ]; then
        if sudo chown apache:apache "$LOG_DIR" 2>/dev/null; then
            info "✅ Propriétaire du répertoire de logs configuré (apache:apache)"
        else
            warn "Impossible de changer le propriétaire du répertoire de logs (peut nécessiter sudo)"
        fi
    fi
    
    # Recharger systemd et activer/démarrer le service
    if [ -f "/etc/systemd/system/trading-journal-daphne.service" ]; then
        info "Configuration du service systemd..."
        
        if sudo systemctl daemon-reload 2>/dev/null; then
            info "✅ Configuration systemd rechargée"
        else
            warn "Impossible de recharger systemd (peut nécessiter sudo)"
        fi
        
        if sudo systemctl enable trading-journal-daphne.service 2>/dev/null; then
            info "✅ Service systemd activé"
        else
            warn "Impossible d'activer le service (peut nécessiter sudo)"
        fi
        
        if sudo systemctl start trading-journal-daphne.service 2>/dev/null; then
            info "✅ Service Daphne démarré"
        else
            warn "Impossible de démarrer le service (peut nécessiter sudo)"
            warn "Veuillez exécuter manuellement: sudo systemctl start trading-journal-daphne.service"
        fi
        
        # Vérifier le statut du service
        if sudo systemctl is-active --quiet trading-journal-daphne.service 2>/dev/null; then
            info "✅ Service Daphne est actif"
        else
            warn "⚠️  Service Daphne n'est pas actif, vérifiez les logs:"
            warn "   sudo journalctl -u trading-journal-daphne.service -n 50"
            warn "   sudo tail -f /var/log/trading-journal/daphne_error.log"
        fi
    fi
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

# Vérifier le service Daphne
if sudo systemctl is-active --quiet trading-journal-daphne.service 2>/dev/null; then
    info "✅ Service Daphne est actif"
else
    warn "⚠️  Service Daphne n'est pas actif (vérifiez les logs si nécessaire)"
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
Daphne: $(sudo systemctl is-active trading-journal-daphne.service 2>/dev/null || echo "inactif")
Build: $([ -f "$FRONTEND_DIR/build/index.html" ] && echo "OK" || echo "ERREUR")
Template: $([ -f "$BACKEND_DIR/trading_journal_api/templates/index.html" ] && echo "OK" || echo "ERREUR")
EOF

# Afficher le résumé
echo "🌐 Application accessible à : ${FRONTEND_URL}"
echo "📚 API accessible à : ${API_URL}/"
echo "🔧 Admin Django : ${ADMIN_URL}/"
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
    echo "🎉 Nouvelle release déployée avec succès !"
    if [ ! -z "$DEPLOY_TAG" ]; then
        echo "🏷️  Version déployée: $DEPLOY_TAG"
    else
        # Fallback: essayer de détecter le tag si DEPLOY_TAG n'est pas défini
        CURRENT_TAG=$(git describe --tags --exact-match HEAD 2>/dev/null || git tag --sort=-version:refname 2>/dev/null | head -1 || echo "")
        if [ ! -z "$CURRENT_TAG" ]; then
            echo "🏷️  Version déployée: $CURRENT_TAG"
        fi
    fi
else
    echo "✅ Déploiement terminé (code déjà à jour)"
    if [ ! -z "$DEPLOY_TAG" ]; then
        echo "🏷️  Version déployée: $DEPLOY_TAG"
    fi
fi

# 16. 🧹 Nettoyage final : nettoyage des fichiers temporaires
info "Nettoyage final des fichiers temporaires..."

# Marquer index.html comme "assume-unchanged" pour ignorer les modifications dans Git
# (le fichier doit rester modifié avec les nouveaux hash JS/CSS pour le serveur)
if [ -f "$TEMPLATE_FILE" ]; then
    info "🔇 Ignorer les modifications de $TEMPLATE_FILE dans Git (assume-unchanged)..."
    git update-index --assume-unchanged "$TEMPLATE_FILE" 2>/dev/null || warn "Impossible de marquer $TEMPLATE_FILE comme assume-unchanged"
fi

# Nettoyage des fichiers de backup créés par le script
info "🧹 Nettoyage des fichiers de backup..."
BACKUP_DIR="$PROJECT_ROOT/.deploy_backups"
if [ -d "$BACKUP_DIR" ]; then
    find "$BACKUP_DIR" -name "*.backup.*" -type f -mtime +7 -delete 2>/dev/null || true
    # Garder seulement les 5 derniers backups
    ls -t "$BACKUP_DIR"/*.backup.* 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
fi
# Nettoyage des anciens backups dans templates/ (ancienne méthode)
find "$TEMPLATE_DIR" -name "*.backup.*" -type f -mtime +7 -delete 2>/dev/null || true

# Note : Les permissions modifiées (chmod) ne sont pas restaurées car elles sont nécessaires
# pour le fonctionnement du serveur. Elles ne sont pas suivies par Git de toute façon.

info "✅ Nettoyage final terminé"

echo ""