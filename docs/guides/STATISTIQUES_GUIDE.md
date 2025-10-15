# Guide des Statistiques - Trading Journal

## 📊 Nouveaux Graphiques Disponibles

Le menu **Statistiques** a été enrichi avec deux nouveaux graphiques d'analyse avancée :

### 1. 📈 Évolution du Capital par Jour (Graphique en Cascade)

**Localisation :** Menu → Statistiques

**Fonctionnalités :**
- Affiche l'évolution quotidienne du capital sous forme de barres colorées
- Barres vertes pour les jours gagnants, rouges pour les jours perdants
- Statistiques détaillées : capital total, meilleur jour, pire jour, taux de réussite
- Tooltips informatifs avec PnL journalier et capital cumulé

**Données affichées :**
- PnL journalier par date
- Capital cumulé au fil du temps
- Nombre de jours gagnants vs perdants
- Taux de réussite global

### 2. 📅 Performance par Jour de la Semaine

**Localisation :** Menu → Statistiques

**Fonctionnalités :**
- Analyse des performances selon les jours de la semaine
- Barres colorées pour le PnL total par jour
- Ligne de tendance pour le PnL moyen
- Statistiques : meilleur jour, jour le plus actif, pire jour

**Données affichées :**
- PnL total par jour de la semaine
- Nombre de trades par jour
- Taux de réussite par jour
- PnL moyen par jour

## 🚀 Comment Accéder

1. **Via le menu latéral :** Cliquez sur "Statistiques" dans la barre latérale
2. **Via l'URL :** Accédez directement à `#statistics` dans l'URL

## 🔧 Endpoints API

Les graphiques utilisent deux nouveaux endpoints optimisés :

- `GET /api/trades/topstep/capital_evolution/` - Données d'évolution du capital
- `GET /api/trades/topstep/weekday_performance/` - Données de performance par jour

## 🎨 Design

- Interface moderne avec Tailwind CSS [[memory:9748895]]
- Graphiques interactifs avec Chart.js
- Couleurs cohérentes (vert pour gains, rouge pour pertes)
- Responsive design pour mobile et desktop
- Animations fluides

## 📱 Compatibilité

- ✅ Desktop (Chrome, Firefox, Safari, Edge)
- ✅ Mobile (iOS Safari, Chrome Mobile)
- ✅ Tablettes

## 🔄 Mise à Jour des Données

Les graphiques se mettent automatiquement à jour lorsque :
- De nouveaux trades sont importés
- Des trades existants sont modifiés
- L'événement `trades:updated` est déclenché

## 🛠️ Développement

### Structure des Fichiers

```
frontend/src/
├── pages/
│   └── StatisticsPage.tsx          # Page principale des statistiques
├── components/charts/
│   ├── CapitalEvolutionCascadeChart.tsx  # Graphique en cascade
│   └── WeekdayPerformanceChart.tsx       # Graphique par jour de la semaine
└── services/
    └── trades.ts                   # Services API mis à jour

backend/trades/
└── views.py                       # Nouveaux endpoints ajoutés
```

### Technologies Utilisées

- **Frontend :** React, TypeScript, Chart.js, Tailwind CSS
- **Backend :** Django REST Framework, Python
- **Graphiques :** Chart.js avec Bar et Line charts

## 📈 Exemples de Données

### Évolution du Capital
```json
{
  "date": "12/09/2025",
  "pnl": 2008.80,
  "cumulative": 2008.80,
  "is_positive": true
}
```

### Performance par Jour
```json
{
  "day": "Lundi",
  "total_pnl": 1697.0,
  "trade_count": 6,
  "win_rate": 83.33,
  "average_pnl": 282.83
}
```

---

*Développé avec ❤️ pour améliorer l'analyse des performances de trading*
