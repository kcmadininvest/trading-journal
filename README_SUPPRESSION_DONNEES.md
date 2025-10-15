# 🗑️ Script de Suppression de Données

## 📋 Description

Ce script permet de supprimer **toutes les données utilisateur** de la base de données de manière sécurisée.

## 🚀 Utilisation

### Méthode 1: Script Bash (Recommandé)
```bash
./run_clear_database.sh
```

### Méthode 2: Script Python Direct
```bash
cd backend
source venv/bin/activate
python ../clear_database_safe.py
```

## ⚠️ ATTENTION

**Ce script supprime TOUTES les données utilisateur de la base de données :**
- ✅ Utilisateurs
- ✅ Trades TopStep
- ✅ Logs d'import
- ✅ Stratégies de trading
- ✅ Tokens JWT (blacklistés et en cours)
- ✅ Sessions Django
- ✅ Logs d'administration

## 🛡️ Sécurité

- **Confirmation requise** : Le script demande de taper "SUPPRIMER" pour confirmer
- **Vérification automatique** : Affiche le nombre d'enregistrements supprimés
- **Gestion des erreurs** : Arrêt en cas de problème
- **Ordre de suppression** : Respecte les contraintes de clés étrangères

## 📊 Dernière Exécution

**Date :** 14 octobre 2025, 22:41
**Données supprimées :**
- 5 utilisateurs
- 63 trades TopStep
- 2 logs d'import
- 9 tokens blacklistés
- 25 tokens en cours

**Résultat :** ✅ Toutes les données supprimées avec succès

## 🔄 Réutilisation

Le script peut être réutilisé à tout moment pour nettoyer la base de données.

---

**⚠️ Faites toujours une sauvegarde avant d'exécuter ce script !**
