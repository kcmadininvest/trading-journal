from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from .replay.views import TradingSessionReplayViewSet
from .exports.views import ExportTemplateViewSet, PortfolioExportViewSet
from . import calculator_views
from . import protected_media_views

app_name = 'trades'

router = DefaultRouter()
router.register(r'trading-accounts', views.TradingAccountViewSet, basename='trading-account')
router.register(r'imported', views.ImportedTradeViewSet, basename='imported-trade')
router.register(r'import-logs', views.TopStepImportLogViewSet, basename='import-log')
router.register(r'trade-strategies', views.TradeStrategyViewSet, basename='trade-strategy')
router.register(r'day-strategy-compliances', views.DayStrategyComplianceViewSet, basename='day-strategy-compliance')
router.register(r'position-strategies', views.PositionStrategyViewSet, basename='position-strategy')
router.register(r'currencies', views.CurrencyViewSet, basename='currency')
router.register(r'goals', views.TradingGoalViewSet, basename='trading-goal')
router.register(r'account-transactions', views.AccountTransactionViewSet, basename='account-transaction')
router.register(r'export-templates', ExportTemplateViewSet, basename='export-template')
router.register(r'portfolio-export', PortfolioExportViewSet, basename='portfolio-export')
router.register(r'replay/sessions', TradingSessionReplayViewSet, basename='session-replay')

urlpatterns = [
    path(
        'protected-screenshot/',
        protected_media_views.serve_protected_screenshot_media,
        name='protected-screenshot-media',
    ),
    path(
        'sign-screenshot-display-url/',
        protected_media_views.sign_screenshot_display_url,
        name='sign-screenshot-display-url',
    ),
    path('', include(router.urls)),
    path('dashboard-summary/', views.dashboard_summary, name='dashboard-summary'),
    path('stats-bundle/', views.stats_bundle, name='stats-bundle'),
    path('dashboard-activity-summary/', views.dashboard_activity_summary, name='dashboard-activity-summary'),
    path('market-holidays/', views.market_holidays, name='market-holidays'),
    path('market-holidays/today/', views.market_holidays_today, name='market-holidays-today'),
    path('market-quotes/', views.market_quotes, name='market-quotes'),
    path('fx-rates/', views.fx_rates, name='fx-rates'),
    path('calculator/position-size/', calculator_views.calculate_position_size, name='calculate-position-size'),
    path('calculator/fixed-risk/', calculator_views.calculate_fixed_risk, name='calculate-fixed-risk'),
    path('calculator/risk-reward/', calculator_views.calculate_risk_reward, name='calculate-risk-reward'),
    path('calculator/breakeven/', calculator_views.calculate_breakeven, name='calculate-breakeven'),
    path('calculator/margin/', calculator_views.calculate_margin, name='calculate-margin'),
    path('calculator/forex-lot-size/', calculator_views.calculate_forex_lot_size, name='calculate-forex-lot-size'),
]