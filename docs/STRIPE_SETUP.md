# Configuration Stripe (Abonnement Premium)

Ce guide explique comment configurer Stripe pour le flux d'abonnement Premium du projet (Django + DRF + React), avec un focus sur le webhook.

## 1) Variables d'environnement backend

Configurer dans votre `.env` backend:

```env
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PREMIUM_ID=price_xxx
```

## 2) Où récupérer chaque valeur

- `STRIPE_SECRET_KEY`
  - Stripe Dashboard -> Developers -> API keys -> Secret key (`sk_test_...` en test, `sk_live_...` en prod).
- `STRIPE_PUBLISHABLE_KEY`
  - Stripe Dashboard -> Developers -> API keys -> Publishable key (`pk_test_...` / `pk_live_...`).
- `STRIPE_PRICE_PREMIUM_ID`
  - Stripe Dashboard -> Product catalog -> Produit Premium -> Price (`price_...`).
- `STRIPE_WEBHOOK_SECRET`
  - Stripe Dashboard -> Developers -> Webhooks -> endpoint -> Signing secret (`whsec_...`).

## 3) Choix Stripe Connect

Pour ce projet, choisir **"Votre compte"** (pas "Comptes connectés et v2").

Le mode "Comptes connectés" concerne Stripe Connect (marketplace / comptes vendeurs), ce qui n'est pas le cas ici.

## 4) Événements webhook à sélectionner

Sélectionner exactement ces événements:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

## 5) URL endpoint webhook

Endpoint backend attendu:

`/api/billing/webhook/`

Exemples:

- En environnement public (staging/prod): `https://<votre-domaine>/api/billing/webhook/`
- En local via Stripe CLI: `http://localhost:8000/api/billing/webhook/`

## 6) Localhost: configuration recommandée

Stripe Dashboard ne peut pas appeler directement `localhost` sans tunnel public.

Utiliser Stripe CLI:

```bash
stripe login
stripe listen --forward-to localhost:8000/api/billing/webhook/
```

La commande `listen` affiche un `whsec_...` local. C'est cette valeur qu'il faut mettre dans `STRIPE_WEBHOOK_SECRET` en local.

Important: le `whsec` local (CLI) et le `whsec` prod (Dashboard) sont différents.

## 7) Pourquoi le webhook est indispensable

Le webhook est la source fiable pour synchroniser l'état d'abonnement côté backend:

- fin de checkout,
- passage en trialing/active,
- annulation,
- échec de paiement.

Sans webhook, l'accès Premium peut devenir incohérent (ex: paiement échoué mais accès non révoqué).

## 8) Payment Link vs Checkout Session

Le projet utilise **Checkout Session** (création côté backend), ce qui donne plus de contrôle:

- association à l'utilisateur (`user_id`),
- gestion de l'essai (trial),
- règles métier centralisées.

`Payment Link` n'est pas requis ici.

## 9) Vérifications après configuration

1. Redémarrer le backend après modification du `.env`.
2. Vérifier que `stripe` est installé dans le venv backend:
   - `python -c "import stripe; print('ok')"`
3. Appeler `GET /api/billing/subscription/`:
   - `checkout_enabled` doit être `true` si clés/price configurés.
4. Tester un checkout Stripe en mode test.
5. Vérifier que les webhooks arrivent en `200`.

## 10) Erreurs fréquentes

- `Stripe SDK is not installed`
  - installer le package `stripe` dans le venv.
- `Paiement indisponible` côté front
  - `STRIPE_SECRET_KEY` ou `STRIPE_PRICE_PREMIUM_ID` absent/invalide,
  - backend non redémarré après mise à jour `.env`.
- Signature webhook invalide
  - mauvais `STRIPE_WEBHOOK_SECRET` (local vs prod confondu).

## 11) Production

- Utiliser des clés `*_live`.
- Créer un endpoint webhook public dédié production.
- Renseigner le `whsec_live` correspondant.
- Vérifier que le déploiement installe bien `backend/requirements.txt` (incluant `stripe`).

