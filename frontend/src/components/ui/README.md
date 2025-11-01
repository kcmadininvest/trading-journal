# Système de Tooltips Moderne

Ce projet utilise un système de tooltips moderne et réutilisable pour améliorer l'expérience utilisateur.

## Composants disponibles

### 1. Tooltip de base

```tsx
import { Tooltip } from '../components/ui';

<Tooltip content="Votre texte ici" position="top">
  <button>Mon bouton</button>
</Tooltip>
```

**Props :**
- `content` (string) : Le texte à afficher dans le tooltip
- `position` ('top' | 'bottom' | 'left' | 'right') : Position du tooltip (défaut: 'top')
- `delay` (number) : Délai avant affichage en ms (défaut: 300)
- `disabled` (boolean) : Désactiver le tooltip
- `className` (string) : Classes CSS supplémentaires

### 2. ButtonWithTooltip

```tsx
import { ButtonWithTooltip } from '../components/ui';

<ButtonWithTooltip 
  tooltip="Mon tooltip"
  variant="primary"
  size="md"
  onClick={handleClick}
>
  Mon bouton
</ButtonWithTooltip>
```

**Props :**
- Toutes les props de `Tooltip`
- `variant` ('primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'ghost')
- `size` ('sm' | 'md' | 'lg')
- `icon` (ReactNode) : Icône à afficher
- Toutes les props de `button` HTML

### 3. Hook useTooltip

```tsx
import { useTooltip, useActionTooltips } from '../hooks/useTooltip';

// Tooltip personnalisé
const tooltipProps = useTooltip({
  content: 'Mon tooltip',
  position: 'bottom',
  delay: 500
});

// Tooltips d'actions courantes
const actionTooltips = useActionTooltips();
```

## Exemples d'utilisation

### Boutons d'action avec tooltips

```tsx
import { Tooltip } from '../components/ui';

<div className="flex space-x-2">
  <Tooltip content="Modifier" position="top">
    <button className="btn-edit">✏️</button>
  </Tooltip>
  
  <Tooltip content="Supprimer" position="top">
    <button className="btn-delete">🗑️</button>
  </Tooltip>
</div>
```

### Boutons avec variants

```tsx
import { ButtonWithTooltip } from '../components/ui';

<ButtonWithTooltip 
  tooltip="Sauvegarder les modifications"
  variant="success"
  icon={<SaveIcon />}
  onClick={handleSave}
>
  Sauvegarder
</ButtonWithTooltip>
```

### Tooltips conditionnels

```tsx
<Tooltip 
  content={isActive ? 'Désactiver' : 'Activer'}
  disabled={!canToggle}
>
  <button onClick={toggleStatus}>
    {isActive ? '⏸️' : '▶️'}
  </button>
</Tooltip>
```

## Caractéristiques

- ✅ **Positionnement intelligent** : Évite les débordements d'écran
- ✅ **Responsive** : S'adapte à la taille de l'écran
- ✅ **Accessible** : Support clavier et screen readers
- ✅ **Animations fluides** : Transitions CSS smooth
- ✅ **Performance** : Délai configurable pour éviter les tooltips intempestifs
- ✅ **Thème cohérent** : Style uniforme dans toute l'application

## Bonnes pratiques

1. **Contenu concis** : Gardez les tooltips courts et informatifs
2. **Position cohérente** : Utilisez la même position pour des actions similaires
3. **Délai approprié** : 300ms pour les actions courantes, plus long pour les informations détaillées
4. **Accessibilité** : Toujours fournir un tooltip pour les boutons sans texte
5. **Mobile** : Les tooltips sont automatiquement optimisés pour les écrans tactiles
