#!/bin/bash

# Script de démarrage pour Trading Journal
# Usage: ./start.sh [development|production]

set -e

ENVIRONMENT=${1:-development}
APP_DIR="/opt/trading_journal"

echo "🚀 Démarrage de Trading Journal"
echo "==============================="
echo "Environnement: $ENVIRONMENT"
echo ""

# Vérifications spécifiques pour la production
if [ "$ENVIRONMENT" = "production" ]; then
    # Vérifier que le répertoire de production existe
    if [ ! -d "$APP_DIR" ]; then
        echo "❌ Répertoire $APP_DIR non trouvé"
        echo "💡 Créez le répertoire avec: sudo mkdir -p $APP_DIR/{data,logs,config,backups}"
        echo "💡 Puis: sudo chown -R $USER:$USER $APP_DIR"
        exit 1
    fi
    
    # Vérifier que le fichier .env existe
    if [ ! -f "$APP_DIR/config/.env" ]; then
        echo "❌ Fichier $APP_DIR/config/.env non trouvé"
        echo "💡 Copiez votre fichier .env vers $APP_DIR/config/.env"
        exit 1
    fi
    
    echo "📁 Répertoire de l'application: $APP_DIR"
fi

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Erreur: Ce script doit être exécuté depuis la racine du projet"
    exit 1
fi

if [ "$ENVIRONMENT" = "production" ]; then
    echo "🏭 Démarrage en mode PRODUCTION"
    COMPOSE_FILE="docker-compose.yml"
else
    echo "🔧 Démarrage en mode DÉVELOPPEMENT"
    COMPOSE_FILE="docker-compose.yml"
fi

# Vérifier que Docker est installé
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé"
    exit 1
fi

# Vérifier que Docker Compose est installé
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose n'est pas installé"
    exit 1
fi

# Vérifier que le fichier .env existe
if [ ! -f .env ]; then
    echo "⚠️  Fichier .env manquant"
    if [ -f "env.production.example" ]; then
        echo "💡 Copiez env.production.example vers .env et configurez-le"
        echo "   cp env.production.example .env"
        echo "   nano .env"
    fi
    exit 1
fi

echo "✅ Prérequis vérifiés"

# Arrêter les services existants
echo "🛑 Arrêt des services existants..."
docker-compose -f $COMPOSE_FILE down 2>/dev/null || true

# Construire et démarrer les services
echo "🏗️ Construction et démarrage des services..."
docker-compose -f $COMPOSE_FILE up -d --build

# Attendre que les services démarrent
echo "⏳ Attente du démarrage des services..."
sleep 15

# Vérifier l'état des services
echo "🔍 Vérification de l'état des services..."
docker-compose -f $COMPOSE_FILE ps

# Afficher les logs
echo ""
echo "📊 Logs des services:"
echo "===================="
docker-compose -f $COMPOSE_FILE logs --tail=10

echo ""
echo "🎉 Trading Journal démarré avec succès!"
echo ""
echo "📋 Informations de connexion:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:8000/api/"
echo "   Admin Django: http://localhost:8000/admin/"
echo ""
echo "📝 Commandes utiles:"
echo "   Voir les logs: docker-compose -f $COMPOSE_FILE logs -f"
echo "   Arrêter: docker-compose -f $COMPOSE_FILE down"
echo "   Redémarrer: docker-compose -f $COMPOSE_FILE restart"
echo "   Statut: docker-compose -f $COMPOSE_FILE ps"
