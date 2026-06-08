"""Métriques d'exposition historique pour la projection Monte Carlo."""
from __future__ import annotations

import statistics
from typing import Any

from trades.contract_utils.contract_family import trade_risk_units


def compute_monte_carlo_exposure_inputs(trades_queryset) -> dict[str, Any]:
    """
    Calcule la médiane et la moyenne des unités de risque (size × point_value)
    sur l'historique des trades fournis.
    """
    units: list[float] = []
    skipped_unknown_contract = 0
    trade_count = 0

    for trade in trades_queryset.iterator():
        trade_count += 1
        risk = trade_risk_units(trade)
        if risk is None:
            skipped_unknown_contract += 1
            continue
        units.append(float(risk))

    trades_with_risk_units = len(units)
    median_risk_units = statistics.median(units) if units else None
    avg_risk_units = statistics.mean(units) if units else None

    return {
        'median_risk_units': round(median_risk_units, 4) if median_risk_units is not None else None,
        'avg_risk_units': round(avg_risk_units, 4) if avg_risk_units is not None else None,
        'trade_count': trade_count,
        'trades_with_risk_units': trades_with_risk_units,
        'skipped_unknown_contract': skipped_unknown_contract,
    }
