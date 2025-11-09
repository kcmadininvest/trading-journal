from django.apps import AppConfig


class TradesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'trades'
    
    def ready(self):
        """Enregistre les signals quand l'application est prête."""
        import trades.signals  # noqa