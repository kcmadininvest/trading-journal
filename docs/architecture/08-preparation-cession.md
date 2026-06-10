# Préparation à la cession du code

Checklist pour livrer le dépôt à un acquéreur **sans exposer votre infrastructure, vos secrets ni vos utilisateurs**.

## Ce que l'acquéreur doit recevoir

| Livrable | Contenu |
|----------|---------|
| Code source | Dépôt Git (tags SemVer, historique si souhaité) |
| Documentation | `docs/`, dont `docs/architecture/` |
| Config exemple | `.env.example`, `deploy.config.example`, `apache/trading-journal.conf` |
| Scripts | `deploy_production.sh`, unités `systemd/` |

## Ce que vous ne devez jamais transférer

| Élément | Pourquoi |
|---------|----------|
| `backend/.env`, `frontend/.env.production`, `deploy.config` | Secrets, clés API, mots de passe DB |
| Compte Stripe | L'acquéreur crée son propre compte marchand |
| Compte Brevo / email | Idem |
| Base PostgreSQL production | Données personnelles utilisateurs (RGPD) |
| Certificats TLS, clés SSH serveur | Accès à votre infra |
| `backend/media/` | Uploads utilisateurs |
| Logs serveur | Peuvent contenir IP, emails, tokens |

Fournir un **dump anonymisé** ou une base de démo séparée si l'acquéreur demande des données de test.

## Fichiers à vérifier avant livraison

### Priorité haute (identité / infra réelle)

Rechercher et remplacer toute occurrence de :

- Vos domaines de production et sous-domaines réels
- IP serveur ou réseau interne
- Emails personnels ou admin réels
- Chemins absolus liés à **votre** serveur (si non génériques)
- Clés API réelles (Stripe, Brevo, TopStepX)

Commande utile (à lancer depuis la racine du dépôt) :

```bash
rg -i 'sk_live|sk_test|whsec_|@[a-z0-9.-]+\.(fr|com)|172\.|192\.168|10\.' --glob '!node_modules' --glob '!venv' --glob '!.git'
```

### Priorité moyenne (surface d'attaque)

Dans la doc **publique** ou le package de vente, éviter de détailler :

- Rate limits exacts
- Liste exhaustive des endpoints admin
- Mécanisme interne de dérivation des clés de chiffrement
- Identifiants de comptes de test

Le dossier `docs/architecture/` est volontairement sobre sur ces points.

### Priorité basse (acceptable pour une vente technique)

- Stack et versions
- Structure des apps Django / pages React
- Schéma entités métier
- Noms de variables d'environnement (sans valeurs)
- Routes API standard (`/api/accounts/auth/login/`, etc.)

## Actions post-cession (côté vendeur)

1. **Révoquer** toutes les clés présentes dans vos `.env` (Stripe, Brevo, TopStepX, Django `SECRET_KEY`).
2. **Fermer** ou migrer le compte Stripe ; l'acquéreur ne doit pas hériter de vos abonnés sans accord explicite (RGPD + contrat).
3. **Conserver** une preuve de suppression des données utilisateurs si vous ne transférez pas la base.
4. **Retirer** votre accès SSH, deploy keys GitHub, webhooks Stripe pointant vers votre domaine.

## Actions côté acquéreur

1. Générer une nouvelle `SECRET_KEY` Django.
2. Créer base PostgreSQL, Redis, comptes Stripe/Brevo dédiés.
3. Remplacer domaines et URLs dans `.env`, build frontend, Apache.
4. Renommer la marque si la cession n'inclut pas le nom « K&C Trading Journal ».
5. Vérifier licence / cession de droits (le `package.json` racine indique `MIT` — clarifier l'exclusivité dans le contrat de vente).

## Niveau de sensibilité par dossier

| Dossier / fichier | Sensibilité vente | Action |
|-------------------|-------------------|--------|
| `docs/architecture/` | Faible | Livrable tel quel |
| `docs/STRIPE_SETUP.md` | Faible | OK (placeholders `sk_test_xxx`) |
| `docs/DEPLOYMENT_*.md` | Moyenne | Domaines et emails en placeholders |
| `deploy_production.sh` (défauts URL) | Moyenne | Vérifier variables par défaut |
| `backend/.env.example` | Faible | Vérifier emails de démo |
| `apache/trading-journal.conf` | Faible | Chemins génériques OK |
| Code source | Faible | Pas de secrets en dur |

## Contrat de vente (hors code)

Points à traiter légalement, non couverts par ce dépôt :

- Cession des droits d'auteur et de la propriété intellectuelle
- Périmètre de la marque, domaines, réseaux sociaux
- Garantie d'éviction, période de transition technique
- Responsabilité données personnelles (RGPD)
- Non-concurrence, support post-vente

## Voir aussi

- [06-securite-auth.md](06-securite-auth.md) — modèle de sécurité (version allégée)
- [07-infrastructure.md](07-infrastructure.md) — déploiement générique
- [STRIPE_SETUP.md](../STRIPE_SETUP.md) — reconfiguration billing
