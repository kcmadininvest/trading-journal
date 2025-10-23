from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

app_name = 'trades'

router = DefaultRouter()
router.register(r'topstep', views.TopStepTradeViewSet, basename='topstep-trade')
router.register(r'import-logs', views.TopStepImportLogViewSet, basename='import-log')
router.register(r'trade-strategies', views.TradeStrategyViewSet, basename='trade-strategy')
router.register(r'position-strategies', views.PositionStrategyViewSet, basename='position-strategy')

urlpatterns = [
    path('', include(router.urls)),
]