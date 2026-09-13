from django.apps import AppConfig


class BacktestJournalConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'backtest_journal'
    verbose_name = 'Journal de backtest manuel'
