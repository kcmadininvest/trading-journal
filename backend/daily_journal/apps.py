from django.apps import AppConfig


class DailyJournalConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'daily_journal'
    verbose_name = 'Journal quotidien'

    def ready(self):
        from . import signals  # noqa: F401
