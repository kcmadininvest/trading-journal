#!/bin/bash

# 🚀 Script de déploiement Trading Journal
# Ce script applique automatiquement toutes les corrections de production

set -e  # Arrêter en cas d'erreur

echo "🚀 Début du déploiement Trading Journal..."

# Variables
PROJECT_ROOT="/var/www/html/trading_journal"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
BACKEND_DIR="$PROJECT_ROOT/backend"
APACHE_CONFIG="/etc/httpd/conf.d/trading-journal.conf"

# 1. 🔧 Compilation du frontend React
echo "📦 Compilation du frontend React..."
cd "$FRONTEND_DIR"
npm run build

# 2. 🔄 Synchronisation des templates Django
echo "🔄 Synchronisation des templates Django..."
cp "$FRONTEND_DIR/build/index.html" "$BACKEND_DIR/trading_journal_api/templates/index.html"
cp "$FRONTEND_DIR/build/manifest.json" "$BACKEND_DIR/trading_journal_api/templates/manifest.json"
cp "$FRONTEND_DIR/build/favicon.ico" "$BACKEND_DIR/trading_journal_api/templates/favicon.ico"

# 3. 🔐 Vérification de la configuration WSGI
echo "🔍 Vérification de la configuration WSGI..."
WSGI_FILE="$BACKEND_DIR/trading_journal_api/wsgi.py"
if grep -q "trading_journal_api.settings" "$WSGI_FILE"; then
    echo "✅ Configuration WSGI correcte"
else
    echo "❌ Correction de la configuration WSGI..."
    sed -i "s/trading_journal.settings/trading_journal_api.settings/g" "$WSGI_FILE"
fi

# 4. 🌐 Mise à jour de la configuration Apache
echo "🌐 Mise à jour de la configuration Apache..."
if [ -f "$APACHE_CONFIG" ]; then
    echo "✅ Configuration Apache trouvée"
else
    echo "📋 Copie de la configuration Apache..."
    cp "$PROJECT_ROOT/apache/trading-journal.conf" "$APACHE_CONFIG"
fi

# 5. 👤 Correction des permissions
echo "👤 Correction des permissions..."
chown -R apache:apache "$PROJECT_ROOT"

# 6. 🔄 Redémarrage d'Apache
echo "🔄 Redémarrage d'Apache..."
systemctl reload httpd

# 7. 🧹 Nettoyage des migrations Django (si nécessaire)
echo "🧹 Vérification des migrations Django..."
cd "$BACKEND_DIR"
python manage.py makemigrations --dry-run > /dev/null 2>&1 || echo "⚠️  Migrations à appliquer"
python manage.py migrate --noinput

# 8. 📊 Collecte des fichiers statiques
echo "📊 Collecte des fichiers statiques..."
python manage.py collectstatic --noinput

echo "✅ Déploiement terminé avec succès !"
echo "🌐 Application accessible à : https://app.kcmadininvest.fr"
echo "📚 API accessible à : https://app.kcmadininvest.fr/api/"
echo "🔧 Admin Django : https://app.kcmadininvest.fr/admin/"

# 9. 🔍 Vérification finale
echo "🔍 Vérification finale..."
if systemctl is-active --quiet httpd; then
    echo "✅ Apache est actif"
else
    echo "❌ Problème avec Apache"
    exit 1
fi

if [ -f "$FRONTEND_DIR/build/index.html" ]; then
    echo "✅ Frontend compilé"
else
    echo "❌ Frontend non compilé"
    exit 1
fi

echo "🎉 Déploiement réussi ! Toutes les corrections de production sont appliquées."
