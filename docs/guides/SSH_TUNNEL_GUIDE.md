# 🔐 Guide Tunnel SSH - Trading Journal

## Configuration du Tunnel SSH depuis Windows

Pour accéder à votre application Trading Journal depuis votre PC Windows, vous devez créer un tunnel SSH qui redirige les ports locaux.

## 🖥️ Prérequis

- **SSH Client** sur Windows (intégré depuis Windows 10) ou **PuTTY**
- Accès SSH au serveur Linux

## 📡 Ports à Rediriger

- **Port 3000** : Frontend React
- **Port 8000** : Backend Django API
- **Port 5432** : PostgreSQL (optionnel)

## 🚀 Méthode 1 : OpenSSH (Windows 10/11)

### Commande PowerShell / CMD

```powershell
ssh -L 3000:localhost:3000 -L 8000:localhost:8000 username@server_ip
```

**Explication :**
- `-L 3000:localhost:3000` : Redirige le port 3000 local vers le port 3000 du serveur
- `-L 8000:localhost:8000` : Redirige le port 8000 local vers le port 8000 du serveur
- `username` : Votre nom d'utilisateur sur le serveur (probablement `kcmadininvest`)
- `server_ip` : L'adresse IP de votre serveur

### Exemple Complet

```powershell
ssh -L 3000:localhost:3000 -L 8000:localhost:8000 kcmadininvest@192.168.1.100
```

### Garder la Session Active

Pour que le tunnel reste actif, gardez la fenêtre PowerShell ouverte.

### Tunnel en Arrière-Plan (Recommandé)

```powershell
ssh -N -f -L 3000:localhost:3000 -L 8000:localhost:8000 username@server_ip
```

**Options :**
- `-N` : Ne pas exécuter de commande distante
- `-f` : Passer en arrière-plan après authentification

## 🔧 Méthode 2 : PuTTY (Alternative)

### Configuration PuTTY

1. **Télécharger PuTTY** : https://www.putty.org/

2. **Ouvrir PuTTY**

3. **Session** :
   - Host Name : `username@server_ip`
   - Port : `22`
   - Connection type : `SSH`

4. **Connection → SSH → Tunnels** :
   
   **Tunnel 1 (Frontend React) :**
   - Source port : `3000`
   - Destination : `localhost:3000`
   - Cliquez sur **Add**
   
   **Tunnel 2 (Backend Django) :**
   - Source port : `8000`
   - Destination : `localhost:8000`
   - Cliquez sur **Add**

5. **Retourner à Session** :
   - Saved Sessions : `Trading Journal Tunnel`
   - Cliquez sur **Save**

6. **Cliquez sur Open** pour établir la connexion

7. **Gardez la fenêtre PuTTY ouverte** pour maintenir le tunnel actif

## 🌐 Accès depuis Windows

Une fois le tunnel SSH établi, accédez aux applications sur votre PC Windows :

- **Frontend React** : http://localhost:3000
- **Backend API** : http://localhost:8000/api/trades/
- **Admin Django** : http://localhost:8000/admin
- **API Docs** : http://localhost:8000/api/docs

## ✅ Vérification du Tunnel

### Depuis Windows PowerShell

```powershell
# Tester le backend
curl http://localhost:8000/admin/

# Tester le frontend
curl http://localhost:3000/
```

### Avec un Navigateur

Ouvrez simplement http://localhost:3000 dans votre navigateur préféré.

## 🔐 Configuration SSH avec Clé (Recommandé)

Pour éviter de saisir le mot de passe à chaque fois :

### 1. Générer une Clé SSH sur Windows

```powershell
ssh-keygen -t ed25519 -C "votre_email@example.com"
```

Appuyez sur Entrée pour accepter l'emplacement par défaut : `C:\Users\VotreNom\.ssh\id_ed25519`

### 2. Copier la Clé sur le Serveur

```powershell
type C:\Users\VotreNom\.ssh\id_ed25519.pub | ssh username@server_ip "cat >> ~/.ssh/authorized_keys"
```

### 3. Tester la Connexion

```powershell
ssh username@server_ip
```

Vous devriez vous connecter sans mot de passe.

## 🚀 Script PowerShell Automatique

Créez un fichier `start-tunnel.ps1` :

```powershell
# Script pour démarrer le tunnel SSH automatiquement
$SERVER_USER = "kcmadininvest"
$SERVER_IP = "192.168.1.100"  # Remplacez par l'IP de votre serveur

Write-Host "🔐 Démarrage du tunnel SSH..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Frontend React : http://localhost:3000" -ForegroundColor Green
Write-Host "Backend Django : http://localhost:8000" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  Gardez cette fenêtre ouverte pour maintenir le tunnel actif" -ForegroundColor Yellow
Write-Host ""

# Établir le tunnel
ssh -L 3000:localhost:3000 -L 8000:localhost:8000 $SERVER_USER@$SERVER_IP

# Si le tunnel se ferme
Write-Host ""
Write-Host "❌ Tunnel fermé" -ForegroundColor Red
pause
```

### Utilisation du Script

1. Éditez le fichier et mettez à jour `$SERVER_IP`
2. Clic droit → **Exécuter avec PowerShell**
3. Le tunnel s'établit automatiquement

## 📱 Accès depuis un Téléphone/Tablette

Si vous voulez accéder depuis d'autres appareils sur votre réseau local :

### 1. Modifier le Backend Django

Dans `backend/trading_journal_api/settings.py`, ajoutez l'IP de votre PC Windows :

```python
ALLOWED_HOSTS = ['localhost', '127.0.0.1', '192.168.1.xxx']
CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://192.168.1.xxx:3000',
]
```

### 2. Démarrer les Serveurs avec l'IP

```bash
# Backend
python manage.py runserver 0.0.0.0:8000

# Frontend (dans package.json, ajoutez HOST=0.0.0.0)
HOST=0.0.0.0 npm start
```

### 3. Créer un Tunnel avec Redirection d'IP

```powershell
ssh -L 0.0.0.0:3000:localhost:3000 -L 0.0.0.0:8000:localhost:8000 username@server_ip
```

## 🛑 Arrêter le Tunnel

### Méthode 1 : Fermer la Fenêtre

Simplement fermer la fenêtre PowerShell/PuTTY.

### Méthode 2 : Tuer le Processus

```powershell
# Trouver le processus SSH
Get-Process ssh

# Tuer le processus (remplacez XXXX par le PID)
Stop-Process -Id XXXX
```

## 🔍 Dépannage

### Problème : "Connection refused"

**Solution :**
- Vérifiez que les serveurs sont lancés sur le serveur Linux
- Vérifiez le pare-feu du serveur

```bash
# Sur le serveur Linux
netstat -tulpn | grep -E '3000|8000'
```

### Problème : "Port already in use"

**Solution :**
Quelque chose utilise déjà le port sur Windows.

```powershell
# Trouver ce qui utilise le port 3000
netstat -ano | findstr :3000

# Tuer le processus (remplacez XXXX par le PID)
taskkill /PID XXXX /F
```

### Problème : Tunnel se ferme automatiquement

**Solution :**
Ajoutez l'option `-o ServerAliveInterval=60` :

```powershell
ssh -o ServerAliveInterval=60 -L 3000:localhost:3000 -L 8000:localhost:8000 username@server_ip
```

## 🎯 Meilleure Pratique : Utiliser un Config SSH

Créez un fichier `C:\Users\VotreNom\.ssh\config` :

```
Host trading-tunnel
    HostName 192.168.1.100
    User kcmadininvest
    LocalForward 3000 localhost:3000
    LocalForward 8000 localhost:8000
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

Puis connectez-vous simplement avec :

```powershell
ssh trading-tunnel
```

## 📊 Commandes Utiles

### Vérifier les Ports Ouverts sur Windows

```powershell
netstat -an | findstr -E "3000|8000"
```

### Tester la Connexion Backend

```powershell
curl http://localhost:8000/api/docs/
```

### Tester la Connexion Frontend

```powershell
curl http://localhost:3000/
```

## 🌍 Alternative : Utiliser ngrok (Accès Internet)

Si vous voulez un accès depuis n'importe où sans tunnel SSH :

1. Installer ngrok : https://ngrok.com/
2. Sur le serveur Linux :
   ```bash
   ngrok http 3000  # Pour le frontend
   ```
3. Utilisez l'URL fournie (ex: https://xxxx.ngrok.io)

**⚠️ Attention :** Ne pas utiliser en production sans authentification !

## 📚 Ressources

- [Documentation SSH Windows](https://docs.microsoft.com/en-us/windows-server/administration/openssh/openssh_overview)
- [PuTTY Documentation](https://www.chiark.greenend.org.uk/~sgtatham/putty/docs.html)

---

**✨ Tunnel SSH configuré ! Accédez à votre Trading Journal depuis Windows ! 🚀**

