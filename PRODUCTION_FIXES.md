# 🔧 Corrections de Production - Trading Journal

## 📋 Récapitulatif des corrections appliquées

Ce document répertorie toutes les corrections effectuées en production et comment les maintenir dans le code de développement.

---

## ✅ **Corrections déjà appliquées dans le code de développement**

### 1. **Configuration WSGI** ✅
- **Fichier** : `backend/trading_journal_api/wsgi.py`
- **Correction** : `trading_journal_api.settings` (déjà correct)
- **Statut** : ✅ Appliqué

### 2. **URLs Django avec préfixe /api/** ✅
- **Fichier** : `backend/trading_journal_api/urls.py`
- **Correction** : Toutes les URLs ont le préfixe `/api/`
- **Statut** : ✅ Appliqué

### 3. **Configuration API Frontend** ✅
- **Fichier** : `frontend/src/services/api.ts`
- **Correction** : Plus de port 8000, utilisation de `/api`
- **Statut** : ✅ Appliqué

### 4. **Configuration Apache** ✅
- **Fichier** : `apache/trading-journal.conf`
- **Corrections** :
  - Configuration WSGI avec daemon séparé
  - Alias pour fichiers statiques React
  - Headers de sécurité complets
  - Certificats SSL Let's Encrypt
- **Statut** : ✅ Appliqué

---

## 🚀 **Script de déploiement automatisé**

Un script `deploy.sh` a été créé pour automatiser toutes les corrections lors des prochaines mises en production :

```bash
# Exécuter le script de déploiement
./deploy.sh
```

### **Ce que fait le script :**
1. 🔧 Compile le frontend React
2. 🔄 Synchronise les templates Django
3. 🔍 Vérifie la configuration WSGI
4. 🌐 Met à jour la configuration Apache
5. 👤 Corrige les permissions (apache:apache)
6. 🔄 Redémarre Apache
7. 🧹 Applique les migrations Django
8. 📊 Collecte les fichiers statiques
9. 🔍 Effectue des vérifications finales

---

## 📝 **Procédure de mise en production**

### **Avant chaque déploiement :**

1. **Tester en local** :
   ```bash
   cd frontend && npm run build
   cd ../backend && python manage.py runserver
   ```

2. **Vérifier les changements** :
   ```bash
   git status
   git diff
   ```

3. **Exécuter le script de déploiement** :
   ```bash
   ./deploy.sh
   ```

### **Vérifications post-déploiement :**

1. **Frontend** : https://app.kcmadininvest.fr
2. **API** : https://app.kcmadininvest.fr/api/
3. **Admin** : https://app.kcmadininvest.fr/admin/
4. **Logs Apache** : `/var/log/httpd/trading-journal_https_error.log`

---

## 🔍 **Points de vigilance**

### **⚠️ Ne jamais oublier :**

1. **Recompiler le frontend** après modification des fichiers source
2. **Synchroniser les templates** Django avec le build React
3. **Vérifier les permissions** (apache:apache)
4. **Redémarrer Apache** après modifications de configuration

### **🔧 Commandes utiles :**

```bash
# Recompiler le frontend
cd frontend && npm run build

# Synchroniser les templates
cp frontend/build/index.html backend/trading_journal_api/templates/index.html

# Corriger les permissions
chown -R apache:apache /var/www/html/trading_journal

# Redémarrer Apache
systemctl reload httpd

# Vérifier les logs
tail -f /var/log/httpd/trading-journal_https_error.log
```

---

## 🎯 **Configuration finale de production**

### **✅ HTTPS sécurisé**
- Certificat SSL Let's Encrypt valide
- Redirection automatique HTTP → HTTPS
- Headers de sécurité complets (HSTS, CSP, etc.)

### **✅ Frontend React fonctionnel**
- Application compilée et servie correctement
- Fichiers statiques (JS/CSS) accessibles
- URLs API corrigées (plus de port 8000)

### **✅ Backend Django/DRF opérationnel**
- API accessible via `/api/`
- Endpoints d'authentification fonctionnels
- Configuration WSGI correcte

### **✅ Configuration Apache optimisée**
- VirtualHosts HTTP et HTTPS configurés
- Routage API et fichiers statiques séparés
- Permissions correctes (propriétaire Apache)

---

## 📚 **Ressources**

- **Documentation Django** : https://docs.djangoproject.com/
- **Documentation Apache** : https://httpd.apache.org/docs/
- **Let's Encrypt** : https://letsencrypt.org/
- **React Build** : https://create-react-app.dev/docs/production-build/

---

*Dernière mise à jour : $(date)*
*Version : 1.0.0*
*Statut : ✅ Toutes les corrections appliquées*
