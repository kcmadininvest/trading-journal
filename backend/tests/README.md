# Tests pour Trading Journal

Ce répertoire contient les tests unitaires et d'intégration pour l'application Trading Journal.

## Structure

- `test_imports.py` : Tests pour vérifier que tous les modules sont correctement installés
- `fixtures/` : Données de test pour les tests

## Captures d’écran (MEDIA_ROOT) et environnement de test

Après **import d’une base** (dump SQL, autre machine, etc.), les lignes peuvent encore référencer des fichiers sous `media/screenshots/` alors que le dossier **n’a pas été copié** : le front appelle alors `GET /api/trades/protected-screenshot/?s=…` et le serveur répond **404** (fichier absent) — comportement attendu, pas un bug d’API.

**Aligner disque et base (recommandé)** : copier le répertoire des screenshots vers le `MEDIA_ROOT` utilisé par Django, par exemple :

```bash
# Exemple : depuis une autre machine ou sauvegarde (adapter chemins et SSH)
rsync -avz --delete utilisateur@hote-distant:/chemin/vers/media/screenshots/ /chemin/vers/votre/MEDIA_ROOT/screenshots/
```

Ou régénérer les captures via l’UI (upload) sur l’environnement de test.

Un script d’exemple (variables d’environnement) est fourni : [`backend/scripts/sync_screenshots_media.example.sh`](backend/scripts/sync_screenshots_media.example.sh).

**Nettoyer les références orphelines en base** (plus de GET vers des URLs mortes) :

```bash
cd backend
python manage.py clear_missing_screenshot_db_refs --dry-run   # prévisualiser
python manage.py clear_missing_screenshot_db_refs             # appliquer
# optionnel : un seul utilisateur
python manage.py clear_missing_screenshot_db_refs --user-id 3
```

La commande ne modifie que les champs qui pointent vers le stockage screenshots **de l’utilisateur propriétaire** (`/media/screenshots/<id>/…` ou jeton signé valide) lorsque **ni l’original ni la miniature** n’existent sur le disque. Les URLs externes (TradingView, etc.) sont ignorées.

Fichiers sur disque **non référencés** en base : voir `python manage.py cleanup_orphan_screenshots` (logique inverse).

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
