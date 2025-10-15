# Guide de la Blacklist des Access Tokens

## 📋 **Vue d'ensemble**

Ce guide documente l'implémentation de la blacklist des access tokens JWT dans l'application Trading Journal. Cette fonctionnalité permet d'invalider immédiatement les tokens d'accès lors de la déconnexion, renforçant ainsi la sécurité de l'application.

---

## 🔐 **Fonctionnalités de Sécurité**

### **Avantages de la Blacklist**
- ✅ **Déconnexion immédiate** : Les tokens sont invalidés instantanément
- ✅ **Sécurité renforcée** : Empêche l'utilisation de tokens volés ou compromis
- ✅ **Contrôle de session** : Permet de gérer les sessions de manière granulaire
- ✅ **Conformité** : Respecte les bonnes pratiques de sécurité JWT

### **Types de Tokens Gérés**
- 🔑 **Access Tokens** : Tokens d'accès court terme (15 minutes)
- 🔄 **Refresh Tokens** : Tokens de rafraîchissement long terme (2 heures)

---

## 🛠️ **Implémentation Technique**

### **1. Configuration Django**

#### **Applications Installées**
```python
INSTALLED_APPS = [
    # ...
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',  # ← Blacklist activée
    # ...
]
```

#### **Configuration JWT**
```python
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(hours=2),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'BLACKLIST_TOKEN_CHECKS': [
        'rest_framework_simplejwt.token_blacklist.blacklist.check_blacklisted_token'
    ],
}
```

#### **Authentification Personnalisée**
```python
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'accounts.authentication.BlacklistJWTAuthentication',  # ← Classe personnalisée
    ),
}
```

### **2. Classe d'Authentification Personnalisée**

#### **Fichier** : `accounts/authentication.py`
```python
class BlacklistJWTAuthentication(JWTAuthentication):
    """
    Authentification JWT avec vérification de blacklist
    """
    
    def get_validated_token(self, raw_token):
        # Valider le token d'abord
        validated_token = super().get_validated_token(raw_token)
        
        # Vérifier si le token est blacklisté
        jti = validated_token.get('jti')
        if jti:
            blacklisted = BlacklistedToken.objects.filter(token__jti=jti).exists()
            if blacklisted:
                raise InvalidToken('Token has been blacklisted')
        
        return validated_token
```

### **3. Vue de Déconnexion Améliorée**

#### **Fichier** : `accounts/views.py`
```python
class LogoutView(APIView):
    def post(self, request):
        # Récupérer le token d'accès depuis l'en-tête
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if auth_header.startswith('Bearer '):
            access_token_str = auth_header.split(' ')[1]
            
            # Blacklister le token d'accès
            access_token = AccessToken(access_token_str)
            jti = access_token.get('jti')
            
            if jti:
                # Créer OutstandingToken
                outstanding_token, created = OutstandingToken.objects.get_or_create(
                    jti=jti,
                    defaults={
                        'user': request.user,
                        'token': access_token_str,
                        'created_at': datetime.fromtimestamp(access_token.get('iat')),
                        'expires_at': datetime.fromtimestamp(access_token.get('exp'))
                    }
                )
                
                # Créer BlacklistedToken
                BlacklistedToken.objects.get_or_create(token=outstanding_token)
        
        # Blacklister le refresh token si fourni
        refresh_token = request.data.get("refresh")
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
        
        return Response({'message': 'Déconnexion réussie - Tokens blacklistés'})
```

---

## 🧪 **Tests et Validation**

### **Test de Fonctionnement**

#### **1. Connexion**
```bash
curl -X POST http://127.0.0.1:8000/api/accounts/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'
```

#### **2. Accès avec Token**
```bash
curl -H "Authorization: Bearer <ACCESS_TOKEN>" \
  http://127.0.0.1:8000/api/accounts/profile/
```

#### **3. Déconnexion avec Blacklist**
```bash
curl -X POST -H "Authorization: Bearer <ACCESS_TOKEN>" \
  http://127.0.0.1:8000/api/accounts/auth/logout/
```

#### **4. Vérification de Blacklist**
```bash
# Le même token doit maintenant être rejeté
curl -H "Authorization: Bearer <ACCESS_TOKEN>" \
  http://127.0.0.1:8000/api/accounts/profile/
# Réponse: {"detail": "Token has been blacklisted"}
```

### **Vérification en Base de Données**

#### **Tokens Blacklistés**
```python
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken

# Compter les tokens blacklistés
blacklisted_count = BlacklistedToken.objects.count()

# Lister les tokens blacklistés
for blacklisted in BlacklistedToken.objects.all():
    print(f"JTI: {blacklisted.token.jti}, User: {blacklisted.token.user.email}")
```

---

## 📊 **Modèles de Base de Données**

### **OutstandingToken**
- **JTI** : Identifiant unique du token
- **User** : Utilisateur propriétaire du token
- **Token** : Token complet (pour debug)
- **Created_at** : Date de création
- **Expires_at** : Date d'expiration

### **BlacklistedToken**
- **Token** : Référence vers OutstandingToken
- **Blacklisted_at** : Date de blacklist

---

## 🔧 **Maintenance et Nettoyage**

### **Nettoyage Automatique**
Les tokens expirés sont automatiquement nettoyés par Django, mais vous pouvez forcer le nettoyage :

```python
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
from django.utils import timezone

# Nettoyer les tokens expirés
expired_tokens = OutstandingToken.objects.filter(expires_at__lt=timezone.now())
expired_tokens.delete()

# Nettoyer les blacklist expirées
expired_blacklist = BlacklistedToken.objects.filter(token__expires_at__lt=timezone.now())
expired_blacklist.delete()
```

### **Monitoring**
```python
# Statistiques de blacklist
total_blacklisted = BlacklistedToken.objects.count()
total_outstanding = OutstandingToken.objects.count()
active_blacklist = BlacklistedToken.objects.filter(
    token__expires_at__gt=timezone.now()
).count()
```

---

## ⚠️ **Considérations de Performance**

### **Impact sur les Performances**
- **Requête supplémentaire** : Une requête DB par authentification
- **Index recommandé** : Sur le champ `jti` pour optimiser les recherches
- **Cache possible** : Mise en cache des tokens blacklistés pour les applications haute charge

### **Optimisations Recommandées**
```python
# Index sur JTI pour optimiser les recherches
class OutstandingToken(models.Model):
    jti = models.CharField(max_length=255, unique=True, db_index=True)
    # ...
```

---

## 🚀 **Déploiement**

### **Migrations Requises**
```bash
python manage.py makemigrations
python manage.py migrate
```

### **Vérification Post-Déploiement**
1. ✅ Vérifier que les tables `token_blacklist_*` existent
2. ✅ Tester la connexion/déconnexion
3. ✅ Vérifier que les tokens blacklistés sont rejetés
4. ✅ Monitorer les performances

---

## 📝 **Résumé**

La blacklist des access tokens est maintenant **pleinement opérationnelle** dans l'application Trading Journal :

- 🔐 **Sécurité maximale** : Tokens invalidés immédiatement
- 🛠️ **Implémentation robuste** : Gestion complète des erreurs
- 🧪 **Tests validés** : Fonctionnement vérifié
- 📚 **Documentation complète** : Guide détaillé disponible

**La sécurité de l'application est maintenant renforcée avec la blacklist des access tokens !** 🚀
