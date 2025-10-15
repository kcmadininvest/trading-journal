#!/bin/bash

# Script pour configurer la base de données dans le conteneur PostgreSQL existant
# Usage: ./scripts/setup-database.sh

set -e

echo "🗄️ Configuration de la base de données PostgreSQL..."

# Vérifier que le conteneur postgres17 est en cours d'exécution
if ! docker ps | grep -q postgres17; then
    echo "❌ Le conteneur postgres17 n'est pas en cours d'exécution"
    echo "💡 Démarrez le conteneur avec: docker start postgres17"
    exit 1
fi

echo "✅ Conteneur postgres17 trouvé"

# Charger les variables d'environnement
if [ -f .env ]; then
    source .env
    echo "✅ Variables d'environnement chargées"
else
    echo "❌ Fichier .env manquant"
    exit 1
fi

# Variables par défaut
DB_NAME=${DB_NAME:-trading_journal_prod}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-postgres}

echo "📋 Configuration:"
echo "   Base de données: $DB_NAME"
echo "   Utilisateur: $DB_USER"
echo "   Host: host.docker.internal:5432"

# Créer la base de données si elle n'existe pas
echo "🔧 Création de la base de données..."
docker exec postgres17 psql -U postgres -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || echo "Base de données $DB_NAME existe déjà"

# Créer un utilisateur spécifique si nécessaire (optionnel)
if [ "$DB_USER" != "postgres" ]; then
    echo "👤 Création de l'utilisateur $DB_USER..."
    docker exec postgres17 psql -U postgres -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || echo "Utilisateur $DB_USER existe déjà"
    docker exec postgres17 psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || echo "Privilèges déjà accordés"
fi

# Vérifier la connexion
echo "🔍 Test de connexion..."
if docker exec postgres17 psql -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ Connexion à la base de données réussie"
else
    echo "❌ Échec de la connexion à la base de données"
    echo "💡 Vérifiez les paramètres dans votre fichier .env"
    exit 1
fi

echo "🎉 Configuration de la base de données terminée!"
echo ""
echo "📝 Informations de connexion:"
echo "   Host: host.docker.internal"
echo "   Port: 5432"
echo "   Base: $DB_NAME"
echo "   Utilisateur: $DB_USER"
echo ""
echo "🔧 Commandes utiles:"
echo "   Connexion: docker exec -it postgres17 psql -U $DB_USER -d $DB_NAME"
echo "   Sauvegarde: docker exec postgres17 pg_dump -U $DB_USER $DB_NAME > backup.sql"
echo "   Restauration: docker exec -i postgres17 psql -U $DB_USER $DB_NAME < backup.sql"
