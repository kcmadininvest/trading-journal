"""Endpoint consolidé statistics + analytics + dashboard_slice (1 calcul legacy)."""
from __future__ import annotations

from typing import Any, Dict

from .analytics_calculator import EMPTY_ANALYTICS_PAYLOAD, compute_analytics_payload
from .dashboard_summary_service import compute_dashboard_summary_payload
from .statistics_calculator import EMPTY_STATISTICS_PAYLOAD, compute_statistics_payload


def _trades_queryset_and_pnl_field(request):
    from ..views import ImportedTradeViewSet

    viewset = ImportedTradeViewSet()
    viewset.request = request
    viewset.action = 'list'
    viewset.format_kwarg = None
    return viewset.get_queryset(), viewset.get_pnl_field()


def compute_dashboard_slice(request) -> Dict[str, Any]:
    """Sous-ensemble dashboard sans listes lourdes (allège le bundle)."""
    full = compute_dashboard_summary_payload(request, include_lists=False)
    return {
        'daily_aggregates': full.get('daily_aggregates', []),
        'active_days': full.get('active_days', 0),
        'period_performance': full.get('period_performance'),
        'compliance_stats': full.get('compliance_stats'),
    }


def compute_stats_bundle_payload(request) -> Dict[str, Any]:
    trades, pf = _trades_queryset_and_pnl_field(request)

    if not trades.exists():
        import copy

        return {
            'statistics': EMPTY_STATISTICS_PAYLOAD.copy(),
            'analytics': copy.deepcopy(EMPTY_ANALYTICS_PAYLOAD),
            'dashboard_slice': compute_dashboard_slice(request),
        }

    statistics = compute_statistics_payload(request, trades, pf)
    analytics = compute_analytics_payload(request, trades, pf)
    dashboard_slice = compute_dashboard_slice(request)

    return {
        'statistics': statistics,
        'analytics': analytics,
        'dashboard_slice': dashboard_slice,
    }
