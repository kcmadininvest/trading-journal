"""Règles heuristiques de détection d'erreurs sur une session de replay."""
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal
from typing import Any

from django.conf import settings

from trades.models import SessionEvent, SessionInsight, TopStepTrade, TradingAccount, TradingSession


def _get_threshold(name: str, default: Any) -> Any:
    return getattr(settings, name, default)


REVENGE_MINUTES = lambda: _get_threshold('SESSION_REPLAY_REVENGE_MINUTES', 5)
OVERSIZE_MULTIPLIER = lambda: _get_threshold('SESSION_REPLAY_OVERSIZE_MULTIPLIER', 2.0)
OVERSIZE_LOOKBACK = lambda: _get_threshold('SESSION_REPLAY_OVERSIZE_LOOKBACK', 20)
OVERTRADING_LIMIT = lambda: _get_threshold('SESSION_REPLAY_OVERTRADING_LIMIT', 15)
LOSS_STREAK_LIMIT = lambda: _get_threshold('SESSION_REPLAY_LOSS_STREAK_LIMIT', 3)
MLL_PRESSURE_RATIO = lambda: _get_threshold('SESSION_REPLAY_MLL_PRESSURE_RATIO', 0.8)


def _median_size(account: TradingAccount, user) -> Decimal | None:
    sizes = list(
        TopStepTrade.objects.filter(
            user=user,
            trading_account=account,
        )
        .order_by('-exited_at')[: int(OVERSIZE_LOOKBACK())]
        .values_list('size', flat=True)
    )
    if not sizes:
        return None
    sorted_sizes = sorted(Decimal(str(s)) for s in sizes)
    mid = len(sorted_sizes) // 2
    if len(sorted_sizes) % 2:
        return sorted_sizes[mid]
    return (sorted_sizes[mid - 1] + sorted_sizes[mid]) / 2


def run_insight_rules(
    session: TradingSession,
    events: list[SessionEvent],
    trading_account: TradingAccount,
) -> list[SessionInsight]:
    insights: list[SessionInsight] = []
    closes = [e for e in events if e.event_type == 'position_close']
    opens = [e for e in events if e.event_type == 'position_open']

    if len(closes) > int(OVERTRADING_LIMIT()):
        insights.append(
            SessionInsight(
                session=session,
                code='overtrading',
                severity='warning',
                message=f'{len(closes)} round-trips sur la session (seuil {OVERTRADING_LIMIT()}).',
                occurred_at=closes[-1].occurred_at,
                context={'trade_count': len(closes), 'limit': OVERTRADING_LIMIT()},
            )
        )

    revenge_delta = timedelta(minutes=int(REVENGE_MINUTES()))
    for i, close_evt in enumerate(closes):
        pnl_raw = (close_evt.payload or {}).get('pnl')
        try:
            pnl = Decimal(str(pnl_raw)) if pnl_raw is not None else None
        except Exception:
            pnl = None
        if pnl is None or pnl >= 0:
            continue
        if i + 1 < len(opens):
            next_open = opens[i + 1]
            if next_open.occurred_at - close_evt.occurred_at <= revenge_delta:
                insights.append(
                    SessionInsight(
                        session=session,
                        code='revenge_trade',
                        severity='warning',
                        message=(
                            f'Nouvelle position {int(REVENGE_MINUTES())} min après une perte '
                            f'({pnl}).'
                        ),
                        occurred_at=next_open.occurred_at,
                        context={
                            'loss_pnl': str(pnl),
                            'minutes_after': REVENGE_MINUTES(),
                        },
                    )
                )

    median = _median_size(trading_account, session.user)
    if median and median > 0:
        mult = Decimal(str(OVERSIZE_MULTIPLIER()))
        for open_evt in opens:
            size_raw = (open_evt.payload or {}).get('size')
            if size_raw is None:
                continue
            try:
                size = Decimal(str(size_raw))
            except Exception:
                continue
            if size > median * mult:
                insights.append(
                    SessionInsight(
                        session=session,
                        code='oversize',
                        severity='warning',
                        message=(
                            f'Taille {size} > {mult}× la médiane récente ({median}).'
                        ),
                        occurred_at=open_evt.occurred_at,
                        context={
                            'size': str(size),
                            'median': str(median),
                            'multiplier': str(mult),
                        },
                    )
                )

    streak = 0
    for close_evt in closes:
        pnl_raw = (close_evt.payload or {}).get('pnl')
        try:
            pnl = Decimal(str(pnl_raw)) if pnl_raw is not None else None
        except Exception:
            pnl = None
        if pnl is not None and pnl < 0:
            streak += 1
            if streak >= int(LOSS_STREAK_LIMIT()):
                insights.append(
                    SessionInsight(
                        session=session,
                        code='loss_streak',
                        severity='error',
                        message=f'{streak} pertes consécutives.',
                        occurred_at=close_evt.occurred_at,
                        context={'streak': streak},
                    )
                )
        else:
            streak = 0

    mll = trading_account.maximum_loss_limit
    if mll and session.net_pnl is not None and mll > 0:
        ratio = abs(session.net_pnl) / mll
        if session.net_pnl < 0 and ratio >= Decimal(str(MLL_PRESSURE_RATIO())):
            insights.append(
                SessionInsight(
                    session=session,
                    code='mll_pressure',
                    severity='error',
                    message=(
                        f'PnL session ({session.net_pnl}) proche du MLL ({mll}).'
                    ),
                    occurred_at=closes[-1].occurred_at if closes else session.built_at or session.created_at,
                    context={
                        'net_pnl': str(session.net_pnl),
                        'mll': str(mll),
                        'ratio': str(ratio),
                    },
                )
            )

    open_ext_ids = {
        e.external_id.replace('open-', '')
        for e in events
        if e.event_type == 'position_open' and e.external_id.startswith('open-')
    }
    for close_evt in closes:
        if not close_evt.external_id.startswith('close-'):
            continue
        exit_id = close_evt.external_id.replace('close-', '')
        entry_candidates = [e for e in events if e.event_type == 'fill' and e.external_id in open_ext_ids]
        if exit_id and not any(
            e.external_id == exit_id or (e.payload or {}).get('fill', {}).get('profitAndLoss') is not None
            for e in events
            if e.event_type == 'fill'
        ):
            continue
        if exit_id and exit_id not in open_ext_ids and not entry_candidates:
            insights.append(
                SessionInsight(
                    session=session,
                    code='orphan_fill',
                    severity='info',
                    message='Clôture sans entrée appariée dans la session.',
                    occurred_at=close_evt.occurred_at,
                    context={'close_external_id': close_evt.external_id},
                )
            )

    return insights
