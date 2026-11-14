"""Settings autonomes pour la campagne de tests sécurité (aucun .env requis)."""
from datetime import timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = 'account-security-campaign-secret-key-do-not-use-in-prod'
DEBUG = True
ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'testserver']

INSTALLED_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.sites',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'drf_spectacular',
    'guardian',
    'rolepermissions',
    'accounts',
    'trades',
    'daily_journal',
    'billing',
    'trading_activity',
    'integrations',
    'market_data',
    'backtest_journal',
    'channels',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
]

ROOT_URLCONF = 'trading_journal_api.urls'
ASGI_APPLICATION = 'trading_journal_api.asgi.application'
WSGI_APPLICATION = 'trading_journal_api.wsgi.application'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'trading_journal_api' / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': str(BASE_DIR / 'security_campaign.sqlite3'),
        'TEST': {
            'NAME': str(BASE_DIR / 'security_campaign_test.sqlite3'),
        },
    }
}

AUTH_PASSWORD_VALIDATORS = []
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']

LANGUAGE_CODE = 'fr-fr'
TIME_ZONE = 'Europe/Paris'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_TRUSTED_ORIGINS = [
    'http://127.0.0.1:3100',
    'http://localhost:3100',
    'http://127.0.0.1:3000',
    'http://localhost:3000',
]
CORS_ALLOWED_ORIGINS = list(CSRF_TRUSTED_ORIGINS)
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_ORIGINS = False

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'accounts.authentication.BlacklistJWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_THROTTLE_CLASSES': [],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '10000/hour',
        'user': '10000/hour',
        'login': '10000/minute',
        'register': '10000/hour',
        'activate': '10000/hour',
        'password_reset': '10000/hour',
        'password_reset_confirm': '10000/hour',
        'contact': '10000/hour',
        'historical_download': '10000/hour',
    },
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(hours=4),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'TOKEN_OBTAIN_SERIALIZER': 'accounts.serializers.CustomTokenObtainPairSerializer',
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
    'TOKEN_TYPE_CLAIM': 'token_type',
    'JTI_CLAIM': 'jti',
}

SITE_ID = 1
AUTHENTICATION_BACKENDS = (
    'django.contrib.auth.backends.ModelBackend',
    'guardian.backends.ObjectPermissionBackend',
)
ROLEPERMISSIONS_MODULE = 'accounts.roles'
AUTH_USER_MODEL = 'accounts.User'

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'account-security-campaign',
    }
}

CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer',
    }
}

EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
DEFAULT_FROM_EMAIL = 'noreply@test.local'
FRONTEND_URL = 'http://127.0.0.1:3100'

CELERY_BROKER_URL = 'memory://'
CELERY_RESULT_BACKEND = 'cache+memory://'
CELERY_TASK_ALWAYS_EAGER = True

ACCOUNT_AUTH_SECRETS_KEY = 'campaign-test-auth-secrets-key'
TOTP_ISSUER_NAME = 'K&C Trading Journal Test'
INTEGRATIONS_CREDENTIALS_KEY = ''
STRIPE_SECRET_KEY = 'sk_test_campaign'
STRIPE_PUBLISHABLE_KEY = 'pk_test_campaign'
STRIPE_WEBHOOK_SECRET = 'whsec_campaign'
STRIPE_PRICE_PREMIUM_ID = 'price_campaign'

LOGIN_HISTORY_RETENTION_DAYS = 90
LOGIN_HISTORY_MAX_ENTRIES_PER_USER = None


class _DisableMigrations:
    """Évite les SQL PostgreSQL des migrations historiques (campagne SQLite)."""

    def __contains__(self, item):
        return True

    def __getitem__(self, item):
        return None


MIGRATION_MODULES = _DisableMigrations()
