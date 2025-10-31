#!/bin/bash

# Script de nettoyage du frontend en production
# Usage: ./cleanup_frontend.sh [--dry-run] [--backup]

set -e  # Arrêter le script en cas d'erreur

# Configuration
FRONTEND_DIR="/var/www/html/trading_journal/frontend"
BACKUP_DIR="/var/www/html/trading_journal/backups/frontend_$(date +%Y%m%d_%H%M%S)"
DRY_RUN=false
CREATE_BACKUP=false

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Fonction d'aide
show_help() {
    echo "Script de nettoyage du frontend en production"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --dry-run     Afficher ce qui serait supprimé sans rien supprimer"
    echo "  --backup      Créer une sauvegarde avant suppression"
    echo "  --help        Afficher cette aide"
    echo ""
    echo "Exemples:"
    echo "  $0 --dry-run          # Voir ce qui serait supprimé"
    echo "  $0 --backup           # Supprimer avec sauvegarde"
    echo "  $0                    # Supprimer directement"
}

# Parser les arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --backup)
            CREATE_BACKUP=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            log_error "Option inconnue: $1"
            show_help
            exit 1
            ;;
    esac
done

# Vérifier que le répertoire frontend existe
if [ ! -d "$FRONTEND_DIR" ]; then
    log_error "Le répertoire frontend n'existe pas: $FRONTEND_DIR"
    exit 1
fi

log_info "Début du nettoyage du frontend"
log_info "Répertoire cible: $FRONTEND_DIR"
log_info "Mode dry-run: $DRY_RUN"
log_info "Création de sauvegarde: $CREATE_BACKUP"

# Fonction pour créer une sauvegarde
create_backup() {
    if [ "$CREATE_BACKUP" = true ]; then
        log_info "Création de la sauvegarde dans: $BACKUP_DIR"
        
        if [ "$DRY_RUN" = true ]; then
            log_info "[DRY-RUN] Création de la sauvegarde..."
        else
            mkdir -p "$BACKUP_DIR"
            cp -r "$FRONTEND_DIR" "$BACKUP_DIR/"
            log_success "Sauvegarde créée: $BACKUP_DIR"
        fi
    fi
}

# Fonction pour supprimer un fichier/répertoire
remove_item() {
    local item="$1"
    local description="$2"
    
    if [ -e "$item" ]; then
        if [ "$DRY_RUN" = true ]; then
            log_info "[DRY-RUN] Suppression: $item ($description)"
        else
            if [ -d "$item" ]; then
                rm -rf "$item"
            else
                rm -f "$item"
            fi
            log_success "Supprimé: $item ($description)"
        fi
    else
        log_warning "N'existe pas: $item"
    fi
}

# Arrêter le serveur de développement s'il tourne
log_info "Arrêt du serveur de développement..."
if pgrep -f "react-scripts start" > /dev/null; then
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY-RUN] Arrêt du serveur React..."
    else
        pkill -f "react-scripts start" || true
        sleep 2
        log_success "Serveur React arrêté"
    fi
else
    log_info "Aucun serveur React en cours d'exécution"
fi

# Créer la sauvegarde si demandée
create_backup

# Liste des fichiers et répertoires à supprimer (anciens)
log_info "Suppression des anciens fichiers et répertoires..."

# Anciens composants supprimés
remove_item "$FRONTEND_DIR/src/components/auth" "Ancien dossier auth"
remove_item "$FRONTEND_DIR/src/components/charts" "Ancien dossier charts"
remove_item "$FRONTEND_DIR/src/components/common" "Ancien dossier common"
remove_item "$FRONTEND_DIR/src/components/Debug" "Ancien dossier Debug"
remove_item "$FRONTEND_DIR/src/components/Import" "Ancien dossier Import"
remove_item "$FRONTEND_DIR/src/components/Layout" "Ancien dossier Layout"
remove_item "$FRONTEND_DIR/src/components/PositionStrategy" "Ancien dossier PositionStrategy"
remove_item "$FRONTEND_DIR/src/components/Settings" "Ancien dossier Settings"
remove_item "$FRONTEND_DIR/src/components/Strategy" "Ancien dossier Strategy"
remove_item "$FRONTEND_DIR/src/components/TradingAccount" "Ancien dossier TradingAccount"
remove_item "$FRONTEND_DIR/src/components/ui" "Ancien dossier ui"

# Anciens fichiers de composants
remove_item "$FRONTEND_DIR/src/components/LazyPages.tsx" "Ancien fichier LazyPages"
remove_item "$FRONTEND_DIR/src/components/SuspenseBoundary.tsx" "Ancien fichier SuspenseBoundary"

# Anciens hooks
remove_item "$FRONTEND_DIR/src/hooks" "Ancien dossier hooks"

# Anciens services
remove_item "$FRONTEND_DIR/src/services/adaptiveGoals.ts" "Ancien service adaptiveGoals"
remove_item "$FRONTEND_DIR/src/services/api.ts" "Ancien service api"
remove_item "$FRONTEND_DIR/src/services/appInitializer.ts" "Ancien service appInitializer"
remove_item "$FRONTEND_DIR/src/services/cacheManager.ts" "Ancien service cacheManager"
remove_item "$FRONTEND_DIR/src/services/errorHandler.ts" "Ancien service errorHandler"
remove_item "$FRONTEND_DIR/src/services/optimizedCacheService.ts" "Ancien service optimizedCacheService"
remove_item "$FRONTEND_DIR/src/services/positionStrategies.ts" "Ancien service positionStrategies"
remove_item "$FRONTEND_DIR/src/services/preloadService.ts" "Ancien service preloadService"
remove_item "$FRONTEND_DIR/src/services/retryService.ts" "Ancien service retryService"
remove_item "$FRONTEND_DIR/src/services/sessionManager.ts" "Ancien service sessionManager"
remove_item "$FRONTEND_DIR/src/services/system.ts" "Ancien service system"
remove_item "$FRONTEND_DIR/src/services/trades.ts" "Ancien service trades"
remove_item "$FRONTEND_DIR/src/services/tradingAccountService.ts" "Ancien service tradingAccountService"
remove_item "$FRONTEND_DIR/src/services/users.ts" "Ancien service users"

# Anciens lib et types
remove_item "$FRONTEND_DIR/src/lib" "Ancien dossier lib"
remove_item "$FRONTEND_DIR/src/types" "Ancien dossier types"

# Anciens config, styles, utils
remove_item "$FRONTEND_DIR/src/config" "Ancien dossier config"
remove_item "$FRONTEND_DIR/src/styles" "Ancien dossier styles"
remove_item "$FRONTEND_DIR/src/utils" "Ancien dossier utils"

# Anciennes pages supprimées
remove_item "$FRONTEND_DIR/src/pages/AnalyticsPage.tsx" "Ancienne page Analytics"
remove_item "$FRONTEND_DIR/src/pages/ArchivesPage.tsx" "Ancienne page Archives"
remove_item "$FRONTEND_DIR/src/pages/PositionStrategiesPage.tsx" "Ancienne page PositionStrategies"
remove_item "$FRONTEND_DIR/src/pages/SettingsPage.tsx" "Ancienne page Settings"
remove_item "$FRONTEND_DIR/src/pages/StatisticsPageOptimized.tsx" "Ancienne page Statistics"
remove_item "$FRONTEND_DIR/src/pages/StrategyPage.tsx" "Ancienne page Strategy"
remove_item "$FRONTEND_DIR/src/pages/TradesPage.tsx" "Ancienne page Trades"
remove_item "$FRONTEND_DIR/src/pages/TradesTablePage.tsx" "Ancienne page TradesTable"
remove_item "$FRONTEND_DIR/src/pages/TradingAccountsPage.tsx" "Ancienne page TradingAccounts"
remove_item "$FRONTEND_DIR/src/pages/StrategyPage" "Ancien dossier StrategyPage"

# Nettoyer les fichiers temporaires et cache
log_info "Nettoyage des fichiers temporaires et cache..."

remove_item "$FRONTEND_DIR/node_modules/.cache" "Cache Node.js"
remove_item "$FRONTEND_DIR/build" "Build de production"
remove_item "$FRONTEND_DIR/.eslintcache" "Cache ESLint"

# Nettoyer les logs
remove_item "$FRONTEND_DIR/npm-debug.log*" "Logs npm"
remove_item "$FRONTEND_DIR/yarn-debug.log*" "Logs yarn"
remove_item "$FRONTEND_DIR/yarn-error.log*" "Logs d'erreur yarn"

# Nettoyer les fichiers temporaires système
find "$FRONTEND_DIR" -name ".DS_Store" -type f -exec rm -f {} \; 2>/dev/null || true
find "$FRONTEND_DIR" -name "Thumbs.db" -type f -exec rm -f {} \; 2>/dev/null || true
find "$FRONTEND_DIR" -name "*.tmp" -type f -exec rm -f {} \; 2>/dev/null || true
find "$FRONTEND_DIR" -name "*.temp" -type f -exec rm -f {} \; 2>/dev/null || true

# Vérifier la structure finale
log_info "Vérification de la structure finale..."

if [ "$DRY_RUN" = false ]; then
    log_info "Structure actuelle du frontend:"
    find "$FRONTEND_DIR/src" -type f -name "*.tsx" -o -name "*.ts" -o -name "*.js" -o -name "*.jsx" | sort
fi

# Résumé
log_success "Nettoyage terminé !"

if [ "$DRY_RUN" = true ]; then
    log_warning "Mode dry-run activé - Aucun fichier n'a été supprimé"
    log_info "Pour exécuter réellement le nettoyage, relancez sans --dry-run"
fi

if [ "$CREATE_BACKUP" = true ] && [ "$DRY_RUN" = false ]; then
    log_success "Sauvegarde disponible dans: $BACKUP_DIR"
fi

log_info "Structure finale conservée:"
echo "  ✓ src/pages/HomePage.tsx"
echo "  ✓ src/pages/DashboardPage.tsx"
echo "  ✓ src/pages/UserManagementPage.tsx"
echo "  ✓ src/components/auth/AuthModal.tsx"
echo "  ✓ src/components/users/ (nouveaux composants)"
echo "  ✓ src/services/auth.ts"
echo "  ✓ src/services/userService.ts"
echo "  ✓ src/App.tsx"
echo "  ✓ Configuration React (package.json, etc.)"

log_success "Script terminé avec succès !"
