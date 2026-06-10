# Architecture technique — K&C Trading Journal

Documentation d'architecture du projet. Ce dossier décrit la structure, les flux et les choix techniques sans remplacer les guides opérationnels existants dans [`docs/`](../).

## Sommaire

| Document | Contenu |
|----------|---------|
| [01-vue-ensemble.md](01-vue-ensemble.md) | Stack, principes, diagramme global |
| [02-backend.md](02-backend.md) | Apps Django, API REST, ASGI, Celery |
| [03-frontend.md](03-frontend.md) | React, navigation, services, i18n |
| [04-modele-donnees.md](04-modele-donnees.md) | Entités métier et relations |
| [05-integrations.md](05-integrations.md) | Brokers, cotations marché, WebSockets |
| [06-securite-auth.md](06-securite-auth.md) | JWT, permissions, billing, chiffrement |
| [07-infrastructure.md](07-infrastructure.md) | Déploiement, services, cache, files |
| [08-preparation-cession.md](08-preparation-cession.md) | Checklist avant cession / vente du code |

## Documentation connexe

- [BACKEND_SETUP.md](../BACKEND_SETUP.md) — installation backend
- [DATABASE_CONFIG.md](../DATABASE_CONFIG.md) — configuration PostgreSQL
- [DEPLOYMENT_PRODUCTION_PLAN.md](../DEPLOYMENT_PRODUCTION_PLAN.md) — plan de déploiement
- [DEPLOYMENT_DIRECT.md](../DEPLOYMENT_DIRECT.md) — déploiement sans conteneur
- [STRIPE_SETUP.md](../STRIPE_SETUP.md) — facturation
- [EXPORT_FEATURE.md](../EXPORT_FEATURE.md) — exports PDF/Excel

## Conventions

- Les chemins de fichiers sont relatifs à la racine du dépôt (`trading_journal/`).
- Les schémas Mermaid sont lisibles dans GitHub et la plupart des éditeurs Markdown.
- Cette documentation reflète l'état du code au tag **v4.4.x** ; vérifier le code source en cas de divergence.
