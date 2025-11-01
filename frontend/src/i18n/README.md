# Système de Traduction (i18n)

Ce projet utilise `react-i18next` pour la gestion des traductions.

## Langues supportées

- **Français** (fr)
- **Anglais** (en)
- **Espagnol** (es)
- **Allemand** (de)
- **Italien** (it)
- **Portugais** (pt)
- **Japonais** (ja)
- **Coréen** (ko)
- **Chinois** (zh)

## Structure

```
i18n/
├── config.ts              # Configuration i18next
└── locales/
    ├── fr/
    │   ├── common.json    # Textes communs
    │   ├── trades.json    # Textes liés aux trades
    │   └── settings.json  # Textes des paramètres
    ├── en/
    │   └── ...
    └── ...
```

## Utilisation dans un composant

```typescript
import { useTranslation } from 'react-i18next';

const MyComponent = () => {
  const { t } = useTranslation('common'); // namespace optionnel
  
  return (
    <div>
      <h1>{t('welcome')}</h1>
      <button>{t('save')}</button>
      {/* Avec namespace */}
      <p>{t('trades:title')}</p>
    </div>
  );
};
```

## Hook personnalisé (recommandé)

```typescript
import { useTranslation } from '../hooks/useTranslation';

const MyComponent = () => {
  const { t, language } = useTranslation('common');
  
  return <div>{t('welcome')}</div>;
};
```

## Ajouter une nouvelle traduction

1. Ajouter la clé dans tous les fichiers JSON correspondants
2. Utiliser `t('clé')` dans votre composant

## Exemple

**common.json (fr):**
```json
{
  "deleteConfirm": "Êtes-vous sûr de vouloir supprimer ?"
}
```

**common.json (en):**
```json
{
  "deleteConfirm": "Are you sure you want to delete?"
}
```

**Usage:**
```typescript
const { t } = useTranslation();
if (window.confirm(t('deleteConfirm'))) {
  // supprimer
}
```

