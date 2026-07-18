from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    MarketPhaseAnalyticsView,
    MarketPhaseCaptureView,
    MarketPhaseDefinitionViewSet,
    MarketPhaseEventDefinitionViewSet,
    MarketPhaseInstrumentsView,
    MarketPhasePeriodCapturesDeleteView,
    MarketPhaseSessionSlotsView,
    MarketPhaseSlotConfigView,
)

router = DefaultRouter()
router.register(r'definitions/phases', MarketPhaseDefinitionViewSet, basename='market-phase-def')
router.register(r'definitions/events', MarketPhaseEventDefinitionViewSet, basename='market-phase-event-def')

urlpatterns = [
    path('slot-config/', MarketPhaseSlotConfigView.as_view(), name='market-phase-slot-config'),
    path('session-slots/', MarketPhaseSessionSlotsView.as_view(), name='market-phase-session-slots'),
    path('capture/', MarketPhaseCaptureView.as_view(), name='market-phase-capture'),
    path('instruments/', MarketPhaseInstrumentsView.as_view(), name='market-phase-instruments'),
    path(
        'analytics/asset-profile/',
        MarketPhaseAnalyticsView.as_view(),
        {'analysis_type': 'asset-profile'},
        name='market-phase-asset-profile',
    ),
    path(
        'analytics/period-profile/',
        MarketPhaseAnalyticsView.as_view(),
        {'analysis_type': 'period-profile'},
        name='market-phase-period-profile',
    ),
    path(
        'analytics/ranking/',
        MarketPhaseAnalyticsView.as_view(),
        {'analysis_type': 'ranking'},
        name='market-phase-ranking',
    ),
    path(
        'analytics/period-captures/',
        MarketPhasePeriodCapturesDeleteView.as_view(),
        name='market-phase-period-captures-delete',
    ),
] + router.urls
