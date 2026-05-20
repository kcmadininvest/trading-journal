"""Analyse de la taille du trade suivant immédiatement chaque gain (overconfidence sizing)."""
from __future__ import annotations

from typing import Any

from trades.contract_utils.contract_family import (
    get_contract_family_key,
    trade_risk_units,
)
from trades.pnl_basis import trade_pnl_as_float

from trades.services.post_loss_sizing import (
    _compare_size,
    _empty_category_buckets,
    _finalize_buckets,
    _median_lookback,
    _median_sizes,
)


def compute_post_win_sizing(
    trades_queryset,
    pnl_field: str,
) -> dict[str, Any]:
    """
    Pour chaque trade gagnant ayant un trade suivant dans le queryset filtré,
    classifie l'exposition du trade suivant (size × point_value) vs le trade gagnant
    et vs la médiane récente (même famille de contrat).
    """
    lookback = _median_lookback()
    trades = list(trades_queryset.order_by('entered_at', 'id'))

    vs_winning_raw: dict[str, dict[str, Any]] = _empty_category_buckets()
    vs_median_raw: dict[str, dict[str, Any]] = _empty_category_buckets()
    for bucket in (*vs_winning_raw.values(), *vs_median_raw.values()):
        bucket['_pnls'] = []

    sample_size = 0
    median_sample_size = 0
    skipped_cross_instrument = 0
    skipped_unknown_contract = 0

    for i, winning_trade in enumerate(trades):
        pnl = trade_pnl_as_float(winning_trade, pnl_field)
        if pnl <= 0:
            continue
        if i + 1 >= len(trades):
            continue

        next_trade = trades[i + 1]
        win_family = get_contract_family_key(winning_trade.contract_name or '')
        next_family = get_contract_family_key(next_trade.contract_name or '')

        if win_family is None or next_family is None:
            skipped_unknown_contract += 1
            continue

        if win_family != next_family:
            skipped_cross_instrument += 1
            continue

        next_risk = trade_risk_units(next_trade)
        win_risk = trade_risk_units(winning_trade)
        if next_risk is None or win_risk is None:
            skipped_unknown_contract += 1
            continue

        next_pnl = trade_pnl_as_float(next_trade, pnl_field)
        sample_size += 1

        cat_winning = _compare_size(next_risk, win_risk)
        vs_winning_raw[cat_winning]['count'] += 1
        vs_winning_raw[cat_winning]['_pnls'].append(next_pnl)

        prior_risk_units = []
        account_id = next_trade.trading_account_id
        for prev in reversed(trades[:i + 1]):
            if prev.trading_account_id != account_id:
                continue
            prev_family = get_contract_family_key(prev.contract_name or '')
            if prev_family != next_family:
                continue
            prev_risk = trade_risk_units(prev)
            if prev_risk is not None:
                prior_risk_units.append(prev_risk)
            if len(prior_risk_units) >= lookback:
                break

        median = _median_sizes(prior_risk_units)
        if median is not None:
            median_sample_size += 1
            cat_median = _compare_size(next_risk, median)
            vs_median_raw[cat_median]['count'] += 1
            vs_median_raw[cat_median]['_pnls'].append(next_pnl)

    vs_winning = _finalize_buckets(vs_winning_raw, sample_size)
    vs_median = _finalize_buckets(vs_median_raw, median_sample_size)

    return {
        'sample_size': sample_size,
        'median_lookback': lookback,
        'median_sample_size': median_sample_size,
        'skipped_cross_instrument': skipped_cross_instrument,
        'skipped_unknown_contract': skipped_unknown_contract,
        'comparison_basis': 'risk_units',
        'vs_winning_trade': vs_winning,
        'vs_median': vs_median,
    }


def empty_post_win_sizing() -> dict[str, Any]:
    """Structure vide lorsqu'il n'y a aucun trade."""
    lookback = _median_lookback()
    empty = _finalize_buckets(_empty_category_buckets(), 0)
    return {
        'sample_size': 0,
        'median_lookback': lookback,
        'median_sample_size': 0,
        'skipped_cross_instrument': 0,
        'skipped_unknown_contract': 0,
        'comparison_basis': 'risk_units',
        'vs_winning_trade': empty,
        'vs_median': empty,
    }
