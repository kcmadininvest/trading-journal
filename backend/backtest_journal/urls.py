from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

app_name = 'backtest_journal'

router = DefaultRouter()
router.register(r'strategies', views.ManualBacktestStrategyViewSet, basename='strategy')
router.register(r'versions', views.ManualBacktestVersionViewSet, basename='version')
router.register(r'campaigns', views.ManualBacktestCampaignViewSet, basename='campaign')
router.register(
    r'observations',
    views.ManualBacktestObservationViewSet,
    basename='observation',
)

urlpatterns = [
    path('', include(router.urls)),
]
