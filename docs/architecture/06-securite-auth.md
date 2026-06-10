# Sécurité et authentification

## Authentification JWT

- **SimpleJWT** avec refresh token et blacklist (`rest_framework_simplejwt.token_blacklist`)
- Classe custom : `accounts.authentication.BlacklistJWTAuthentication`
- Identifiant utilisateur : **email** (`USERNAME_FIELD = 'email'`)

### Endpoints auth

| Méthode | Route | Action |
|---------|-------|--------|
| POST | `/api/accounts/auth/login/` | Obtenir access + refresh |
| POST | `/api/accounts/auth/refresh/` | Renouveler access token |
| POST | `/api/accounts/auth/logout/` | Blacklister refresh token |
| POST | `/api/accounts/auth/register/` | Inscription |
| GET | `/api/accounts/auth/activate/<uuid>/` | Activation email |

### Throttling

`accounts/throttling.py` — rate limiting sur login, register et endpoints sensibles.

## Mots de passe

- Hasher principal : **Argon2** (`PASSWORD_HASHERS` dans settings)
- Validateurs Django standards (longueur, similarité, mots courants)

## Rôles et permissions

| Mécanisme | Usage |
|-----------|-------|
| `User.role` | `user` ou `admin` |
| `django-role-permissions` | Rôles applicatifs |
| `django-guardian` | Permissions objet sur les trades |
| DRF `IsAuthenticated` | Défaut sur toutes les vues API |

Endpoints d'administration système réservés aux comptes `admin` (préfixe `/api/accounts/admin/`).

## Paywall Premium

### Backend

Permission : `billing.permissions.IsPremiumBundleSubscriberOrAdmin`

Accès Premium si :

1. `AppSettings.premium_restrictions_enabled` est `False` (mode ouvert), **ou**
2. L'utilisateur a un `CustomerSubscription` actif/trialing, **ou**
3. L'utilisateur est admin

Vues protégées (exemples) : statistiques, analytics, stratégies, objectifs, replay, calculateur, activité fiscale.

### Frontend

`PREMIUM_LOCKED_PAGES` dans `App.tsx` — miroir du paywall backend. Le frontend bloque la navigation ; le backend reste la source de vérité (ne jamais se fier au seul gating client).

## Chiffrement credentials broker

`integrations/credentials_crypto.py` — secrets API broker chiffrés au repos (détails d'implémentation dans le code source).

## Configuration production

Activée quand `DEBUG=False` dans `settings.py` :

| Mesure | Détail |
|--------|--------|
| `SECRET_KEY` | Obligatoire |
| `ALLOWED_HOSTS` | Obligatoire |
| `CORS_ALLOWED_ORIGINS` | Liste explicite, pas de wildcard |
| `SECURE_SSL_REDIRECT` | Redirection HTTPS |
| Cookies | `Secure`, `HttpOnly`, `SameSite=Lax` |
| OpenAPI `/docs/` | Réservé aux admins authentifiés |
| `api_health` | Rate limiting par IP |

Headers de sécurité additionnels (HSTS, XSS, etc.) délégués à **Apache** en production.

## Export et confidentialité

- `GET /api/accounts/export-data/` — export des données utilisateur
- Préférences de confidentialité par page dans `UserPreferences`

## Sessions actives

Suivi des sessions JWT actives : `/api/accounts/sessions/` — permet à l'utilisateur de révoquer des sessions.

## Voir aussi

- [STRIPE_SETUP.md](../STRIPE_SETUP.md) — webhooks Stripe
- [03-frontend.md](03-frontend.md) — gating côté client
