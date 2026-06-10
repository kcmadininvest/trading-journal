# Backend Django

## Apps installées

Déclarées dans `backend/trading_journal_api/settings.py` (`INSTALLED_APPS`) :

| App | Rôle |
|-----|------|
| `accounts` | Utilisateurs, JWT, préférences, sessions, admin système, contact |
| `trades` | Comptes, trades, stratégies, objectifs, exports, replay, calculateur, dashboard |
| `daily_journal` | Entrées journal quotidien et images |
| `billing` | Abonnements Stripe, webhooks, permissions Premium |
| `trading_activity` | Dépenses, crédits, paiements fiscaux (activité pro) |
| `integrations` | Connexions API broker, cotations marché, WebSockets |

Apps tierces notables : `rest_framework`, `rest_framework_simplejwt`, `channels`, `daphne`, `guardian`, `rolepermissions`, `drf_spectacular`, `corsheaders`.

## Routage API

Préfixe racine : `backend/trading_journal_api/urls.py`

```
/api/health/                    # sonde minimale (rate-limited)
/api/accounts/                  # auth, profil, admin, intégrations
/api/trades/                    # métier trading
/api/daily-journal/             # journal quotidien
/api/billing/                   # Stripe
/api/trading-activity/          # comptabilité activité
/schema/, /docs/                # OpenAPI (restreint hors DEBUG)
```

### `accounts` — `backend/accounts/urls.py`

- **Auth** : `auth/login/`, `auth/refresh/`, `auth/logout/`, `auth/register/`
- **Activation** : `auth/activate/<uuid>/`, `auth/resend-activation/`
- **Profil** : `profile/`, `profile/change-password/`, `preferences/`, `permissions/`
- **Sessions** : `session/info/`, `session/extend/`, `sessions/`, `login-history/`
- **Admin** : `admin/users/`, `admin/stats/`, `admin/system/*`
- **Intégrations** : `integrations/` (délègue à `integrations.urls`)

### `trades` — `backend/trades/urls.py`

ViewSets et endpoints dédiés :

- ViewSets : comptes, trades, transactions, stratégies, objectifs, templates d'export, sessions replay
- Endpoints agrégés : `dashboard-summary/`, `dashboard-activity-summary/`
- Marché : `market-holidays/`, `market-quotes/`, `fx-rates/`
- Calculateur : `calculator/position-size/`, `calculator/risk-reward/`, etc.

Fichiers volumineux : `trades/views.py`, `trades/models.py`, `trades/risk_metrics.py`.

### `billing` — `backend/billing/`

- Checkout Session Stripe, portail client
- Webhook idempotent (`StripeWebhookEvent`)
- Permission `IsPremiumBundleSubscriberOrAdmin` dans `billing/permissions.py`
- Singleton `BillingPlatformSettings` (durée d'essai configurable)

### `integrations` — `backend/integrations/`

- Modèle `UserApiIntegration` (credentials chiffrés)
- Registry de providers : `integrations/providers/registry.py`
- Provider actif : **TopStepX** (`integrations/providers/topstepx.py`)
- Services : `market_quotes_service.py`, `fx_rates_service.py`, `credentials_crypto.py`

## ASGI et WebSockets

`backend/trading_journal_api/asgi.py` :

```python
ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': URLRouter(websocket_urlpatterns),
})
```

Route WebSocket : `ws/market-quotes/` → `MarketQuotesConsumer` (`integrations/consumers.py`).

En production, **Daphne** remplace `runserver` pour servir HTTP et WebSocket sur le même processus ASGI.

## REST Framework

Configuration dans `settings.py` :

- Auth par défaut : `accounts.authentication.BlacklistJWTAuthentication`
- Permission par défaut : `IsAuthenticated`
- Pagination : `trades.pagination.CustomPageNumberPagination`
- Schéma OpenAPI : `drf_spectacular`

## Celery

- Broker : Redis (`CELERY_BROKER_URL`)
- Tâches billing : `backend/billing/tasks.py` (post-traitement webhook)
- Usage limité ; la majorité du métier est synchrone dans les vues DRF

## Cache

- Backend : `django-redis` sur Redis
- Utilisé pour : rate limiting (`api_health`), cache métier (soldes compte, cotations), sessions

## Fichiers média

- `MEDIA_ROOT` : uploads (screenshots stratégies, images journal, etc.)
- Servis en dev via `static()` ; en prod via Apache ou Django selon config

## Tests

- Emplacement : `*/tests/test_*.py`, `billing/tests.py`
- Commande : `python manage.py test <module> --keepdb` (schéma test dédié via `settings_test`)

## Voir aussi

- [04-modele-donnees.md](04-modele-donnees.md) — entités ORM
- [05-integrations.md](05-integrations.md) — brokers et marché
- [06-securite-auth.md](06-securite-auth.md) — JWT et permissions
