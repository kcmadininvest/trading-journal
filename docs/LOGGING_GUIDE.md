# Système de Logging Conditionnel

## Vue d'ensemble

Le système de logging conditionnel permet d'afficher les logs en développement tout en les masquant automatiquement en production. Il inclut une interface de contrôle pour activer/désactiver les logs dynamiquement.

## Utilisation

### 1. Dans un composant React

```typescript
import { useLogger } from '../hooks/useLogger';

function MonComposant() {
  const logger = useLogger('MonComposant');
  
  useEffect(() => {
    logger.debug('Composant monté');
    logger.info('Données chargées');
    logger.warn('Attention: données partielles');
    logger.error('Erreur de chargement:', error);
  }, []);
}
```

### 2. Dans un service

```typescript
import { log } from '../utils/logger';

export const monService = {
  async fetchData() {
    log.debug('Début du chargement des données');
    try {
      const data = await api.get('/endpoint');
      log.info('Données chargées avec succès');
      return data;
    } catch (error) {
      log.error('Erreur lors du chargement:', error);
      throw error;
    }
  }
};
```

### 3. Logs spécialisés

```typescript
import { log } from '../utils/logger';

// Logs d'API
log.api('/users', 'Requête GET réussie');

// Logs d'authentification
log.auth('Token expiré, rafraîchissement en cours');

// Logs de cache
log.cache('Données mises en cache pour 5 minutes');
```

## Niveaux de log

- **DEBUG** : Informations détaillées (masquées en production)
- **INFO** : Informations générales (masquées en production)
- **WARN** : Avertissements (masquées en production)
- **ERROR** : Erreurs (toujours affichées)

## Contrôles de debug

En développement, un panneau de contrôle apparaît en bas à droite avec :

- **ON/OFF** : Active/désactive les logs
- **Clear** : Vide la console
- **État** : Affiche l'environnement et l'état des logs

## Configuration

### Variables d'environnement

- `NODE_ENV=development` : Logs activés par défaut
- `NODE_ENV=production` : Logs masqués (sauf erreurs)

### localStorage

- `debug_logs=true` : Force l'activation des logs
- `debug_logs=false` : Force la désactivation des logs

## Migration depuis console.log

### Avant
```typescript
console.log('Debug info');
console.warn('Warning message');
console.error('Error:', error);
```

### Après
```typescript
logger.debug('Debug info');
logger.warn('Warning message');
logger.error('Error:', error);
```

## Bonnes pratiques

1. **Utilisez le bon niveau** : debug pour le développement, error pour les erreurs critiques
2. **Préfixez les messages** : Le hook useLogger ajoute automatiquement le nom du composant
3. **Évitez les logs en production** : Le système les masque automatiquement
4. **Utilisez les logs spécialisés** : api, auth, cache pour une meilleure organisation
5. **Nettoyez la console** : Utilisez le bouton Clear du panneau de contrôle

## Exemples d'utilisation

### Composant avec chargement de données
```typescript
const logger = useLogger('DataComponent');

useEffect(() => {
  logger.debug('Début du chargement des données');
  
  fetchData()
    .then(data => {
      logger.info(`${data.length} éléments chargés`);
      setData(data);
    })
    .catch(error => {
      logger.error('Erreur de chargement:', error);
      setError(error);
    });
}, []);
```

### Service avec gestion d'erreurs
```typescript
export const apiService = {
  async get(endpoint: string) {
    log.api(endpoint, 'Début de la requête');
    
    try {
      const response = await fetch(endpoint);
      log.api(endpoint, `Réponse reçue: ${response.status}`);
      return response;
    } catch (error) {
      log.error(`Erreur API ${endpoint}:`, error);
      throw error;
    }
  }
};
```
