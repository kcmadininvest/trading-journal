# Prévention des doublons lors de l'import TopStep

## Contrainte d'unicité

Le modèle `TopStepTrade` dispose d'une contrainte d'unicité sur le champ `topstep_id` pour empêcher l'importation de trades en double.

### Implémentation

```python
# Dans trades/models.py
class TopStepTrade(models.Model):
    topstep_id = models.CharField(
        max_length=50,
        unique=True,  # ← Contrainte d'unicité au niveau de la base de données
        verbose_name='ID TopStep',
        help_text='ID unique du trade dans TopStep'
    )
```

### Comportement lors de l'import

Lorsqu'un fichier CSV contient des trades déjà présents dans la base de données :

1. **Détection automatique** : Le système vérifie si un trade avec le même `topstep_id` existe déjà
2. **Ignoré silencieusement** : Le doublon est ignoré sans générer d'erreur
3. **Comptabilisé** : Le doublon est comptabilisé dans les statistiques d'import comme "ignoré"

### Exemple d'import

```bash
# Premier import
$ python manage.py import_topstep_csv admin trades.csv
✓ Import terminé avec succès!
  Total de lignes: 5
  ✓ Importés: 5
  ⊘ Ignorés (doublons): 0

# Réimport du même fichier
$ python manage.py import_topstep_csv admin trades.csv
✓ Import terminé avec succès!
  Total de lignes: 5
  ✓ Importés: 0
  ⊘ Ignorés (doublons): 5
```

### Import avec doublons partiels

Si un fichier CSV contient à la fois des nouveaux trades et des doublons :

```bash
$ python manage.py import_topstep_csv admin mixed_trades.csv
✓ Import terminé avec succès!
  Total de lignes: 10
  ✓ Importés: 6
  ⊘ Ignorés (doublons): 4
```

### Vérification manuelle

Pour vérifier si un trade existe déjà :

```python
from trades.models import TopStepTrade

topstep_id = "1443101901"
exists = TopStepTrade.objects.filter(topstep_id=topstep_id).exists()
print(f"Trade {topstep_id} existe déjà : {exists}")
```

### API REST

Lors de l'upload CSV via l'API, le même comportement s'applique :

```bash
POST /api/trades/topstep/upload_csv/
Content-Type: multipart/form-data

Response:
{
  "success": true,
  "total_rows": 10,
  "success_count": 6,
  "skipped_count": 4,
  "error_count": 0,
  "message": "Import réussi : 6 trades importés, 4 doublons ignorés"
}
```

### Migration

La contrainte d'unicité a été ajoutée via la migration :

```bash
python manage.py migrate trades 0002_add_unique_topstep_id
```

### Niveau de la contrainte

La contrainte est appliquée à **deux niveaux** :

1. **Base de données** : Contrainte `UNIQUE` sur la colonne `topstep_id`
2. **Application** : Vérification avant insertion dans `TopStepCSVImporter`

Cela garantit l'intégrité des données même en cas d'accès direct à la base de données.

### Suppression et réimport

Si vous devez réimporter un trade :

```bash
# Supprimer le trade existant
python manage.py shell -c "from trades.models import TopStepTrade; TopStepTrade.objects.filter(topstep_id='1443101901').delete()"

# Réimporter
python manage.py import_topstep_csv admin trades.csv
```

### Gestion des conflits

En cas de conflit (tentative d'insertion d'un doublon via un autre moyen que l'import CSV), Django lèvera une exception `IntegrityError` :

```python
from django.db import IntegrityError
from trades.models import TopStepTrade

try:
    TopStepTrade.objects.create(
        topstep_id="1443101901",
        # ... autres champs
    )
except IntegrityError:
    print("Ce trade existe déjà !")
```

### Recommandations

1. **Ne pas modifier manuellement** les `topstep_id` dans la base de données
2. **Utiliser l'import CSV** pour garantir la cohérence des données
3. **Vérifier les logs d'import** après chaque import pour détecter les doublons
4. **Conserver les fichiers CSV originaux** pour traçabilité

---

**Date de création** : Octobre 2025  
**Dernière mise à jour** : Octobre 2025  
**Version** : 1.0


