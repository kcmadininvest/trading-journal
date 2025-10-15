#!/bin/bash

# Script pour exécuter les tests de Trading Journal
# Usage: ./run_tests.sh [options]

set -e

echo "🧪 Exécution des tests pour Trading Journal"
echo "=========================================="

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "manage.py" ]; then
    echo "❌ Erreur: Ce script doit être exécuté depuis le répertoire backend/"
    exit 1
fi

# Activer l'environnement virtuel si il existe
if [ -d "venv" ]; then
    echo "🔧 Activation de l'environnement virtuel..."
    source venv/bin/activate
fi

# Installer les dépendances de test si nécessaire
echo "📦 Vérification des dépendances..."
pip install -r requirements.txt

# Exécuter les migrations de test
echo "🗄️ Préparation de la base de données de test..."
python manage.py migrate --run-syncdb

# Exécuter les tests
echo "🚀 Exécution des tests..."
python manage.py test tests/ --verbosity=2

echo ""
echo "✅ Tests terminés avec succès!"
echo ""
echo "📝 Commandes utiles:"
echo "   Tests spécifiques: python manage.py test tests.test_imports"
echo "   Tests avec couverture: python manage.py test --coverage"
echo "   Tests en parallèle: python manage.py test --parallel"
