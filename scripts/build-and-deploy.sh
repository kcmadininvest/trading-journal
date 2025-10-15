#!/bin/bash

# Script de build et déploiement optimisé pour Trading Journal
# Usage: ./scripts/build-and-deploy.sh [production-server]

set -e

PROD_SERVER=${1:-"user@your-server"}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
IMAGE_NAME="trading-journal"
IMAGE_TAG="${IMAGE_NAME}:${TIMESTAMP}"
IMAGE_LATEST="${IMAGE_NAME}:latest"
ARCHIVE_NAME="${IMAGE_NAME}-${TIMESTAMP}.tar.gz"

echo "🚀 Build et Déploiement de Trading Journal"
echo "=========================================="
echo "Serveur de production: $PROD_SERVER"
echo "Tag de l'image: $IMAGE_TAG"
echo ""

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Erreur: Ce script doit être exécuté depuis la racine du projet"
    exit 1
fi

echo "📦 Étape 1: Build de l'image Docker"
echo "-----------------------------------"

# Construire l'image
echo "Construction de l'image $IMAGE_TAG..."
docker build -t $IMAGE_TAG .

# Tagger comme latest
docker tag $IMAGE_TAG $IMAGE_LATEST

echo "✅ Image construite avec succès"

echo ""
echo "🧪 Étape 2: Test de l'image"
echo "---------------------------"

# Tester l'image localement
echo "Test de l'image en local..."
docker run -d --name trading-journal-test -p 8001:8000 $IMAGE_LATEST

# Attendre que l'application démarre
echo "Attente du démarrage de l'application..."
sleep 10

# Tester l'endpoint de santé
if curl -f http://localhost:8001/api/trades/health/ > /dev/null 2>&1; then
    echo "✅ Test réussi - l'application répond correctement"
else
    echo "❌ Test échoué - l'application ne répond pas"
    docker logs trading-journal-test
    docker stop trading-journal-test && docker rm trading-journal-test
    exit 1
fi

# Nettoyer le test
docker stop trading-journal-test && docker rm trading-journal-test

echo ""
echo "💾 Étape 3: Export de l'image"
echo "-----------------------------"

# Sauvegarder l'image
echo "Export de l'image vers $ARCHIVE_NAME..."
docker save $IMAGE_LATEST | gzip > $ARCHIVE_NAME

# Vérifier la taille de l'archive
ARCHIVE_SIZE=$(du -h $ARCHIVE_NAME | cut -f1)
echo "✅ Image exportée: $ARCHIVE_NAME ($ARCHIVE_SIZE)"

echo ""
echo "📤 Étape 4: Transfert vers la production"
echo "----------------------------------------"

# Transférer l'image vers le serveur de production
echo "Transfert de l'image vers $PROD_SERVER..."
scp $ARCHIVE_NAME $PROD_SERVER:/tmp/

echo "✅ Image transférée avec succès"

echo ""
echo "🚀 Étape 5: Déploiement sur la production"
echo "-----------------------------------------"

# Script de déploiement sur le serveur de production
cat > /tmp/deploy-on-server.sh << 'EOF'
#!/bin/bash
set -e

ARCHIVE_NAME=$1
IMAGE_NAME="trading-journal"
IMAGE_LATEST="${IMAGE_NAME}:latest"
APP_DIR="/opt/trading_journal"

echo "📁 Création du répertoire de l'application..."
sudo mkdir -p $APP_DIR/{data,logs,config,backups}
sudo chown -R $USER:$USER $APP_DIR
sudo chmod -R 755 $APP_DIR

# Déplacer les fichiers de configuration
if [ -f /tmp/trading-journal.env ]; then
    cp /tmp/trading-journal.env $APP_DIR/config/.env
    echo "✅ Fichier .env copié vers $APP_DIR/config/"
fi

echo "📥 Chargement de l'image Docker..."
docker load < /tmp/$ARCHIVE_NAME

echo "🔄 Mise à jour de l'application..."
# Arrêter l'ancienne version si elle existe
docker stop trading-journal 2>/dev/null || true
docker rm trading-journal 2>/dev/null || true

# Démarrer la nouvelle version avec volumes
docker run -d \
  --name trading-journal \
  --env-file $APP_DIR/config/.env \
  -p 8000:8000 \
  -v $APP_DIR/data:/app/data \
  -v $APP_DIR/logs:/app/logs \
  -v $APP_DIR/backups:/app/backups \
  --restart unless-stopped \
  $IMAGE_LATEST

echo "⏳ Attente du démarrage..."
sleep 10

echo "🔧 Application des migrations..."
docker exec trading-journal python manage.py migrate

echo "🧪 Test de l'application..."
if curl -f http://localhost:8000/api/trades/health/ > /dev/null 2>&1; then
    echo "✅ Déploiement réussi!"
    echo "🌐 Application accessible sur: http://your-domain.com"
else
    echo "❌ Problème lors du déploiement"
    docker logs trading-journal
    exit 1
fi

echo "🧹 Nettoyage..."
rm -f /tmp/$ARCHIVE_NAME

echo "🎉 Déploiement terminé avec succès!"
EOF

# Transférer et exécuter le script de déploiement
scp /tmp/deploy-on-server.sh $PROD_SERVER:/tmp/
ssh $PROD_SERVER "chmod +x /tmp/deploy-on-server.sh && /tmp/deploy-on-server.sh $ARCHIVE_NAME"

echo ""
echo "🎉 Déploiement terminé avec succès!"
echo "=================================="
echo ""
echo "📋 Informations:"
echo "   Image: $IMAGE_TAG"
echo "   Archive: $ARCHIVE_NAME ($ARCHIVE_SIZE)"
echo "   Serveur: $PROD_SERVER"
echo ""
echo "🔧 Commandes utiles:"
echo "   Voir les logs: ssh $PROD_SERVER 'docker logs -f trading-journal'"
echo "   Redémarrer: ssh $PROD_SERVER 'docker restart trading-journal'"
echo "   Statut: ssh $PROD_SERVER 'docker ps | grep trading-journal'"
echo ""
echo "🧹 Nettoyage local..."
rm -f $ARCHIVE_NAME /tmp/deploy-on-server.sh

echo "✅ Nettoyage terminé"
