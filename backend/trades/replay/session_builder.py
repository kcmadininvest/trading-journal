"""Construction d'une session de replay à partir des APIs TopStepX."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Any

import pytz
from django.db import transaction
from django.utils import timezone

from integrations.topstepx_accounts import resolve_projectx_account_id
from integrations.topstepx_auth import get_topstepx_integration, get_valid_session_token
from integrations.topstepx_client import TopStepXApiClient, TopStepXApiError
from trades.models import (
    SessionEvent,
    SessionInsight,
    SessionJournalDraft,
    TopStepTrade,
    TradingAccount,
    TradingSession,
)
from trades.sync.topstepx_mapper import aggregate_fills_to_round_trips, parse_api_timestamp

from .event_display import fill_summary, format_contract_label, order_summary
from .insight_rules import run_insight_rules
from .journal_generator import generate_journal_draft


@dataclass
class SessionBuildResult:
    session: TradingSession
    event_count: int
    insight_count: int
    preserved: bool = False
    preserve_reason: str = ''


def _existing_built_session_with_events(
    user,
    trading_account: TradingAccount,
    session_date: date,
) -> TradingSession | None:
    """Session déjà construite avec au moins un événement (données à préserver)."""
    session = (
        TradingSession.objects.filter(
            user=user,
            trading_account=trading_account,
            session_date=session_date,
            status='built',
        )
        .prefetch_related('events')
        .first()
    )
    if session is not None and session.events.exists():
        return session
    return None


def _preserve_existing_session(session: TradingSession, reason: str) -> SessionBuildResult:
    return SessionBuildResult(
        session=session,
        event_count=session.events.count(),
        insight_count=session.insights.count(),
        preserved=True,
        preserve_reason=reason,
    )


def session_day_bounds(session_date: date, tz_name: str = 'Europe/Paris') -> tuple[datetime, datetime]:
    """Début et fin de journée dans le fuseau utilisateur, en UTC pour l'API."""
    try:
        tz = pytz.timezone(tz_name)
    except pytz.UnknownTimeZoneError:
        tz = pytz.timezone('Europe/Paris')
    start_local = tz.localize(datetime.combine(session_date, time.min))
    end_local = tz.localize(datetime.combine(session_date, time.max))
    return start_local.astimezone(pytz.UTC), end_local.astimezone(pytz.UTC)


def _order_events(order: dict[str, Any]) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    order_id = str(order.get('id', ''))
    if not order_id:
        return events
    created_raw = order.get('creationTimestamp')
    updated_raw = order.get('updateTimestamp')
    if not created_raw:
        return events
    created_at = parse_api_timestamp(str(created_raw))
    events.append({
        'event_type': 'order_created',
        'source': 'order',
        'external_id': order_id,
        'occurred_at': created_at,
        'payload': {'order': order, **order_summary(order)},
    })
    if updated_raw:
        updated_at = parse_api_timestamp(str(updated_raw))
        if updated_at > created_at:
            events.append({
                'event_type': 'order_updated',
                'source': 'order',
                'external_id': f'{order_id}-updated',
                'occurred_at': updated_at,
                'payload': {'order': order, **order_summary(order)},
            })
    return events


def _fill_events(fills: list[dict[str, Any]], trade_by_topstep_id: dict[str, TopStepTrade]) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    active = [f for f in fills if not f.get('voided')]
    active.sort(key=lambda f: f.get('creationTimestamp') or '')

    for fill in active:
        fill_id = str(fill.get('id', ''))
        if not fill_id:
            continue
        ts_raw = fill.get('creationTimestamp')
        if not ts_raw:
            continue
        occurred_at = parse_api_timestamp(str(ts_raw))
        pnl = fill.get('profitAndLoss')
        trade = trade_by_topstep_id.get(fill_id)
        if pnl is None and trade is None:
            for tid, t in trade_by_topstep_id.items():
                raw = t.raw_data if isinstance(t.raw_data, dict) else {}
                entry = raw.get('entry_fill') or {}
                if str(entry.get('id')) == fill_id:
                    trade = t
                    break

        events.append({
            'event_type': 'fill',
            'source': 'fill',
            'external_id': fill_id,
            'occurred_at': occurred_at,
            'payload': {'fill': fill, **fill_summary(fill)},
            'trade': trade if pnl is not None else None,
        })

    round_trips = aggregate_fills_to_round_trips(active)
    seen_position_open_ids: set[str] = set()
    for row in round_trips:
        raw = row.get('raw_data') or {}
        entry = raw.get('entry_fill') or {}
        exit_fill = raw.get('exit_fill') or {}
        topstep_id = str(row.get('topstep_id', ''))
        trade = trade_by_topstep_id.get(topstep_id)

        if entry.get('id') and entry.get('creationTimestamp'):
            open_external_id = f"open-{entry['id']}"
            if open_external_id not in seen_position_open_ids:
                seen_position_open_ids.add(open_external_id)
                events.append({
                    'event_type': 'position_open',
                    'source': 'derived',
                    'external_id': open_external_id,
                    'occurred_at': parse_api_timestamp(str(entry['creationTimestamp'])),
                    'payload': {
                        'contract_name': format_contract_label(row.get('contract_name')),
                        'trade_type': row.get('trade_type'),
                        'size': str(row.get('size')),
                        'entry_price': str(row.get('entry_price')),
                    },
                    'trade': trade,
                })
        if exit_fill.get('id') and exit_fill.get('creationTimestamp'):
            events.append({
                'event_type': 'position_close',
                'source': 'derived',
                'external_id': f"close-{exit_fill['id']}",
                'occurred_at': parse_api_timestamp(str(exit_fill['creationTimestamp'])),
                'payload': {
                    'contract_name': format_contract_label(row.get('contract_name')),
                    'trade_type': row.get('trade_type'),
                    'size': str(row.get('size')),
                    'exit_price': str(row.get('exit_price')),
                    'pnl': str(row.get('pnl')) if row.get('pnl') is not None else None,
                },
                'trade': trade,
            })
    return events


def _pnl_tick_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Ajoute des ticks PnL cumulé après chaque clôture."""
    ticks: list[dict[str, Any]] = []
    cumulative = Decimal('0')
    closes = sorted(
        (e for e in events if e['event_type'] == 'position_close'),
        key=lambda e: e['occurred_at'],
    )
    for close_evt in closes:
        pnl_raw = (close_evt.get('payload') or {}).get('pnl')
        if pnl_raw is not None:
            try:
                cumulative += Decimal(str(pnl_raw))
            except Exception:
                pass
        ext = close_evt.get('external_id', 'unknown')
        ticks.append({
            'event_type': 'pnl_tick',
            'source': 'derived',
            'external_id': f"pnl-{ext}",
            'occurred_at': close_evt['occurred_at'],
            'payload': {'cumulative_pnl': str(cumulative)},
            'trade': close_evt.get('trade'),
        })
    return ticks


class SessionReplayBuilder:
    def __init__(self, client: TopStepXApiClient | None = None):
        self.client = client or TopStepXApiClient()

    def build(
        self,
        user,
        trading_account: TradingAccount,
        session_date: date,
        *,
        tz_name: str = 'Europe/Paris',
    ) -> SessionBuildResult:
        if trading_account.account_type != 'topstep':
            raise ValueError('Le replay est réservé aux comptes TopStep.')

        integration = get_topstepx_integration(user)
        if integration is None or not integration.secrets_encrypted:
            raise ValueError('Configurez l\'intégration TopStepX dans les paramètres.')

        token = get_valid_session_token(integration)
        account_id, _ = resolve_projectx_account_id(self.client, token, trading_account)

        start_utc, end_utc = session_day_bounds(session_date, tz_name)

        existing_session = _existing_built_session_with_events(
            user, trading_account, session_date
        )

        try:
            orders = self.client.search_orders(token, account_id, start_utc, end_utc)
            fills = self.client.search_trades(token, account_id, start_utc, end_utc)
        except TopStepXApiError as exc:
            if existing_session is not None:
                return _preserve_existing_session(
                    existing_session,
                    'api_error',
                )
            TradingSession.objects.update_or_create(
                user=user,
                trading_account=trading_account,
                session_date=session_date,
                defaults={
                    'status': 'failed',
                    'build_error': str(exc),
                },
            )
            raise ValueError(str(exc)) from exc

        if not orders and not fills and existing_session is not None:
            return _preserve_existing_session(
                existing_session,
                'api_empty',
            )

        trades_qs = TopStepTrade.objects.filter(
            user=user,
            trading_account=trading_account,
            trade_day=session_date,
        )
        trade_by_topstep_id: dict[str, TopStepTrade] = {
            str(t.topstep_id): t for t in trades_qs if t.topstep_id
        }

        raw_events: list[dict[str, Any]] = []
        for order in orders:
            raw_events.extend(_order_events(order))
        raw_events.extend(_fill_events(fills, trade_by_topstep_id))
        raw_events.extend(_pnl_tick_events(raw_events))

        raw_events.sort(key=lambda e: (e['occurred_at'], e['event_type']))

        net_pnl = Decimal('0')
        peak_pnl = Decimal('0')
        max_dd = Decimal('0')
        close_count = 0
        started_at = raw_events[0]['occurred_at'] if raw_events else None
        ended_at = raw_events[-1]['occurred_at'] if raw_events else None

        for evt in raw_events:
            if evt['event_type'] == 'position_close':
                close_count += 1
                pnl_raw = (evt.get('payload') or {}).get('pnl')
                if pnl_raw is not None:
                    try:
                        net_pnl += Decimal(str(pnl_raw))
                        if net_pnl > peak_pnl:
                            peak_pnl = net_pnl
                        dd = peak_pnl - net_pnl
                        if dd > max_dd:
                            max_dd = dd
                    except Exception:
                        pass

        with transaction.atomic():
            session, _ = TradingSession.objects.update_or_create(
                user=user,
                trading_account=trading_account,
                session_date=session_date,
                defaults={
                    'status': 'built',
                    'started_at': started_at,
                    'ended_at': ended_at,
                    'trade_count': close_count,
                    'net_pnl': net_pnl,
                    'max_drawdown_intraday': max_dd if close_count else None,
                    'build_error': '',
                    'built_at': timezone.now(),
                },
            )
            session.events.all().delete()
            session.insights.all().delete()
            SessionJournalDraft.objects.filter(session=session).delete()

            event_objs: list[SessionEvent] = []
            for seq, evt in enumerate(raw_events, start=1):
                event_objs.append(
                    SessionEvent(
                        session=session,
                        event_type=evt['event_type'],
                        source=evt['source'],
                        external_id=evt.get('external_id', ''),
                        sequence=seq,
                        occurred_at=evt['occurred_at'],
                        payload=evt.get('payload') or {},
                        trade=evt.get('trade'),
                    )
                )
            SessionEvent.objects.bulk_create(event_objs)

            insights = run_insight_rules(session, list(session.events.order_by('sequence')), trading_account)
            SessionInsight.objects.bulk_create(insights)

            draft_content = generate_journal_draft(session, event_objs, insights)
            SessionJournalDraft.objects.create(session=session, content=draft_content)

        return SessionBuildResult(
            session=session,
            event_count=len(event_objs),
            insight_count=len(insights),
        )
