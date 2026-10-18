"""Settings du process Playwright. Même base de qualification, jamais la production.

Dérivé de settings (schéma DB_SCHEMA), pas de settings_test qui force public.
"""
from .settings import *  # noqa: F401,F403

if not DEBUG:  # noqa: F405
    raise RuntimeError('settings_e2e exige DEBUG=True.')

_stripe = str(STRIPE_SECRET_KEY or '')  # noqa: F405
if _stripe.startswith('sk_live'):
    raise RuntimeError('settings_e2e refuse une clé Stripe live.')

_db = DATABASES['default']  # noqa: F405
_name = str(_db.get('NAME') or '')
if _name in {'trading_journal_prod'} or _name.endswith('_prod'):
    raise RuntimeError(f'settings_e2e refuse la base de production ({_name}).')
if _name != 'portfolio':
    raise RuntimeError(f'settings_e2e : base « {_name} », attendu « portfolio ».')

_options = (_db.get('OPTIONS') or {}).get('options', '') or ''
if 'search_path=trading_journal' not in _options.replace(' ', ''):
    raise RuntimeError('settings_e2e : search_path attendu « trading_journal ».')

_e2e_origins = list(CORS_ALLOWED_ORIGINS)  # noqa: F405
for _origin in ('http://127.0.0.1:3100', 'http://localhost:3100'):
    if _origin not in _e2e_origins:
        _e2e_origins.append(_origin)
CORS_ALLOWED_ORIGINS = _e2e_origins

_csrf = list(CSRF_TRUSTED_ORIGINS)  # noqa: F405
for _origin in ('http://127.0.0.1:3100', 'http://localhost:3100'):
    if _origin not in _csrf:
        _csrf.append(_origin)
CSRF_TRUSTED_ORIGINS = _csrf

E2E_EXPECTED_DB_NAME = 'portfolio'
E2E_EXPECTED_DB_SCHEMA = 'trading_journal'
E2E_TEST_USERNAME = 'e2e'
E2E_TEST_EMAIL = 'e2e@localhost'
E2E_SOURCE_USERNAME = 'csylvanie'
E2E_MARKET_DATA_SOURCE_USERNAME = 'csylvanie'
E2E_MARKET_DATA_READ_ONLY = True
