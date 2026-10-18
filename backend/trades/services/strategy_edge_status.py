"""Statut d'edge stratégie : baseline all-time vs expectancy trailing."""
from __future__ import annotations

import math
import statistics
from collections import defaultdict
from typing import Any, Dict, List, Optional, Sequence, Tuple

from trades.compliance_streaks import get_position_strategy_family_ids
from trades.models import ImportedTrade, PositionStrategy, TradeStrategy
from trades.pnl_basis import trade_pnl_as_float

MIN_SAMPLE = 20
RELIABLE_SAMPLE = 50
STRONG_SAMPLE = 100
TRAILING_WINDOW = 30
BAND_FRACTION = 0.01
BAND_EPSILON = 1.0
# Approx. normale : fourchette approximative, pas un IC Student formel.
UNCERTAINTY_Z = 1.96

_STATUS_SORT_ORDER = {
    'fading': 0,
    'lost': 1,
    'present': 2,
    'insufficient': 3,
}


def hysteresis_band(baseline_expectancy: float) -> float:
    """Bande morte autour de 0 pour éviter le flip-flop sur un trailing quasi nul."""
    return max(abs(baseline_expectancy) * BAND_FRACTION, BAND_EPSILON)


def _mean(values: Sequence[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / len(values)


def _uncertainty_band(values: Sequence[float]) -> Optional[Dict[str, float]]:
    """
    Fourchette approximative mean ± z * SE.

    Retourne None si n < 2. Si std = 0, low = high = mean (bande dégénérée).
    """
    n = len(values)
    if n < 2:
        return None
    mean = _mean(values)
    std = statistics.stdev(values)
    if std == 0:
        rounded = round(mean, 2)
        return {'low': rounded, 'high': rounded}
    se = std / math.sqrt(n)
    half = UNCERTAINTY_Z * se
    return {'low': round(mean - half, 2), 'high': round(mean + half, 2)}


def _confidence_level(sample_size: int) -> Optional[str]:
    """Confiance basée uniquement sur n (échantillon de base)."""
    if sample_size < MIN_SAMPLE:
        return None
    if sample_size < RELIABLE_SAMPLE:
        return 'low'
    if sample_size < STRONG_SAMPLE:
        return 'medium'
    return 'high'


def _profit_factor(values: Sequence[float]) -> Dict[str, Any]:
    gross_wins = sum(v for v in values if v > 0)
    gross_losses = sum(v for v in values if v < 0)
    if gross_losses < 0:
        return {
            'profit_factor': round(gross_wins / abs(gross_losses), 2),
            'profit_factor_infinite': False,
        }
    if gross_wins > 0:
        return {'profit_factor': None, 'profit_factor_infinite': True}
    return {'profit_factor': None, 'profit_factor_infinite': False}


def _classify_status(baseline: float, trailing: float, band: float) -> str:
    trailing_positive = trailing > band
    trailing_negative = trailing <= -band

    if baseline > 0:
        if trailing_negative:
            return 'fading'
        # Neutre ou positif clairement → edge encore considéré présent
        return 'present'

    # baseline <= 0
    if trailing_positive:
        return 'present'
    return 'lost'


def compute_strategy_edge_status(
    pnls: Sequence[float],
    *,
    window: int = TRAILING_WINDOW,
    basis: str = 'respected',
) -> Dict[str, Any]:
    """
    Déduit un statut d'edge à partir d'une série chronologique de PnL.

    - baseline = moyenne de toute la série
    - trailing = moyenne des ``window`` derniers (ou de toute la série si plus courte)
    """
    values = [float(v) for v in pnls]
    n = len(values)

    if n < MIN_SAMPLE:
        baseline = round(_mean(values), 2) if n else None
        return {
            'status': 'insufficient',
            'sample_size': n,
            'trailing_window': window,
            'basis': basis,
            'baseline_expectancy': baseline,
            'trailing_expectancy': None,
            'trailing_profit_factor': None,
            'trailing_profit_factor_infinite': False,
            'hysteresis_band': None,
            'confidence': None,
            'trailing_uncertainty': None,
            'trailing_sign_uncertain': False,
            'windows': {
                '20': _window_snapshot(values, 20),
                '30': _window_snapshot(values, 30),
            },
        }

    baseline = _mean(values)
    trail_slice = values[-window:] if len(values) >= window else values
    trailing = _mean(trail_slice)
    band = hysteresis_band(baseline)
    status = _classify_status(baseline, trailing, band)
    pf = _profit_factor(trail_slice)
    trailing_uncertainty = _uncertainty_band(trail_slice)
    trailing_sign_uncertain = bool(
        trailing_uncertainty is not None
        and trailing_uncertainty['low'] <= 0 <= trailing_uncertainty['high']
    )

    return {
        'status': status,
        'sample_size': n,
        'trailing_window': window,
        'basis': basis,
        'baseline_expectancy': round(baseline, 2),
        'trailing_expectancy': round(trailing, 2),
        'trailing_profit_factor': pf['profit_factor'],
        'trailing_profit_factor_infinite': pf['profit_factor_infinite'],
        'hysteresis_band': round(band, 2),
        'confidence': _confidence_level(n),
        'trailing_uncertainty': trailing_uncertainty,
        'trailing_sign_uncertain': trailing_sign_uncertain,
        'windows': {
            '20': _window_snapshot(values, 20),
            '30': _window_snapshot(values, 30),
        },
    }


def _window_snapshot(values: Sequence[float], window: int) -> Optional[Dict[str, Any]]:
    if len(values) < MIN_SAMPLE:
        return None
    trail = values[-window:] if len(values) >= window else list(values)
    pf = _profit_factor(trail)
    return {
        'sample_size': len(trail),
        'expectancy': round(_mean(trail), 2),
        'profit_factor': pf['profit_factor'],
        'profit_factor_infinite': pf['profit_factor_infinite'],
    }


def _empty_edge_status(*, reason: str = 'no_strategy') -> Dict[str, Any]:
    return {
        'status': 'insufficient',
        'sample_size': 0,
        'trailing_window': TRAILING_WINDOW,
        'basis': None,
        'baseline_expectancy': None,
        'trailing_expectancy': None,
        'trailing_profit_factor': None,
        'trailing_profit_factor_infinite': False,
        'hysteresis_band': None,
        'confidence': None,
        'trailing_uncertainty': None,
        'trailing_sign_uncertain': False,
        'windows': {'20': None, '30': None},
        'reason': reason,
        'period_independent': True,
    }


def load_strategy_edge_pnls(
    user,
    *,
    trading_account_id: Optional[int],
    position_strategy_id: Optional[int],
    pnl_field: str = 'net_pnl',
) -> Dict[str, List[float]]:
    """
    Charge les PnL all-time (hors filtre période) pour la famille / compte.

    Retourne ``respected`` et ``all`` en ordre chronologique.
    """
    if not position_strategy_id:
        return {'respected': [], 'all': []}

    family_ids = get_position_strategy_family_ids(user, position_strategy_id)
    trades_qs = ImportedTrade.objects.filter(
        trading_account__user=user,
        position_strategy_id__in=family_ids,
    )
    if trading_account_id:
        trades_qs = trades_qs.filter(trading_account_id=trading_account_id)
    else:
        trades_qs = trades_qs.exclude(trading_account__status='archived')

    only_fields = {'id', 'entered_at', 'pnl', 'net_pnl', pnl_field}
    trades = list(
        trades_qs.order_by('entered_at', 'id').only(*only_fields)
    )
    if not trades:
        return {'respected': [], 'all': []}

    trade_ids = [t.id for t in trades]
    respect_map = dict(
        TradeStrategy.objects.filter(user=user, trade_id__in=trade_ids).values_list(
            'trade_id', 'strategy_respected'
        )
    )

    all_pnls: List[float] = []
    respected_pnls: List[float] = []
    for trade in trades:
        pnl = trade_pnl_as_float(trade, pnl_field)
        all_pnls.append(pnl)
        if respect_map.get(trade.id) is True:
            respected_pnls.append(pnl)

    return {'respected': respected_pnls, 'all': all_pnls}


def _status_from_series(
    respected: Sequence[float],
    all_pnls: Sequence[float],
    *,
    window: int = TRAILING_WINDOW,
) -> Dict[str, Any]:
    """Applique la logique respected → fallback all → insufficient."""
    if len(respected) >= MIN_SAMPLE:
        payload = compute_strategy_edge_status(respected, window=window, basis='respected')
    elif len(all_pnls) >= MIN_SAMPLE:
        payload = compute_strategy_edge_status(all_pnls, window=window, basis='all')
        payload['fallback_warning'] = True
        payload['respected_sample_size'] = len(respected)
    else:
        primary = respected if respected else all_pnls
        basis = 'respected' if respected else ('all' if all_pnls else 'respected')
        payload = compute_strategy_edge_status(primary, window=window, basis=basis)
        payload['respected_sample_size'] = len(respected)
        payload['all_sample_size'] = len(all_pnls)

    payload['period_independent'] = True
    payload['family_scope'] = True
    return payload


def build_strategy_edge_status_payload(
    user,
    *,
    trading_account_id: Optional[int],
    position_strategy_id: Optional[int],
    pnl_field: str = 'net_pnl',
    window: int = TRAILING_WINDOW,
) -> Dict[str, Any]:
    """
    Calcule le payload ``edge_status`` pour l'API compliance.

    Primaire : trades respectés. Fallback : tous les trades si n_respectés < MIN_SAMPLE
    et n_all >= MIN_SAMPLE.
    """
    if not position_strategy_id:
        return _empty_edge_status(reason='no_strategy')

    series = load_strategy_edge_pnls(
        user,
        trading_account_id=trading_account_id,
        position_strategy_id=position_strategy_id,
        pnl_field=pnl_field,
    )
    return _status_from_series(series['respected'], series['all'], window=window)


def _sort_edge_overview_items(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    def sort_key(item: Dict[str, Any]) -> Tuple[int, float, str]:
        status = item.get('status') or 'insufficient'
        order = _STATUS_SORT_ORDER.get(status, 99)
        trail = item.get('trailing_expectancy')
        # Insuffisant / None : en fin de groupe via +inf
        trail_key = float(trail) if trail is not None and isinstance(trail, (int, float)) else float('inf')
        title = (item.get('title') or '').lower()
        return (order, trail_key, title)

    return sorted(items, key=sort_key)


def build_strategy_edge_overview_payload(
    user,
    *,
    trading_account_id: Optional[int],
    pnl_field: str = 'net_pnl',
    window: int = TRAILING_WINDOW,
) -> Dict[str, Any]:
    """
    Vue d'ensemble all-time : une passe trades, groupement par racine de famille.

    Indépendant du filtre période / stratégie. Respecte le filtre compte.
    """
    strategies = list(
        PositionStrategy.objects.filter(user=user).only(
            'id', 'title', 'parent_strategy_id', 'version',
        )
    )
    if not strategies:
        return {
            'items': [],
            'period_independent': True,
            'account_scoped': trading_account_id is not None,
        }

    meta_by_id: Dict[int, PositionStrategy] = {s.id: s for s in strategies}
    root_of: Dict[int, int] = {}
    members_by_root: Dict[int, List[PositionStrategy]] = defaultdict(list)
    for s in strategies:
        root = s.parent_strategy_id or s.id
        root_of[s.id] = root
        members_by_root[root].append(s)

    trades_qs = ImportedTrade.objects.filter(
        trading_account__user=user,
        position_strategy_id__isnull=False,
    )
    if trading_account_id:
        trades_qs = trades_qs.filter(trading_account_id=trading_account_id)
    else:
        trades_qs = trades_qs.exclude(trading_account__status='archived')

    only_fields = {'id', 'entered_at', 'pnl', 'net_pnl', 'position_strategy_id', pnl_field}
    trades = list(
        trades_qs.order_by('entered_at', 'id').only(*only_fields)
    )
    if not trades:
        return {
            'items': [],
            'period_independent': True,
            'account_scoped': trading_account_id is not None,
        }

    trade_ids = [t.id for t in trades]
    respect_map = dict(
        TradeStrategy.objects.filter(user=user, trade_id__in=trade_ids).values_list(
            'trade_id', 'strategy_respected'
        )
    )

    respected_by_root: Dict[int, List[float]] = defaultdict(list)
    all_by_root: Dict[int, List[float]] = defaultdict(list)

    for trade in trades:
        sid = trade.position_strategy_id
        if sid is None:
            continue
        root = root_of.get(sid)
        if root is None:
            # Stratégie orpheline / autre user — ignorer
            continue
        pnl = trade_pnl_as_float(trade, pnl_field)
        all_by_root[root].append(pnl)
        if respect_map.get(trade.id) is True:
            respected_by_root[root].append(pnl)

    items: List[Dict[str, Any]] = []
    for root_id, all_pnls in all_by_root.items():
        respected = respected_by_root.get(root_id, [])
        edge = _status_from_series(respected, all_pnls, window=window)

        members = members_by_root.get(root_id, [])
        root_strategy = meta_by_id.get(root_id)
        # Version la plus récente (max id) pour le filtre UI
        display = max(members, key=lambda m: m.id) if members else root_strategy
        title = (
            (display.title if display else None)
            or (root_strategy.title if root_strategy else None)
            or f'Strategy #{root_id}'
        )

        items.append({
            **edge,
            'root_id': root_id,
            'display_strategy_id': display.id if display else root_id,
            'title': title,
            'version_count': len(members) if members else 1,
        })

    return {
        'items': _sort_edge_overview_items(items),
        'period_independent': True,
        'account_scoped': trading_account_id is not None,
    }
