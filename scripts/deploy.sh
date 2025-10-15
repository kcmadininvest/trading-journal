#!/bin/bash

# Script de déploiement pour Trading Journal
# Usage: ./scripts/deploy.sh [production|development]

set -e

ENVIRONMENT=${1:-production}
COMPOSE_FILE="docker-compose.yml"

if [ "$ENVIRONMENT" = "production" ]; then
    COMPOSE_FILE="docker-compose.yml"
    echo "🚀 Déploiement en PRODUCTION"
else
    echo "🔧 Déploiement en DÉVELOPPEMENT"
fi

echo "📋 Vérification des prérequis..."

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
    echo "❌ Fichier .env manquant"
    echo "💡 Copiez env.production.example vers .env et configurez-le"
    exit 1
fi

echo "✅ Prérequis vérifiés"

echo "🛑 Arrêt des services existants..."
docker-compose -f $COMPOSE_FILE down

echo "🏗️ Construction des images..."
docker-compose -f $COMPOSE_FILE build --no-cache

echo "🚀 Démarrage des services..."
docker-compose -f $COMPOSE_FILE up -d

echo "⏳ Attente du démarrage des services..."
sleep 30

echo "🔍 Vérification de l'état des services..."
docker-compose -f $COMPOSE_FILE ps

echo "📊 Vérification des logs..."
echo "Backend logs:"
docker-compose -f $COMPOSE_FILE logs --tail=10 backend

echo "Frontend logs:"
docker-compose -f $COMPOSE_FILE logs --tail=10 frontend

echo "🗄️ Vérification de la base de données PostgreSQL existante..."
# Vérifier que le conteneur postgres17 est accessible
if docker exec postgres17 pg_isready -U postgres > /dev/null 2>&1; then
    echo "✅ Base de données PostgreSQL accessible"
else
    echo "❌ Base de données PostgreSQL non accessible"
    echo "💡 Vérifiez que le conteneur postgres17 est démarré"
fi

echo "🔧 Application des migrations..."
docker-compose -f $COMPOSE_FILE exec backend python manage.py migrate

echo "📁 Collecte des fichiers statiques..."
docker-compose -f $COMPOSE_FILE exec backend python manage.py collectstatic --noinput

echo "👤 Création du superutilisateur (si nécessaire)..."
if [ -n "$DJANGO_SUPERUSER_USERNAME" ]; then
    docker-compose -f $COMPOSE_FILE exec backend python manage.py createsuperuser \
        --noinput \
        --username $DJANGO_SUPERUSER_USERNAME \
        --email $DJANGO_SUPERUSER_EMAIL || echo "Superutilisateur existe déjà"
fi

echo "🧪 Test de l'API..."
if curl -f http://localhost:8000/api/trades/health/ > /dev/null 2>&1; then
    echo "✅ API accessible"
else
    echo "❌ API non accessible"
fi

if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Frontend accessible"
else
    echo "❌ Frontend non accessible"
fi

echo "🎉 Déploiement terminé!"
echo ""
echo "📋 Informations de connexion:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:8000/api/"
echo "   Admin Django: http://localhost:8000/admin/"
echo ""
echo "📝 Commandes utiles:"
echo "   Voir les logs: docker-compose -f $COMPOSE_FILE logs -f"
echo "   Redémarrer: docker-compose -f $COMPOSE_FILE restart"
echo "   Arrêter: docker-compose -f $COMPOSE_FILE down"
echo "   Sauvegarde DB: docker exec postgres17 pg_dump -U postgres trading_journal_prod > backup.sql"
