from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from rest_framework import serializers

R_QUANT = Decimal('0.0001')
POINTS_QUANT = Decimal('0.00000001')
R_DIVERGENCE_TOLERANCE = Decimal('0.05')


def _as_decimal(value: Any) -> Decimal | None:
    if value is None or value == '':
        return None
    try:
        return Decimal(str(value))
    except Exception as exc:
        raise serializers.ValidationError('Nombre invalide.') from exc


def risk_points(entry: Decimal, stop: Decimal) -> Decimal:
    risk = abs(entry - stop)
    if risk <= 0:
        raise serializers.ValidationError(
            {'initial_stop_price': 'Le stop doit différer de l’entrée.'}
        )
    return risk


def result_points(direction: str, entry: Decimal, exit_price: Decimal) -> Decimal:
    if direction == 'LONG':
        return (exit_price - entry).quantize(POINTS_QUANT)
    return (entry - exit_price).quantize(POINTS_QUANT)


def validate_stop_side(
    direction: str,
    entry: Decimal,
    stop: Decimal,
    *,
    allow_override: bool = False,
) -> None:
    if allow_override:
        return
    if direction == 'LONG' and stop >= entry:
        raise serializers.ValidationError(
            {'initial_stop_price': 'Stop sous l’entrée requis pour un long.'}
        )
    if direction == 'SHORT' and stop <= entry:
        raise serializers.ValidationError(
            {'initial_stop_price': 'Stop au-dessus de l’entrée requis pour un short.'}
        )


def validate_target_side(
    direction: str,
    entry: Decimal,
    target: Decimal,
    *,
    allow_override: bool = False,
) -> None:
    if allow_override:
        return
    if direction == 'LONG' and target <= entry:
        raise serializers.ValidationError(
            {'target_price': 'Objectif au-dessus de l’entrée pour un long.'}
        )
    if direction == 'SHORT' and target >= entry:
        raise serializers.ValidationError(
            {'target_price': 'Objectif sous l’entrée pour un short.'}
        )


def compute_result_fields(attrs: dict[str, Any]) -> dict[str, Any]:
    """Calcule result_points / result_r. La saisie manuelle de R l’emporte."""
    direction = attrs.get('direction')
    entry = _as_decimal(attrs.get('entry_price'))
    stop = _as_decimal(attrs.get('initial_stop_price'))
    exit_price = _as_decimal(attrs.get('exit_price'))
    target = _as_decimal(attrs.get('target_price'))
    source = attrs.get('result_r_source') or 'calculated'
    manual_r = _as_decimal(attrs.get('result_r')) if source == 'manual' else None
    allow_stop_override = bool(attrs.pop('allow_stop_side_override', False))
    allow_target_override = bool(attrs.pop('allow_target_side_override', False))
    warnings: list[str] = []

    if entry is not None and stop is not None:
        validate_stop_side(direction, entry, stop, allow_override=allow_stop_override)
        risk = risk_points(entry, stop)
    else:
        risk = None

    if entry is not None and target is not None:
        validate_target_side(
            direction, entry, target, allow_override=allow_target_override
        )

    computed_points = None
    computed_r = None
    if entry is not None and exit_price is not None:
        computed_points = result_points(direction, entry, exit_price)
        if risk is not None:
            computed_r = (computed_points / risk).quantize(
                R_QUANT, rounding=ROUND_HALF_UP
            )

    if source == 'manual':
        if manual_r is None:
            raise serializers.ValidationError(
                {'result_r': 'Résultat en R requis en saisie manuelle.'}
            )
        if computed_r is not None and abs(computed_r - manual_r) > R_DIVERGENCE_TOLERANCE:
            warnings.append('r_divergence')
        attrs['result_r'] = manual_r.quantize(R_QUANT, rounding=ROUND_HALF_UP)
        attrs['result_r_source'] = 'manual'
        attrs['result_points'] = computed_points
    else:
        attrs['result_r_source'] = 'calculated'
        if computed_r is not None:
            attrs['result_r'] = computed_r
            attrs['result_points'] = computed_points
        elif attrs.get('result_status') not in {None, 'OPEN', 'NOT_TAKEN'}:
            if attrs.get('result_r') is None:
                raise serializers.ValidationError(
                    {
                        'result_r': (
                            'Indiquez un R manuel ou les prix d’entrée, stop et sortie.'
                        )
                    }
                )

    attrs['_warnings'] = warnings
    return attrs
