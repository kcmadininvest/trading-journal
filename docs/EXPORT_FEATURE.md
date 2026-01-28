# Fonctionnalité d'Export PDF/Excel

## Vue d'ensemble

Cette fonctionnalité permet aux utilisateurs d'exporter les statistiques de leurs portefeuilles de trading au format PDF ou Excel, avec une personnalisation complète des sections et métriques à inclure.

## Fonctionnalités

### 1. Formats d'Export
- **PDF** : Document formaté et professionnel, idéal pour partager comme preuve de performance
- **Excel** : Fichier avec données structurées et graphiques, idéal pour analyse complémentaire

### 2. Personnalisation Complète
Les utilisateurs peuvent choisir :
- **Métriques** : P&L Total, Win Rate, Profit Factor, Drawdown Max, Sharpe Ratio, etc.
- **Graphiques** : Courbe d'équité, Performance mensuelle, Répartition Win/Loss, Distribution P&L, Courbe de Drawdown
- **Analyses** : Par stratégie, par instrument, par timeframe, par jour de la semaine, par heure
- **Liste des trades** : Top 10 meilleurs/pires, tous les trades, ou aucun
- **Options** : Watermark, numérotation des pages

### 3. Templates Réutilisables
- Sauvegarde de configurations personnalisées
- Templates par défaut par format
- Réutilisation en 1 clic

### 4. Filtrage par Période
- Export sur une période spécifique
- Ou export de toutes les données

## Architecture Technique

### Backend

#### Modèles
- **`ExportTemplate`** (`/backend/trades/models.py`) : Stocke les configurations d'export personnalisées

#### Modules d'Export
- **`PortfolioStatsCalculator`** (`/backend/trades/exports/stats_calculator.py`) : Calcule toutes les statistiques
- **`PDFGenerator`** (`/backend/trades/exports/pdf_generator.py`) : Génère les rapports PDF avec WeasyPrint
- **`ExcelGenerator`** (`/backend/trades/exports/excel_generator.py`) : Génère les fichiers Excel avec openpyxl

#### API Endpoints

**Gestion des Templates**
```
GET    /api/trades/export-templates/          # Liste des templates
POST   /api/trades/export-templates/          # Créer un template
GET    /api/trades/export-templates/{id}/     # Détails d'un template
PUT    /api/trades/export-templates/{id}/     # Modifier un template
DELETE /api/trades/export-templates/{id}/     # Supprimer un template
POST   /api/trades/export-templates/{id}/set-default/  # Définir comme défaut
GET    /api/trades/export-templates/defaults/ # Templates par défaut
```

**Export de Portefeuille**
```
POST   /api/trades/portfolio-export/generate/ # Générer un export
```

#### Exemple de Requête d'Export

```json
POST /api/trades/portfolio-export/generate/
{
  "trading_account_id": 1,
  "format": "pdf",
  "template_id": 5,
  "start_date": "2024-01-01T00:00:00Z",
  "end_date": "2024-12-31T23:59:59Z"
}
```

Ou avec configuration personnalisée :

```json
POST /api/trades/portfolio-export/generate/
{
  "trading_account_id": 1,
  "format": "excel",
  "configuration": {
    "sections": {
      "header": true,
      "metrics": ["pnl_total", "win_rate", "profit_factor"],
      "charts": ["equity_curve", "monthly_performance"],
      "analysis": ["by_strategy", "by_instrument"],
      "trades_list": "top_10_best_worst"
    },
    "options": {
      "watermark": true,
      "page_numbers": true
    }
  },
  "start_date": "2024-01-01T00:00:00Z"
}
```

### Frontend

#### Composants
- **`ExportModal`** (`/frontend/src/components/exports/ExportModal.tsx`) : Modal de configuration et export
- **`ExportButton`** (`/frontend/src/components/exports/ExportButton.tsx`) : Bouton pour ouvrir le modal

#### Utilisation dans une Page

```tsx
import { ExportButton } from '../../components/exports';

function PortfolioPage() {
  const tradingAccountId = 1;
  const tradingAccountName = "Mon Compte TopStep";

  return (
    <div>
      <ExportButton 
        tradingAccountId={tradingAccountId}
        tradingAccountName={tradingAccountName}
      />
    </div>
  );
}
```

## Installation et Configuration

### 1. Installer les Dépendances Backend

```bash
cd backend
pip install -r requirements.txt
```

Nouvelles dépendances ajoutées :
- `weasyprint>=60.0` : Génération de PDF
- `openpyxl>=3.1.0` : Génération d'Excel
- `matplotlib>=3.7.0` : Création de graphiques

### 2. Créer et Appliquer les Migrations

```bash
python manage.py makemigrations trades
python manage.py migrate
```

### 3. Vérifier la Configuration

Le template HTML pour les PDF se trouve dans :
```
/backend/trading_journal_api/templates/trades/exports/portfolio_report.html
```

## Utilisation

### Via l'Interface Utilisateur

1. Accéder à la page de statistiques d'un portefeuille
2. Cliquer sur le bouton "Exporter"
3. Choisir le format (PDF ou Excel)
4. Sélectionner un template pré-configuré ou personnaliser
5. Optionnellement, définir une période
6. Cliquer sur "Exporter"
7. Le fichier se télécharge automatiquement

### Via l'API

```python
import requests

# Authentification
headers = {
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
}

# Export avec template
response = requests.post(
    'http://localhost:8000/api/trades/portfolio-export/generate/',
    headers=headers,
    json={
        'trading_account_id': 1,
        'format': 'pdf',
        'template_id': 1
    }
)

# Sauvegarder le fichier
with open('rapport.pdf', 'wb') as f:
    f.write(response.content)
```

## Structure de Configuration

```json
{
  "sections": {
    "header": true,
    "metrics": [
      "pnl_total",
      "win_rate",
      "profit_factor",
      "max_drawdown",
      "sharpe_ratio",
      "expectancy",
      "avg_win",
      "avg_loss"
    ],
    "charts": [
      "equity_curve",
      "monthly_performance",
      "win_loss_distribution",
      "pnl_distribution",
      "drawdown_curve"
    ],
    "analysis": [
      "by_strategy",
      "by_instrument",
      "by_timeframe",
      "by_day_of_week",
      "by_hour"
    ],
    "trades_list": "top_10_best_worst"
  },
  "options": {
    "watermark": true,
    "page_numbers": true
  }
}
```

### Options pour `trades_list`
- `"none"` : Aucune liste de trades
- `"top_10_best_worst"` : Top 10 meilleurs et pires
- `"top_10_best"` : Top 10 meilleurs uniquement
- `"top_10_worst"` : Top 10 pires uniquement
- `"all"` : Tous les trades

## Statistiques Calculées

### Générales
- Capital initial/actuel
- P&L total/net
- Nombre de trades (total, gagnants, perdants, breakeven)
- Win rate
- Rendement en %

### Performance
- Gain/perte moyen(ne)
- Plus gros gain/perte
- Profit factor
- Expectancy
- Ratio risque/rendement

### Risque
- Drawdown maximum (€ et %)
- Drawdown actuel
- Sharpe ratio

### Analyses
- Performance par stratégie
- Performance par instrument
- Performance par timeframe
- Performance par jour de la semaine
- Performance par heure

## Personnalisation Avancée

### Modifier le Template HTML (PDF)

Éditer le fichier :
```
/backend/trading_journal_api/templates/trades/exports/portfolio_report.html
```

### Modifier les Styles CSS (PDF)

Les styles sont définis dans la méthode `_get_css()` de `PDFGenerator`.

### Ajouter de Nouvelles Métriques

1. Ajouter le calcul dans `PortfolioStatsCalculator`
2. Mettre à jour le template HTML ou le générateur Excel
3. Ajouter l'option dans le frontend

## Dépannage

### Erreur lors de la génération PDF

**Problème** : WeasyPrint ne trouve pas les polices système

**Solution** :
```bash
# Ubuntu/Debian
sudo apt-get install fonts-liberation

# macOS
brew install fontconfig
```

### Erreur "Template not found"

**Problème** : Django ne trouve pas le template HTML

**Solution** : Vérifier que le dossier `templates` est dans `TEMPLATES['DIRS']` dans `settings.py`

### Graphiques vides dans le PDF

**Problème** : Matplotlib n'arrive pas à générer les graphiques

**Solution** : Vérifier que matplotlib utilise le backend 'Agg' (déjà configuré dans `pdf_generator.py`)

## Améliorations Futures

- [ ] Export automatique périodique (mensuel)
- [ ] Envoi par email direct depuis l'application
- [ ] Comparaison de plusieurs portefeuilles
- [ ] Signature numérique pour authenticité
- [ ] Templates prédéfinis supplémentaires
- [ ] Export au format CSV
- [ ] Planification d'exports récurrents

## Support

Pour toute question ou problème, consulter :
- La documentation Django : https://docs.djangoproject.com/
- WeasyPrint docs : https://doc.courtbouillon.org/weasyprint/
- openpyxl docs : https://openpyxl.readthedocs.io/
