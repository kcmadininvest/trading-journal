"""Analyse de la taille du trade suivant immédiatement chaque perte (revenge sizing)."""
from __future__ import annotations

from decimal import Decimal
from typing import Any, Literal

from django.conf import settings

from trades.pnl_basis import trade_pnl_as_float

SizeCategory = Literal['larger', 'equal', 'smaller']

CATEGORIES: tuple[SizeCategory, ...] = ('larger', 'equal', 'smaller')


def _median_lookback() -> int:
    return int(getattr(settings, 'SESSION_REPLAY_OVERSIZE_LOOKBACK', 20))


def _trade_size(trade: Any) -> Decimal | None:
    raw = getattr(trade, 'size', None)
    if raw is None:
        return None
    try:
        return raw if isinstance(raw, Decimal) else Decimal(str(raw))
    except Exception:
        return None


def _compare_size(next_size: Decimal, reference: Decimal) -> SizeCategory:
    if next_size > reference:
        return 'larger'
    if next_size < reference:
        return 'smaller'
    return 'equal'


def _median_sizes(sizes: list[Decimal]) -> Decimal | None:
    if not sizes:
        return None
    sorted_sizes = sorted(sizes)
    mid = len(sorted_sizes) // 2
    if len(sorted_sizes) % 2:
        return sorted_sizes[mid]
    return (sorted_sizes[mid - 1] + sorted_sizes[mid]) / 2


def _empty_category_buckets() -> dict[str, dict[str, Any]]:
    return {
        cat: {
            'count': 0,
            'pct': 0.0,
            'total_pnl': 0.0,
            'avg_pnl': 0.0,
            'win_rate': 0.0,
        }
        for cat in CATEGORIES
    }


def _finalize_buckets(
    buckets: dict[str, dict[str, Any]],
    sample_size: int,
) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for cat in CATEGORIES:
        bucket = buckets[cat]
        count = bucket['count']
        pnls: list[float] = bucket.pop('_pnls', [])
        wins = sum(1 for p in pnls if p > 0)
        total_pnl = sum(pnls)
        result[cat] = {
            'count': count,
            'pct': round((count / sample_size) * 100, 1) if sample_size else 0.0,
            'total_pnl': round(total_pnl, 2),
            'avg_pnl': round(total_pnl / count, 2) if count else 0.0,
            'win_rate': round((wins / count) * 100, 1) if count else 0.0,
        }
    return result


def compute_post_loss_sizing(
    trades_queryset,
    pnl_field: str,
) -> dict[str, Any]:
    """
    Pour chaque trade perdant ayant un trade suivant dans le queryset filtré,
    classifie la taille du trade suivant vs le trade perdant et vs la médiane récente.
    """
    lookback = _median_lookback()
    trades = list(trades_queryset.order_by('entered_at', 'id'))

    vs_losing_raw: dict[str, dict[str, Any]] = _empty_category_buckets()
    vs_median_raw: dict[str, dict[str, Any]] = _empty_category_buckets()
    for bucket in (*vs_losing_raw.values(), *vs_median_raw.values()):
        bucket['_pnls'] = []

    sample_size = 0
    median_sample_size = 0

    for i, losing_trade in enumerate(trades):
        pnl = trade_pnl_as_float(losing_trade, pnl_field)
        if pnl >= 0:
            continue
        if i + 1 >= len(trades):
            continue

        next_trade = trades[i + 1]
        next_size = _trade_size(next_trade)
        loss_size = _trade_size(losing_trade)
        if next_size is None or loss_size is None:
            continue

        next_pnl = trade_pnl_as_float(next_trade, pnl_field)
        sample_size += 1

        cat_losing = _compare_size(next_size, loss_size)
        vs_losing_raw[cat_losing]['count'] += 1
        vs_losing_raw[cat_losing]['_pnls'].append(next_pnl)

        prior_sizes: list[Decimal] = []
        account_id = next_trade.trading_account_id
        for prev in reversed(trades[:i + 1]):
            if prev.trading_account_id != account_id:
                continue
            prev_size = _trade_size(prev)
            if prev_size is not None:
                prior_sizes.append(prev_size)
            if len(prior_sizes) >= lookback:
                break

        median = _median_sizes(prior_sizes)
        if median is not None:
            median_sample_size += 1
            cat_median = _compare_size(next_size, median)
            vs_median_raw[cat_median]['count'] += 1
            vs_median_raw[cat_median]['_pnls'].append(next_pnl)

    vs_losing = _finalize_buckets(vs_losing_raw, sample_size)
    vs_median = _finalize_buckets(vs_median_raw, median_sample_size)

    return {
        'sample_size': sample_size,
        'median_lookback': lookback,
        'median_sample_size': median_sample_size,
        'vs_losing_trade': vs_losing,
        'vs_median': vs_median,
    }


def empty_post_loss_sizing() -> dict[str, Any]:
    """Structure vide lorsqu'il n'y a aucun trade."""
    lookback = _median_lookback()
    empty = _finalize_buckets(_empty_category_buckets(), 0)
    return {
        'sample_size': 0,
        'median_lookback': lookback,
        'median_sample_size': 0,
        'vs_losing_trade': empty,
        'vs_median': empty,
    }
