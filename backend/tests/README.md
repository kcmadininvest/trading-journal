# Tests pour Trading Journal

Ce répertoire contient les tests unitaires et d'intégration pour l'application Trading Journal.

## Structure

- `test_imports.py` : Tests pour vérifier que tous les modules sont correctement installés
- `fixtures/` : Données de test pour les tests

## Exécution des Tests

```bash
# Depuis le répertoire backend/
python manage.py test

# Tests spécifiques
python manage.py test tests.test_imports

# Tests avec verbosité
python manage.py test --verbosity=2
```

## Ajout de Nouveaux Tests

1. Créer un nouveau fichier `test_*.py`
2. Importer `unittest` et les modules nécessaires
3. Créer des classes héritant de `unittest.TestCase`
4. Ajouter des méthodes `test_*` pour chaque test

## Exemple de Test

```python
import unittest
from django.test import TestCase
from trades.models import TopStepTrade

class TestTopStepTrade(TestCase):
    def test_trade_creation(self):
        trade = TopStepTrade.objects.create(
            contract_name="NQZ5",
            # ... autres champs
        )
        self.assertEqual(trade.contract_name, "NQZ5")
```
