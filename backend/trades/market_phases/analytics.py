"""Agrégations analytics : asset_market_profile et period_profile."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any

import pytz
from django.db.models import QuerySet

from trades.models import TopStepTrade

from trades.contract_utils.market_quote_mapping import (
    market_quote_instrument_label,
    resolve_market_quote_instrument_key,
)
from .models import SessionMarketPhaseBlock, SessionMarketPhaseEvent
from .period_projection import (
    AnalyticalPeriod,
    block_duration_minutes,
    event_in_period,
    overlap_minutes,
    parse_period_key,
)


def compute_verdict(
    win_rate: float,
    expectancy: float,
    trade_count: int,
    sample_sessions: int,
) -> str:
    if trade_count < 10 or sample_sessions < 10:
        return 'insufficient_data'
    if win_rate < 35 and expectancy < 0:
        return 'avoid'
    if win_rate >= 55 and expectancy > 0:
        return 'favor'
    return 'neutral'


def _confidence(trade_count: int, sample_sessions: int) -> str:
    if trade_count >= 30 and sample_sessions >= 30:
        return 'high'
    if trade_count >= 10 and sample_sessions >= 10:
        return 'medium'
    return 'low'


def _trade_pnl_value(trade: TopStepTrade, pnl_mode: str) -> Decimal:
    if pnl_mode == 'gross' and trade.pnl is not None:
        return trade.pnl
    if trade.net_pnl is not None:
        return trade.net_pnl
    return trade.pnl or Decimal('0')


def _local_time(dt: datetime, tz_name: str) -> time:
    tz = pytz.timezone(tz_name)
    if dt.tzinfo is None:
        dt = pytz.UTC.localize(dt)
    return dt.astimezone(tz).timetz().replace(tzinfo=None)


def _dominant_phase_for_session_period(
    blocks: list[SessionMarketPhaseBlock],
    period: AnalyticalPeriod,
) -> tuple[str | None, float]:
    weights: dict[str, float] = defaultdict(float)
    for block in blocks:
        overlap = overlap_minutes(block.range_start, block.range_end, period.start, period.end)
        if overlap <= 0:
            continue
        code = block.phase.code
        weights[code] += overlap
    if not weights:
        return None, 0.0
    dominant = max(weights.items(), key=lambda x: x[1])
    total = sum(weights.values())
    pct = (dominant[1] / total * 100.0) if total else 0.0
    return dominant[0], round(pct, 1)


def build_asset_market_profile(
    *,
    blocks_qs: QuerySet[SessionMarketPhaseBlock],
    events_qs: QuerySet[SessionMarketPhaseEvent],
    period: AnalyticalPeriod,
    instrument_key: str,
) -> dict[str, Any]:
    blocks = list(blocks_qs.select_related('phase'))
    events = list(events_qs.select_related('event_type'))

    sessions_documented: set[date] = set()
    regime_weights: dict[str, float] = defaultdict(float)
    total_block_minutes = 0.0
    phase_durations: dict[str, list[float]] = defaultdict(list)

    blocks_by_session: dict[date, list[SessionMarketPhaseBlock]] = defaultdict(list)
    for block in blocks:
        blocks_by_session[block.session_date].append(block)
        overlap = overlap_minutes(block.range_start, block.range_end, period.start, period.end)
        if overlap <= 0:
            continue
        sessions_documented.add(block.session_date)
        regime_weights[block.phase.code] += overlap
        total_block_minutes += overlap
        dur = block_duration_minutes(block.range_start, block.range_end)
        phase_durations[block.phase.code].append(dur)

    regime_breakdown: dict[str, float] = {}
    if total_block_minutes > 0:
        for code, w in regime_weights.items():
            regime_breakdown[code] = round(w / total_block_minutes * 100.0, 1)

    dominant_regime = None
    dominant_regime_pct = 0.0
    if regime_breakdown:
        dominant_regime, dominant_regime_pct = max(
            regime_breakdown.items(), key=lambda x: x[1]
        )

    # Sessions où le régime dominant de la période = X
    session_dominant_counts: dict[str, int] = defaultdict(int)
    for session_date, day_blocks in blocks_by_session.items():
        dom, _ = _dominant_phase_for_session_period(day_blocks, period)
        if dom:
            session_dominant_counts[dom] += 1

    sample_sessions = len(sessions_documented)
    session_regime_pct: dict[str, float] = {}
    if sample_sessions:
        for code, cnt in session_dominant_counts.items():
            session_regime_pct[code] = round(cnt / sample_sessions * 100.0, 1)

    # Fakeout rate: wick breakout followed by reentry within events in period
    wick_breakouts = 0
    fakeouts = 0
    body_breakouts = 0
    for ev in events:
        if not event_in_period(ev.occurred_at, period.start, period.end):
            continue
        code = ev.event_type.code
        if code in ('range_breakout_up', 'range_breakout_down', 'wick_sweep_low', 'wick_sweep_high'):
            if ev.candle_part == 'wick':
                wick_breakouts += 1
                if ev.outcome == 'reentry':
                    fakeouts += 1
            elif ev.candle_part == 'body':
                body_breakouts += 1

    fakeout_rate = round(fakeouts / wick_breakouts * 100.0, 1) if wick_breakouts else None
    breakout_body_vs_wick: dict[str, int] = {'body': body_breakouts, 'wick': wick_breakouts}

    avg_phase_duration: dict[str, float] = {}
    for code, durations in phase_durations.items():
        avg_phase_duration[code] = round(sum(durations) / len(durations), 1)

    return {
        'instrument_key': instrument_key,
        'instrument_label': market_quote_instrument_label(instrument_key),
        'period': {'key': period.key, 'label': period.label},
        'sample_sessions': sample_sessions,
        'regime_breakdown': regime_breakdown or session_regime_pct,
        'dominant_regime': dominant_regime,
        'dominant_regime_pct': dominant_regime_pct or (
            max(session_regime_pct.values()) if session_regime_pct else 0.0
        ),
        'session_regime_frequency': session_regime_pct,
        'avg_phase_duration_min': avg_phase_duration,
        'fakeout_rate': fakeout_rate,
        'breakout_body_vs_wick': breakout_body_vs_wick,
    }


def build_period_profile(
    *,
    asset_profile: dict[str, Any],
    trades_qs: QuerySet[TopStepTrade],
    blocks_qs: QuerySet[SessionMarketPhaseBlock],
    period: AnalyticalPeriod,
    tz_name: str,
    pnl_mode: str = 'net',
) -> dict[str, Any]:
    blocks = list(blocks_qs.select_related('phase'))
    blocks_by_session: dict[date, list[SessionMarketPhaseBlock]] = defaultdict(list)
    for block in blocks:
        blocks_by_session[block.session_date].append(block)

    period_trades: list[TopStepTrade] = []
    wins = 0
    total_pnl = Decimal('0')
    win_rate_by_regime: dict[str, dict[str, int]] = defaultdict(lambda: {'wins': 0, 'total': 0})

    for trade in trades_qs:
        if not trade.entered_at:
            continue
        trade_day = trade.trade_day or trade.entered_at.date()
        entered_local = _local_time(trade.entered_at, tz_name)
        if not event_in_period(entered_local, period.start, period.end):
            continue
        period_trades.append(trade)
        pnl = _trade_pnl_value(trade, pnl_mode)
        total_pnl += pnl
        if pnl > 0:
            wins += 1

        day_blocks = blocks_by_session.get(trade_day, [])
        regime, _ = _dominant_phase_for_session_period(day_blocks, period)
        if regime:
            win_rate_by_regime[regime]['total'] += 1
            if pnl > 0:
                win_rate_by_regime[regime]['wins'] += 1

    trade_count = len(period_trades)
    win_rate = round(wins / trade_count * 100.0, 1) if trade_count else 0.0
    expectancy = float(total_pnl / trade_count) if trade_count else 0.0

    wr_by_regime_pct: dict[str, float] = {}
    for regime, counts in win_rate_by_regime.items():
        if counts['total']:
            wr_by_regime_pct[regime] = round(counts['wins'] / counts['total'] * 100.0, 1)

    sample_sessions = asset_profile.get('sample_sessions', 0)
    verdict = compute_verdict(win_rate, expectancy, trade_count, sample_sessions)

    return {
        **asset_profile,
        'trade_count': trade_count,
        'win_rate': win_rate,
        'expectancy': round(expectancy, 2),
        'win_rate_by_regime': wr_by_regime_pct,
        'verdict': verdict,
        'confidence': _confidence(trade_count, sample_sessions),
    }


def build_ranking(
    *,
    blocks_qs: QuerySet[SessionMarketPhaseBlock],
    events_qs: QuerySet[SessionMarketPhaseEvent],
    trades_qs: QuerySet[TopStepTrade],
    periods: list[AnalyticalPeriod],
    instrument_key: str,
    tz_name: str,
    pnl_mode: str = 'net',
    sort_by: str = 'win_rate',
) -> list[dict[str, Any]]:
    profiles: list[dict[str, Any]] = []
    for period in periods:
        asset = build_asset_market_profile(
            blocks_qs=blocks_qs,
            events_qs=events_qs,
            period=period,
            instrument_key=instrument_key,
        )
        if asset['sample_sessions'] == 0 or not asset.get('dominant_regime'):
            continue
        profile = build_period_profile(
            asset_profile=asset,
            trades_qs=trades_qs,
            blocks_qs=blocks_qs,
            period=period,
            tz_name=tz_name,
            pnl_mode=pnl_mode,
        )
        profiles.append(profile)

    reverse = sort_by != 'expectancy' or True
    if sort_by == 'expectancy':
        profiles.sort(key=lambda p: p.get('expectancy', 0), reverse=True)
    else:
        profiles.sort(key=lambda p: p.get('win_rate', 0), reverse=True)
    return profiles


def filter_trades_for_instrument(
    trades_qs: QuerySet[TopStepTrade],
    instrument_key: str,
) -> QuerySet[TopStepTrade]:
    ids: list[int] = []
    for trade in trades_qs.only('id', 'contract_name'):
        if resolve_market_quote_instrument_key(trade.contract_name) == instrument_key:
            ids.append(trade.id)
    return trades_qs.filter(id__in=ids)
