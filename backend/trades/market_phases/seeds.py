"""Seed des phases et événements système."""
from __future__ import annotations

SYSTEM_PHASES = [
    ('consolidation', 'Consolidation', '#8B5CF6', 10),
    ('bullish_trend', 'Tendance haussière', '#22C55E', 20),
    ('bearish_trend', 'Tendance baissière', '#EF4444', 30),
    ('bullish_push', 'Poussée haussière', '#16A34A', 40),
    ('bearish_push', 'Poussée baissière', '#DC2626', 50),
    ('range_bound', 'Range', '#F59E0B', 60),
    ('breakout_sequence', 'Séquence breakout', '#3B82F6', 70),
    ('high_volatility', 'Haute volatilité', '#EC4899', 80),
    ('low_volatility', 'Basse volatilité', '#94A3B8', 90),
    ('news_driven', 'News driven', '#0EA5E9', 100),
    ('unclear', 'Peu clair', '#6B7280', 110),
]

SYSTEM_EVENTS = [
    ('range_breakout_up', 'Cassure range par le haut', 'breakout', 10),
    ('range_breakout_down', 'Cassure range par le bas', 'breakout', 20),
    ('range_reentry', 'Réintégration du range', 'reentry', 30),
    ('wick_sweep_low', 'Mèche sous le range', 'breakout', 40),
    ('wick_sweep_high', 'Mèche au-dessus du range', 'breakout', 50),
]


def seed_system_definitions(apps, schema_editor) -> None:
    Phase = apps.get_model('trades', 'MarketPhaseDefinition')
    Event = apps.get_model('trades', 'MarketPhaseEventDefinition')

    for code, label, color, order in SYSTEM_PHASES:
        Phase.objects.update_or_create(
            user=None,
            code=code,
            defaults={
                'label': label,
                'color': color,
                'is_system': True,
                'is_active': True,
                'sort_order': order,
            },
        )

    for code, label, category, order in SYSTEM_EVENTS:
        Event.objects.update_or_create(
            user=None,
            code=code,
            defaults={
                'label': label,
                'category': category,
                'is_system': True,
                'is_active': True,
                'sort_order': order,
            },
        )
