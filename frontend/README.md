# Trading Journal - Frontend

Frontend React + TypeScript pour l'application de journal de trading.

## 🚀 Démarrage Rapide

```bash
# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env

# Lancer le serveur de développement
npm start
```

L'application sera accessible sur http://localhost:3000

## 📁 Structure

```
frontend/
├── src/
│   ├── components/      # Composants réutilisables
│   │   ├── Layout/      # Layout de l'app
│   │   ├── Trade/       # Composants liés aux trades
│   │   └── UI/          # Composants UI génériques
│   ├── pages/           # Pages de l'application
│   │   ├── Dashboard/   # Tableau de bord
│   │   ├── Trades/      # Gestion des trades
│   │   ├── Login/       # Connexion
│   │   └── Register/    # Inscription
│   ├── services/        # Services API
│   │   ├── api.ts       # Configuration Axios
│   │   ├── auth.ts      # Services d'authentification
│   │   └── trades.ts    # Services de trades
│   ├── hooks/           # Hooks React personnalisés
│   │   ├── useAuth.ts   # Hook d'authentification
│   │   └── useTrades.ts # Hook pour les trades
│   ├── contexts/        # Contextes React
│   │   └── AuthContext.tsx
│   ├── types/           # Types TypeScript
│   │   └── index.ts
│   ├── utils/           # Utilitaires
│   │   ├── format.ts    # Formatage
│   │   └── validation.ts
│   ├── App.tsx          # Composant principal
│   └── index.tsx        # Point d'entrée
├── public/              # Fichiers statiques
└── package.json         # Dépendances
```

## 🎨 Technologies

- **React 18** : Bibliothèque UI
- **TypeScript** : Typage statique
- **Tailwind CSS** : Framework CSS
- **React Router** : Navigation
- **Axios** : Client HTTP
- **TanStack Query** : Gestion d'état serveur
- **Recharts** : Graphiques
- **React Hot Toast** : Notifications
- **date-fns** : Manipulation de dates

## 🔧 Scripts Disponibles

```bash
npm start        # Démarre le serveur de développement
npm test         # Lance les tests
npm run build    # Build de production
npm run eject    # Eject de CRA (non réversible)
```

## 🌐 Variables d'Environnement

```env
REACT_APP_API_URL=http://localhost:8000
REACT_APP_API_BASE_URL=http://localhost:8000/api
```

## 📱 Fonctionnalités

- ✅ Authentification (Login/Register)
- ✅ Gestion des trades (CRUD)
- ✅ Tableau de bord avec statistiques
- ✅ Graphiques de performance
- ✅ Filtres et recherche
- ✅ Interface responsive
- ✅ Mode sombre (à venir)

## 🎯 Composants Principaux

### Layout
- `Header` : En-tête avec navigation
- `Sidebar` : Menu latéral
- `Footer` : Pied de page

### Trade
- `TradeList` : Liste des trades
- `TradeForm` : Formulaire de trade
- `TradeCard` : Carte de trade
- `TradeDetail` : Détails d'un trade

### Dashboard
- `Statistics` : Statistiques globales
- `PerformanceChart` : Graphique de performance
- `RecentTrades` : Trades récents

## 🔐 Authentification

L'authentification utilise JWT stocké dans le localStorage :

```typescript
// Login
const response = await api.post('/token/', credentials);
localStorage.setItem('access_token', response.data.access);
localStorage.setItem('refresh_token', response.data.refresh);

// Utilisation automatique dans les requêtes
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

## 🧪 Tests

```bash
npm test
```

## 📦 Build

```bash
npm run build
```

Les fichiers de production seront dans le dossier `build/`.

## 🚀 Déploiement

1. Build de production : `npm run build`
2. Servir les fichiers statiques avec Nginx, Apache, ou un CDN
3. Configurer les variables d'environnement de production

## 🤝 Contribution

Les contributions sont les bienvenues !

## 📝 Notes

- L'application nécessite que le backend soit lancé
- Par défaut, l'API backend doit être sur http://localhost:8000
- Tailwind CSS est configuré avec des couleurs personnalisées
