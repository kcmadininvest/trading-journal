"""
URLs pour les endpoints d'analyse statistique des trades.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views_analytics import (
    TradeContextViewSet,
    TradeSetupViewSet,
    SessionContextViewSet,
    TradeExecutionViewSet,
    TradeProbabilityFactorViewSet,
    TradeTagViewSet,
    TradeTagAssignmentViewSet,
    TradeAnalyticsViewSet,
    TradeStatisticsViewSet,
    ConditionalProbabilityViewSet,
)

router = DefaultRouter()

# Modèles de données analytiques
router.register(r'contexts', TradeContextViewSet, basename='trade-context')
router.register(r'setups', TradeSetupViewSet, basename='trade-setup')
router.register(r'session-contexts', SessionContextViewSet, basename='session-context')
router.register(r'executions', TradeExecutionViewSet, basename='trade-execution')

# Facteurs et tags
router.register(r'probability-factors', TradeProbabilityFactorViewSet, basename='probability-factor')
router.register(r'tags', TradeTagViewSet, basename='trade-tag')
router.register(r'tag-assignments', TradeTagAssignmentViewSet, basename='tag-assignment')

# Analyses statistiques
router.register(r'analytics', TradeAnalyticsViewSet, basename='trade-analytics')
router.register(r'statistics', TradeStatisticsViewSet, basename='trade-statistics')
router.register(r'probabilities', ConditionalProbabilityViewSet, basename='conditional-probability')

urlpatterns = [
    path('', include(router.urls)),
]
