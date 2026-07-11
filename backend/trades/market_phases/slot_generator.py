"""Génération de créneaux pour agrégation analytics."""
from __future__ import annotations

from .period_projection import AnalyticalPeriod, generate_fixed_slots

__all__ = ['AnalyticalPeriod', 'generate_fixed_slots']
