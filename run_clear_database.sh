#!/bin/bash

# Script pour exécuter la suppression sécurisée de la base de données
# ATTENTION: Ce script supprime TOUTES les données de la base de données

echo "=== SCRIPT DE SUPPRESSION DE BASE DE DONNÉES ==="
echo "ATTENTION: Ce script va supprimer TOUTES les données de la base de données!"
echo ""

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "backend/manage.py" ]; then
    echo "ERREUR: Ce script doit être exécuté depuis le répertoire racine du projet"
    echo "Répertoire actuel: $(pwd)"
    echo "Fichiers attendus: backend/manage.py"
    exit 1
fi

# Vérifier que l'environnement virtuel existe
if [ ! -d "backend/venv" ]; then
    echo "ERREUR: Environnement virtuel non trouvé dans backend/venv"
    echo "Veuillez créer l'environnement virtuel d'abord"
    exit 1
fi

echo "Répertoire du projet: $(pwd)"
echo "Environnement virtuel: backend/venv"
echo ""

# Demander confirmation finale
read -p "Êtes-vous ABSOLUMENT SÛR de vouloir supprimer TOUTES les données? (tapez 'OUI' pour confirmer): " confirmation

if [ "$confirmation" != "OUI" ]; then
    echo "Opération annulée."
    exit 0
fi

echo ""
echo "Démarrage de la suppression..."

# Activer l'environnement virtuel et exécuter le script Python
cd backend
source venv/bin/activate

# Exécuter le script de suppression
python ../clear_database_safe.py

# Vérifier le code de sortie
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Suppression terminée avec succès!"
else
    echo ""
    echo "❌ Erreur lors de la suppression. Vérifiez les logs ci-dessus."
    exit 1
fi

deactivate
cd ..

echo ""
echo "Script terminé."
