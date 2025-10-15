# Validation de l'upload CSV - Messages d'erreur améliorés

## Améliorations apportées

### 1. Messages d'erreur détaillés pour les colonnes manquantes

Lorsqu'un fichier CSV ne contient pas toutes les colonnes requises, le système indique maintenant **précisément** quelles colonnes sont manquantes.

#### Avant
```json
{
  "success": false,
  "error": "Format de fichier invalide. Colonnes manquantes."
}
```

#### Après
```json
{
  "success": false,
  "error": "Format de fichier invalide. Colonnes manquantes : ExitedAt, EntryPrice, ExitPrice, Fees, PnL, Size, Type, TradeDay, TradeDuration, Commissions",
  "missing_columns": [
    "ExitedAt",
    "EntryPrice",
    "ExitPrice",
    "Fees",
    "PnL",
    "Size",
    "Type",
    "TradeDay",
    "TradeDuration",
    "Commissions"
  ]
}
```

### 2. Format CSV requis

Le fichier CSV doit contenir **exactement** ces 13 colonnes :

1. **Id** - Identifiant unique du trade
2. **ContractName** - Nom du contrat (ex: NQZ5, ESH5)
3. **EnteredAt** - Date/heure d'entrée (format US)
4. **ExitedAt** - Date/heure de sortie (format US)
5. **EntryPrice** - Prix d'entrée (format US avec point)
6. **ExitPrice** - Prix de sortie (format US avec point)
7. **Fees** - Frais (format US)
8. **PnL** - Profit/Perte (format US)
9. **Size** - Taille de la position
10. **Type** - Type de trade (Long ou Short)
11. **TradeDay** - Jour du trade (format US)
12. **TradeDuration** - Durée du trade (HH:MM:SS.microseconds)
13. **Commissions** - Commissions (format US, peut être vide)

### 3. Exemple de fichier valide

```csv
Id,ContractName,EnteredAt,ExitedAt,EntryPrice,ExitPrice,Fees,PnL,Size,Type,TradeDay,TradeDuration,Commissions
1443101901,NQZ5,10/08/2025 18:23:28 +02:00,10/08/2025 18:31:03 +02:00,25261.750000000,25245.750000000,8.40000,-960.000000000,3,Long,10/08/2025 00:00:00 -05:00,00:07:34.9942140,
1443101902,ESH5,10/08/2025 14:15:22 +02:00,10/08/2025 14:45:10 +02:00,4250.50000000,4255.75000000,6.80000,1575.000000000,3,Long,10/08/2025 00:00:00 -05:00,00:29:48.1234567,
```

### 4. Exemple de fichier invalide

```csv
Id,ContractName,EnteredAt
1443101901,NQZ5,10/08/2025 18:23:28 +02:00
```

**Erreur retournée** :
```
Format de fichier invalide. Colonnes manquantes : ExitedAt, EntryPrice, ExitPrice, Fees, PnL, Size, Type, TradeDay, TradeDuration, Commissions
```

### 5. Affichage dans le frontend

Le frontend affiche automatiquement l'erreur détaillée via un toast :

```typescript
try {
  const result = await tradesService.uploadCSV(selectedFile);
  if (result.success) {
    toast.success(result.message);
  } else {
    toast.error(result.error || 'Erreur lors de l\'import');
  }
} catch (error: any) {
  toast.error(error.response?.data?.error || 'Erreur lors de l\'upload du fichier');
}
```

### 6. Tests

#### Test avec fichier valide
```bash
curl -X POST http://localhost:8000/api/trades/topstep/upload_csv/ \
  -F "file=@sample_topstep.csv"

# Résultat
{
  "success": true,
  "message": "Import réussi : 3/3 trades importés",
  "total_rows": 3,
  "success_count": 3,
  "error_count": 0,
  "skipped_count": 0,
  "errors": []
}
```

#### Test avec fichier invalide
```bash
curl -X POST http://localhost:8000/api/trades/topstep/upload_csv/ \
  -F "file=@invalid.csv"

# Résultat
{
  "success": false,
  "error": "Format de fichier invalide. Colonnes manquantes : ExitedAt, EntryPrice, ...",
  "missing_columns": ["ExitedAt", "EntryPrice", ...]
}
```

## Implémentation technique

### Backend (`trades/utils.py`)

```python
def _validate_columns(self, columns):
    """
    Vérifie que toutes les colonnes requises sont présentes.
    Retourne (True, None) si valide, ou (False, liste_colonnes_manquantes) si invalide.
    """
    if not columns:
        return False, self.REQUIRED_COLUMNS
    
    missing_columns = [col for col in self.REQUIRED_COLUMNS if col not in columns]
    if missing_columns:
        return False, missing_columns
    
    return True, None
```

### Utilisation

```python
is_valid, missing_columns = self._validate_columns(reader.fieldnames)
if not is_valid:
    missing_cols_str = ', '.join(missing_columns)
    return {
        'success': False,
        'error': f'Format de fichier invalide. Colonnes manquantes : {missing_cols_str}',
        'missing_columns': missing_columns,
        'total_rows': 0,
        'success_count': 0,
        'error_count': 0
    }
```

## Bénéfices

1. ✅ **Expérience utilisateur améliorée** : L'utilisateur sait exactement ce qui ne va pas
2. ✅ **Débogage facilité** : Plus besoin de deviner quelles colonnes manquent
3. ✅ **Documentation vivante** : Le message d'erreur sert de référence
4. ✅ **Gain de temps** : Correction immédiate possible

## Fichiers modifiés

- `/var/www/html/trading_journal/backend/trades/utils.py`
  - Méthode `_validate_columns()` : Retourne maintenant un tuple (bool, list)
  - Méthode `import_from_file()` : Affiche les colonnes manquantes
  - Méthode `import_from_string()` : Affiche les colonnes manquantes

## Recommandations

1. **Toujours utiliser le template TopStep** pour générer vos CSV
2. **Ne pas modifier les noms de colonnes** (respecter la casse exacte)
3. **Garder toutes les colonnes** même si certaines valeurs sont vides
4. **Vérifier l'encodage** : UTF-8 recommandé

---

**Date** : 10 octobre 2025  
**Version** : 1.1  
**Statut** : ✅ Implémenté et testé

