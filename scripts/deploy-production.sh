#!/bin/bash
set -e

# Script de déploiement en production pour Trading Journal
# Usage: ./scripts/deploy-production.sh

echo "🚀 Déploiement de Trading Journal en Production"
echo "=============================================="

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Erreur: Ce script doit être exécuté depuis la racine du projet"
    exit 1
fi

# Vérifier que le fichier .env existe
if [ ! -f ".env" ]; then
    echo "❌ Erreur: Fichier .env non trouvé"
    echo "💡 Copiez env.production.example vers .env et configurez-le"
    exit 1
fi

# Vérifier que postgres17 est en cours d'exécution
if ! docker ps --format '{{.Names}}' | grep -q "postgres17"; then
    echo "❌ Erreur: Le conteneur postgres17 n'est pas en cours d'exécution"
    echo "💡 Démarrez-le avec: docker start postgres17"
    exit 1
fi

echo "✅ Conteneur postgres17 est en cours d'exécution"

# Créer la base de données si elle n'existe pas
echo "🔧 Configuration de la base de données..."
docker exec postgres17 psql -U postgres -c "CREATE DATABASE trading_journal_prod;" 2>/dev/null || echo "Base de données 'trading_journal_prod' existe déjà"

# Construire l'image Docker
echo "🏗️ Construction de l'image Docker..."
docker build -t trading-journal:$(date +%Y%m%d_%H%M%S) .
docker tag trading-journal:$(date +%Y%m%d_%H%M%S) trading-journal:latest

# Nettoyer les images timestampées
docker rmi trading-journal:$(date +%Y%m%d_%H%M%S) 2>/dev/null || true

# Tester l'image localement
echo "🧪 Test de l'image localement..."
docker rm -f trading-journal-test 2>/dev/null || true
docker run -d --name trading-journal-test --env-file .env -p 8001:8000 trading-journal:latest

# Attendre que l'application démarre
echo "⏳ Attente du démarrage de l'application..."
sleep 10

# Vérifier que l'application répond
if curl -f http://localhost:8001/api/trades/health/ > /dev/null 2>&1; then
    echo "✅ Application testée avec succès"
else
    echo "❌ Erreur: L'application ne répond pas"
    echo "📋 Logs du conteneur de test:"
    docker logs trading-journal-test
    docker stop trading-journal-test
    docker rm trading-journal-test
    exit 1
fi

# Arrêter le conteneur de test
docker stop trading-journal-test
docker rm trading-journal-test

# Sauvegarder l'image
echo "💾 Sauvegarde de l'image..."
docker save trading-journal:latest > trading-journal-$(date +%Y%m%d_%H%M%S).tar

echo "🎉 Image Docker construite et testée avec succès !"
echo ""
echo "📋 Prochaines étapes :"
echo "1. Transférer l'image vers le serveur de production"
echo "2. Copier docker-compose.yml et .env vers /opt/trading_journal/"
echo "3. Démarrer l'application avec: docker-compose up -d"
echo ""
echo "📁 Fichiers générés :"
echo "   - trading-journal-$(date +%Y%m%d_%H%M%S).tar"
echo "   - docker-compose.yml (mis à jour)"
echo "   - .env (configuré)"
