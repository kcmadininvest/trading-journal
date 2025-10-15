# 📊 Guide d'Import TopStep - Trading Journal

## ✅ Configuration Terminée

Votre système d'import TopStep est maintenant **opérationnel** et prêt à importer vos trades !

## 🗄️ Tables Créées dans PostgreSQL

Les tables suivantes ont été créées dans le schéma `trading_journal` :

1. **`trades_topsteptrade`** - Table principale pour stocker les trades TopStep
2. **`trades_topstepimportlog`** - Log de tous les imports effectués

### Vérification dans PostgreSQL

```bash
PGPASSWORD='your_password' psql -U postgres -d portfolio -h localhost -c \
"SELECT table_name FROM information_schema.tables \
WHERE table_schema = 'trading_journal' AND table_name LIKE 'trades_%';"
```

## 📥 Format CSV TopStep Attendu

Le système accepte les fichiers CSV TopStep avec les colonnes suivantes :

```csv
Id,ContractName,EnteredAt,ExitedAt,EntryPrice,ExitPrice,Fees,PnL,Size,Type,TradeDay,TradeDuration,Commissions
```

### Exemple de Ligne

```csv
1443101901,NQZ5,10/08/2025 18:23:28 +02:00,10/08/2025 18:31:03 +02:00,25261.750000000,25245.750000000,8.40000,-960.000000000,3,Long,10/08/2025 00:00:00 -05:00,00:07:34.9942140,
```

## 🔄 Conversion Format US → Format Européen

Le système convertit **automatiquement** :

### Dates
- **Format US** : `10/08/2025 18:23:28` (MM/DD/YYYY)
- **Format EU** : `08/10/2025 18:23:28` (DD/MM/YYYY)

### Nombres
- **Format US** : `25261.750000000` (point décimal)
- **Format EU** : `25261,750000000` (virgule décimale)
- **Stockage** : Format Decimal Python (précis pour les calculs financiers)

### Durées
- **Format TopStep** : `00:07:34.9942140`
- **Format Python** : timedelta
- **Affichage** : `00:07:34`

## 🚀 Méthodes d'Import

### Méthode 1 : Commande Django (Recommandée)

```bash
cd /var/www/html/trading_journal/backend
source venv/bin/activate
python manage.py import_topstep_csv <username> <fichier.csv>
```

**Exemple :**
```bash
python manage.py import_topstep_csv trader /path/to/topstep_trades.csv
```

### Méthode 2 : Via l'Admin Django

1. Créer un superutilisateur (si pas déjà fait)
   ```bash
   python manage.py createsuperuser
   ```

2. Accéder à l'admin : http://localhost:8000/admin

3. Naviguer vers **Trades → TopStep Trades**

4. Importer via l'interface admin (à développer dans les prochaines étapes)

### Méthode 3 : Via l'API REST (À développer)

L'endpoint API sera disponible pour uploader des CSV depuis le frontend React.

## 📊 Données Stockées

Pour chaque trade importé, le système stocke :

### Identification
- ✅ ID TopStep unique
- ✅ Utilisateur propriétaire
- ✅ Nom du contrat (NQZ5, ESH5, etc.)

### Informations Temporelles
- ✅ Date/Heure d'entrée (converti en format Python)
- ✅ Date/Heure de sortie
- ✅ Jour de trading
- ✅ Durée totale du trade

### Prix et Quantités
- ✅ Prix d'entrée (format Decimal)
- ✅ Prix de sortie
- ✅ Taille (nombre de contrats)

### Performance
- ✅ PnL brut
- ✅ Frais
- ✅ Commissions
- ✅ **PnL Net** (calculé automatiquement)
- ✅ **Pourcentage de PnL** (calculé automatiquement)

### Métadonnées
- ✅ Type de trade (Long/Short)
- ✅ Notes personnelles (optionnel)
- ✅ Stratégie (optionnel)
- ✅ Données brutes JSON (pour référence)
- ✅ Date d'import

## 🧪 Test de l'Import

Un fichier de test est disponible : `backend/test_topstep_import.csv`

### Test Complet

```bash
cd /var/www/html/trading_journal/backend
source venv/bin/activate

# 1. Créer un utilisateur de test (déjà créé : trader/trader123)
# python manage.py shell
# >>> from django.contrib.auth.models import User
# >>> User.objects.create_user('trader', 'trader@example.com', 'trader123')

# 2. Importer le fichier de test
python manage.py import_topstep_csv trader test_topstep_import.csv

# 3. Vérifier l'import
python manage.py shell
>>> from trades.models import TopStepTrade
>>> TopStepTrade.objects.count()  # Devrait afficher 1
>>> trade = TopStepTrade.objects.first()
>>> print(trade.formatted_entry_date)  # Format européen
>>> print(trade.net_pnl)  # PnL net calculé
```

## 📋 Résultat de l'Import de Test

```
================================================================================
TRADE IMPORTÉ AVEC SUCCÈS
================================================================================

📊 ID TopStep: 1443101901
📈 Contrat: NQZ5
📍 Type: Long

⏰ DATES (Format Européen):
   Entrée: 08/10/2025 20:23:28
   Sortie: 08/10/2025 20:31:03
   Jour de trading: 07/10/2025
   Durée: 00:07:34

💰 PRIX (Format Européen avec virgule):
   Prix d'entrée: 25261,750000000
   Prix de sortie: 25245,750000000

📊 QUANTITÉ:
   Taille: 3.0000 contrats

💵 PERFORMANCE:
   PnL Brut: -960,000000000 $
   Frais: 8.40000 $
   Commissions: 0.00000 $
   PnL Net: -968.40 $
   Pourcentage: -1.28%
   Statut: ❌ Perte

================================================================================
```

## 🔍 Gestion des Doublons

Le système détecte automatiquement les doublons basés sur :
- **Utilisateur** + **ID TopStep**

Si vous tentez d'importer un trade déjà existant :
- ❌ Il sera **rejeté**
- ℹ️ Un message d'erreur sera affiché
- 📊 Le compteur de "skipped" sera incrémenté

## 📈 Logs d'Import

Chaque import est enregistré dans `trades_topstepimportlog` avec :
- Nom du fichier
- Nombre total de lignes
- Nombre de succès
- Nombre d'erreurs
- Détails des erreurs (JSON)
- Date/Heure d'import

### Consulter les logs

```bash
python manage.py shell
>>> from trades.models import TopStepImportLog
>>> logs = TopStepImportLog.objects.all()
>>> for log in logs:
...     print(f"{log.filename}: {log.success_count}/{log.total_rows} réussis")
```

## 🎯 Propriétés Calculées Automatiquement

Le modèle `TopStepTrade` calcule automatiquement :

1. **PnL Net** : `PnL brut - Frais - Commissions`
2. **Pourcentage de PnL** : `(PnL Net / Investment) × 100`
3. **Statut profitable** : `True` si PnL Net > 0

Ces valeurs sont **calculées lors de la sauvegarde** et stockées en base.

## 🖥️ Admin Django

L'interface d'administration Django affiche les trades avec :
- Badge de couleur (vert/rouge) selon la performance
- Dates au format européen (DD/MM/YYYY)
- Filtres par contrat, type, date
- Recherche par ID TopStep ou contrat
- Affichage du taux de réussite pour les logs

### Accéder à l'Admin

```bash
# 1. Créer un superutilisateur
cd /var/www/html/trading_journal/backend
source venv/bin/activate
python manage.py createsuperuser

# 2. Démarrer le serveur
python manage.py runserver

# 3. Accéder à http://localhost:8000/admin
```

## 🔧 Commandes Utiles

### Lister tous les trades d'un utilisateur

```bash
python manage.py shell
>>> from trades.models import TopStepTrade
>>> from django.contrib.auth.models import User
>>> user = User.objects.get(username='trader')
>>> trades = TopStepTrade.objects.filter(user=user)
>>> for trade in trades:
...     print(f"{trade.contract_name}: {trade.net_pnl}")
```

### Statistiques rapides

```bash
python manage.py shell
>>> from trades.models import TopStepTrade
>>> from django.db.models import Sum, Count, Avg
>>> trades = TopStepTrade.objects.filter(user__username='trader')
>>> print(f"Total trades: {trades.count()}")
>>> print(f"PnL total: {trades.aggregate(Sum('net_pnl'))}")
>>> print(f"PnL moyen: {trades.aggregate(Avg('net_pnl'))}")
```

### Supprimer tous les trades d'un utilisateur

```bash
python manage.py shell
>>> from trades.models import TopStepTrade
>>> TopStepTrade.objects.filter(user__username='trader').delete()
```

## 📤 Prochaines Étapes

1. ✅ **Modèle créé** - TopStepTrade avec conversion US → EU
2. ✅ **Import CSV fonctionnel** - Via commande Django
3. ✅ **Admin configuré** - Interface d'administration
4. ⏳ **API REST** - Endpoints pour le frontend
5. ⏳ **Frontend React** - Interface d'upload et visualisation
6. ⏳ **Dashboard** - Statistiques et graphiques
7. ⏳ **Export** - Exporter en PDF ou Excel

## 🔗 Fichiers Importants

- **Modèle** : `backend/trades/models.py`
- **Admin** : `backend/trades/admin.py`
- **Utilitaires** : `backend/trades/utils.py`
- **Commande** : `backend/trades/management/commands/import_topstep_csv.py`
- **Migrations** : `backend/trades/migrations/0001_initial.py`

## 📚 Documentation Complémentaire

- `README.md` - Documentation générale du projet
- `DATABASE_CONFIG.md` - Configuration PostgreSQL
- `NEXT_STEPS.md` - Étapes suivantes de développement

---

**✨ Le système est prêt ! Vous pouvez maintenant importer vos trades TopStep ! 🚀**


