# Guide de Déconnexion Automatique

## 🔐 Vue d'ensemble

Le système de déconnexion automatique (session timeout) est implémenté pour assurer la sécurité de l'application en déconnectant automatiquement les utilisateurs après une période d'inactivité. Ce système suit les bonnes pratiques de sécurité et offre une expérience utilisateur fluide.

## ⚙️ Configuration

### Durées de Session

- **Token d'accès** : 1 heure
- **Token de rafraîchissement** : 4 heures
- **Avertissement** : 10 minutes avant expiration
- **Vérification** : Toutes les 30 secondes

### Configuration JWT

```python
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(hours=4),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
}
```

## 🏗️ Architecture

### Backend

#### 1. Sérialiseur JWT Personnalisé
- **Fichier** : `accounts/serializers.py`
- **Classe** : `CustomTokenObtainPairSerializer`
- **Fonctionnalités** :
  - Ajout d'informations de session au token
  - Calcul des temps d'expiration
  - Gestion des avertissements

#### 2. Endpoints de Session
- **`GET /api/accounts/session/info/`** : Informations de session
- **`POST /api/accounts/session/extend/`** : Extension de session

#### 3. Gestion des Tokens
- Rotation automatique des refresh tokens
- Blacklist des anciens tokens
- Validation stricte des tokens expirés

### Frontend

#### 1. Gestionnaire de Session
- **Fichier** : `services/sessionManager.ts`
- **Fonctionnalités** :
  - Surveillance continue de la session
  - Rafraîchissement automatique des tokens
  - Gestion des avertissements
  - Déconnexion automatique

#### 2. Interface Utilisateur
- **Modal d'avertissement** : `components/auth/SessionWarningModal.tsx`
- **Intégration** : `App.tsx`
- **Fonctionnalités** :
  - Avertissement visuel avant expiration
  - Bouton d'extension de session
  - Compte à rebours en temps réel
  - Barre de progression

## 🔄 Flux de Fonctionnement

### 1. Connexion Utilisateur
```
Utilisateur se connecte
    ↓
Token JWT généré (1 heure)
    ↓
Informations de session stockées
    ↓
Gestionnaire de session initialisé
    ↓
Surveillance active
```

### 2. Surveillance Continue
```
Toutes les 30 secondes
    ↓
Vérification de l'état de la session
    ↓
Token expiré ? → Déconnexion automatique
    ↓
Token expire bientôt ? → Rafraîchissement automatique
    ↓
Avertissement nécessaire ? → Affichage du modal
```

### 3. Avertissement Utilisateur
```
10 minutes avant expiration
    ↓
Modal d'avertissement affiché
    ↓
Utilisateur peut :
    - Étendre la session
    - Ignorer l'avertissement
    ↓
Si pas d'action → Déconnexion automatique
```

### 4. Extension de Session
```
Utilisateur clique "Étendre"
    ↓
Nouveaux tokens générés
    ↓
Session prolongée de 4 heures
    ↓
Modal fermé
    ↓
Surveillance continue
```

## 🛡️ Sécurité

### Bonnes Pratiques Implémentées

1. **Durées de Vie Équilibrées**
   - Token d'accès : 1 heure (équilibre sécurité/UX)
   - Token de rafraîchissement : 4 heures (équilibre sécurité/UX)

2. **Rotation des Tokens**
   - Nouveaux tokens à chaque rafraîchissement
   - Anciens tokens blacklistés
   - Prévention de la réutilisation

3. **Validation Stricte**
   - Vérification de l'expiration
   - Rejet des tokens invalides
   - Déconnexion immédiate si expiré

4. **Surveillance Continue**
   - Vérification toutes les 30 secondes
   - Détection proactive des expirations
   - Gestion des erreurs réseau

### Protection contre les Attaques

- **Session Fixation** : Nouveaux tokens à chaque connexion
- **Token Replay** : Blacklist des anciens tokens
- **Man-in-the-Middle** : Tokens signés avec clé secrète
- **Brute Force** : Limitation des tentatives de connexion

## 🎯 Expérience Utilisateur

### Avertissements Visuels

1. **Avertissement Standard** (5 min avant)
   - Modal jaune avec icône d'attention
   - Message informatif
   - Bouton d'extension disponible

2. **Avertissement Critique** (1 min avant)
   - Modal rouge avec icône d'alerte
   - Message urgent
   - Compte à rebours visible

### Fonctionnalités UX

- **Extension en un clic** : Bouton "Étendre la session"
- **Compte à rebours** : Temps restant affiché en temps réel
- **Barre de progression** : Visualisation de l'expiration
- **Fermeture manuelle** : Possibilité d'ignorer l'avertissement

## 🔧 Configuration Avancée

### Variables d'Environnement

```bash
# Durées de session (optionnel)
JWT_ACCESS_TOKEN_LIFETIME=15  # minutes
JWT_REFRESH_TOKEN_LIFETIME=120  # minutes
JWT_WARNING_TIME=5  # minutes avant expiration
```

### Personnalisation

#### Modifier les Durées
```python
# Dans settings.py
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),  # Plus long
    'REFRESH_TOKEN_LIFETIME': timedelta(hours=4),    # Plus long
}
```

#### Modifier l'Intervalle de Vérification
```typescript
// Dans sessionManager.ts
this.refreshTimer = setInterval(() => {
  if (this.isActive) {
    this.checkSession();
  }
}, 60000); // 1 minute au lieu de 30 secondes
```

## 🧪 Tests

### Tests Manuels

1. **Test d'Expiration**
   ```
   1. Se connecter
   2. Attendre 15 minutes
   3. Vérifier la déconnexion automatique
   ```

2. **Test d'Avertissement**
   ```
   1. Se connecter
   2. Attendre 10 minutes (5 min avant expiration)
   3. Vérifier l'affichage du modal
   4. Tester l'extension de session
   ```

3. **Test de Rafraîchissement**
   ```
   1. Se connecter
   2. Utiliser l'application normalement
   3. Vérifier le rafraîchissement automatique
   ```

### Tests Automatisés

```bash
# Test de l'endpoint de session
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8000/api/accounts/session/info/

# Test d'extension de session
curl -X POST -H "Authorization: Bearer $TOKEN" \
     http://localhost:8000/api/accounts/session/extend/
```

## 📊 Monitoring

### Logs de Session

Le système génère des logs pour :
- Connexions utilisateur
- Expirations de session
- Extensions de session
- Déconnexions automatiques

### Métriques Utiles

- Durée moyenne des sessions
- Nombre d'extensions par utilisateur
- Taux de déconnexions automatiques
- Erreurs de rafraîchissement

## 🚨 Dépannage

### Problèmes Courants

1. **Session expire trop rapidement**
   - Vérifier la configuration JWT
   - Vérifier l'heure système du serveur

2. **Avertissement ne s'affiche pas**
   - Vérifier la console JavaScript
   - Vérifier la connexion réseau

3. **Extension de session échoue**
   - Vérifier la validité du token
   - Vérifier les logs du serveur

### Logs de Debug

```javascript
// Activer les logs détaillés
localStorage.setItem('debug_session', 'true');
```

## 🔮 Évolutions Futures

### Améliorations Possibles

1. **Session Persistante**
   - Option "Se souvenir de moi"
   - Durées de session plus longues

2. **Avertissements Personnalisés**
   - Durées configurables par utilisateur
   - Notifications par email

3. **Analytics Avancées**
   - Dashboard de sessions
   - Alertes de sécurité

4. **Intégration SSO**
   - Support des providers externes
   - Synchronisation des sessions

## 📚 Références

- [JWT Best Practices](https://tools.ietf.org/html/rfc7519)
- [Django REST Framework JWT](https://django-rest-framework-simplejwt.readthedocs.io/)
- [OWASP Session Management](https://owasp.org/www-project-top-ten/2017/A2_2017-Broken_Authentication)
- [React Security Best Practices](https://reactjs.org/docs/security.html)

---

*Guide créé le : 14 octobre 2025*  
*Dernière mise à jour : 14 octobre 2025*
