# Guide de Suppression de Compte Utilisateur

Ce guide explique comment supprimer définitivement un compte utilisateur et toutes les données associées dans l'application Trading Journal.

## 🗑️ Fonctionnalité de Suppression

### Vue d'ensemble
La suppression de compte est une fonctionnalité qui permet aux utilisateurs de supprimer définitivement leur compte et toutes les données associées. Cette action est **irréversible**.

### Données Supprimées
Lors de la suppression d'un compte, les éléments suivants sont supprimés :

#### 📊 Données de Trading
- **Tous les trades** importés depuis TopStep
- **Toutes les stratégies** associées aux trades
- **Tous les logs d'import** CSV
- **Toutes les notes** et analyses personnelles

#### 👤 Données Utilisateur
- **Profil utilisateur** complet
- **Informations personnelles** (nom, email, etc.)
- **Préférences** et paramètres
- **Historique d'authentification**

## 🔧 Implémentation Technique

### Backend (Django)
La suppression est gérée par la méthode `delete()` dans `UserProfileView` :

```python
def delete(self, request):
    """
    Supprimer définitivement le compte utilisateur et toutes les données associées
    """
    try:
        user = request.user
        
        # Supprimer tous les modèles associés à l'utilisateur
        from trades.models import TopStepTrade, TopStepImportLog, TradeStrategy
        
        # Supprimer les stratégies de trades (doit être fait avant les trades)
        TradeStrategy.objects.filter(user=user).delete()
        
        # Supprimer tous les trades associés à l'utilisateur
        TopStepTrade.objects.filter(user=user).delete()
        
        # Supprimer les logs d'import
        TopStepImportLog.objects.filter(user=user).delete()
        
        # Supprimer l'utilisateur (cela devrait supprimer en cascade le reste)
        user.delete()
        
        return Response({
            'message': 'Compte supprimé avec succès'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': f'Erreur lors de la suppression du compte: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
```

### Frontend (React)
La suppression est accessible depuis le profil utilisateur :

1. **Accès** : Cliquer sur le bouton "Profil" dans le header
2. **Navigation** : Aller dans la section "Suppression du compte"
3. **Confirmation** : Cliquer sur "Supprimer le compte"
4. **Validation** : Confirmer dans la modale de confirmation

## 🛡️ Sécurité et Validation

### Contrôles de Sécurité
- ✅ **Authentification requise** : Seul l'utilisateur connecté peut supprimer son compte
- ✅ **Confirmation obligatoire** : Double confirmation avant suppression
- ✅ **Messages d'avertissement** : Alertes claires sur l'irréversibilité
- ✅ **Suppression complète** : Toutes les données sont supprimées

### Processus de Suppression
1. **Vérification** de l'authentification
2. **Suppression manuelle** des données liées (stratégies, trades, logs)
3. **Suppression de l'utilisateur** (cascade automatique)
4. **Nettoyage** des tokens et sessions
5. **Redirection** vers la page d'accueil

## 🧪 Tests de Validation

### Script de Test
Un script de test complet est disponible : `backend/test_user_deletion.py`

#### Tests Inclus
- ✅ **Suppression manuelle** : Test de la suppression explicite des données
- ✅ **Suppression en cascade** : Test de la suppression automatique Django
- ✅ **Vérification complète** : Contrôle que toutes les données sont supprimées
- ✅ **Isolation des données** : Vérification qu'aucune donnée ne persiste

#### Exécution des Tests
```bash
cd backend
source venv/bin/activate
python test_user_deletion.py
```

### Résultats Attendus
```
🎉 Tous les tests sont passés avec succès!
✅ La suppression des utilisateurs fonctionne correctement.
```

## ⚠️ Points d'Attention

### Pour les Utilisateurs
- **Irréversible** : La suppression ne peut pas être annulée
- **Sauvegarde** : Exporter vos données avant suppression si nécessaire
- **Confirmation** : Vérifiez bien avant de confirmer la suppression

### Pour les Développeurs
- **Ordre de suppression** : Les stratégies doivent être supprimées avant les trades
- **Gestion d'erreurs** : Capturer et logger les erreurs de suppression
- **Tests réguliers** : Exécuter les tests après chaque modification

## 🔄 Processus de Récupération

### En Cas de Problème
Si un utilisateur signale que ses données sont encore présentes après suppression :

1. **Vérifier les logs** du serveur pour des erreurs
2. **Exécuter les tests** de suppression
3. **Vérifier la base de données** directement
4. **Nettoyer manuellement** si nécessaire

### Nettoyage Manuel
```python
# Dans le shell Django
from django.contrib.auth import get_user_model
from trades.models import TopStepTrade, TopStepImportLog, TradeStrategy

User = get_user_model()
user = User.objects.get(email="user@example.com")

# Supprimer toutes les données
TradeStrategy.objects.filter(user=user).delete()
TopStepTrade.objects.filter(user=user).delete()
TopStepImportLog.objects.filter(user=user).delete()
user.delete()
```

## 📝 Logs et Monitoring

### Logs de Suppression
- **Succès** : "Compte supprimé avec succès"
- **Erreurs** : Détails de l'erreur avec stack trace
- **Données supprimées** : Nombre d'éléments supprimés par type

### Monitoring Recommandé
- Surveiller les tentatives de suppression
- Alerter en cas d'erreurs de suppression
- Tracer les suppressions pour audit

---

*Guide mis à jour le : $(date)*
*Version : 1.0*
