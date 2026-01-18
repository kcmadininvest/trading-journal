from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

app_name = 'trades'

router = DefaultRouter()
router.register(r'trading-accounts', views.TradingAccountViewSet, basename='trading-account')
router.register(r'topstep', views.TopStepTradeViewSet, basename='topstep-trade')
router.register(r'import-logs', views.TopStepImportLogViewSet, basename='import-log')
router.register(r'trade-strategies', views.TradeStrategyViewSet, basename='trade-strategy')
router.register(r'day-strategy-compliances', views.DayStrategyComplianceViewSet, basename='day-strategy-compliance')
router.register(r'position-strategies', views.PositionStrategyViewSet, basename='position-strategy')
router.register(r'currencies', views.CurrencyViewSet, basename='currency')
router.register(r'goals', views.TradingGoalViewSet, basename='trading-goal')
router.register(r'account-transactions', views.AccountTransactionViewSet, basename='account-transaction')

urlpatterns = [
    path('', include(router.urls)),
    path('market-holidays/', views.market_holidays, name='market-holidays'),
]