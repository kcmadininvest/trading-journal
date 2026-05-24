"""Récupération des barres OHLC TopStepX pour le replay (tout contrat tradé dans la session)."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable

from django.utils import timezone as django_tz

from integrations.topstepx_client import TopStepXApiClient, TopStepXApiError

from .event_display import format_contract_label

logger = logging.getLogger(__name__)

MAX_BARS_PER_REQUEST = 20_000
BUFFER_BEFORE = timedelta(minutes=30)
BUFFER_AFTER = timedelta(minutes=15)


def _event_payload(event: Any) -> dict[str, Any]:
    if isinstance(event, dict):
        return event.get('payload') or {}
    return getattr(event, 'payload', None) or {}


def collect_session_contract_ids(events: Iterable[Any]) -> dict[str, str]:
    """
    contract_id brut -> libellé affichage.
    Dérivé uniquement des fills/ordres de la session (aucune liste d'actifs imposée).
    """
    contracts: dict[str, str] = {}
    for event in events:
        payload = _event_payload(event)
        for key in ('fill', 'order'):
            obj = payload.get(key)
            if not isinstance(obj, dict):
                continue
            raw_id = obj.get('contractId')
            if not raw_id:
                continue
            cid = str(raw_id).strip()
            if not cid:
                continue
            contracts[cid] = format_contract_label(cid)
    return contracts


def count_fills_per_contract(events: Iterable[Any]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for event in events:
        if isinstance(event, dict):
            event_type = event.get('event_type')
        else:
            event_type = getattr(event, 'event_type', None)
        if event_type != 'fill':
            continue
        payload = _event_payload(event)
        fill = payload.get('fill')
        if not isinstance(fill, dict):
            continue
        cid = fill.get('contractId')
        if not cid:
            continue
        key = str(cid)
        counts[key] = counts.get(key, 0) + 1
    return counts


def pick_bar_interval(session_duration: timedelta) -> tuple[int, int]:
    """Retourne (unit, unit_number) pour retrieveBars."""
    minutes = max(1, int(session_duration.total_seconds() // 60))
    if minutes < 45:
        return 2, 1
    if minutes < 180:
        return 2, 5
    return 2, 15


def estimate_bar_limit(
    start: datetime,
    end: datetime,
    unit: int,
    unit_number: int,
) -> int:
    duration_sec = max(60, int((end - start).total_seconds()))
    if unit == 2:
        bar_seconds = 60 * unit_number
    elif unit == 3:
        bar_seconds = 3600 * unit_number
    elif unit == 1:
        bar_seconds = unit_number
    elif unit == 4:
        bar_seconds = 86400 * unit_number
    else:
        bar_seconds = 60 * unit_number
    estimated = (duration_sec // bar_seconds) + 10
    return min(MAX_BARS_PER_REQUEST, max(estimated, 10))


def session_time_bounds(
    started_at: datetime | None,
    ended_at: datetime | None,
) -> tuple[datetime, datetime]:
    now = django_tz.now()
    if started_at is None and ended_at is None:
        end = now
        start = end - timedelta(hours=1)
    elif started_at is None:
        end = ended_at  # type: ignore[assignment]
        start = end - timedelta(hours=1)
    elif ended_at is None:
        start = started_at
        end = now
    else:
        start = started_at
        end = ended_at

    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)

    return start - BUFFER_BEFORE, end + BUFFER_AFTER


def fetch_market_data_for_session(
    client: TopStepXApiClient,
    auth_token: str,
    events: Iterable[Any],
    *,
    started_at: datetime | None,
    ended_at: datetime | None,
    live: bool = False,
) -> dict[str, Any]:
    events_list = list(events)
    contracts_map = collect_session_contract_ids(events_list)
    if not contracts_map:
        return {
            'status': 'no_contracts',
            'fetched_at': django_tz.now().isoformat(),
            'contracts': [],
        }

    fetch_start, fetch_end = session_time_bounds(started_at, ended_at)
    duration = fetch_end - fetch_start
    unit, unit_number = pick_bar_interval(duration)
    limit = estimate_bar_limit(fetch_start, fetch_end, unit, unit_number)
    fill_counts = count_fills_per_contract(events_list)

    contract_rows: list[dict[str, Any]] = []
    errors = 0

    for contract_id, label in contracts_map.items():
        try:
            bars = client.retrieve_bars(
                auth_token,
                contract_id=contract_id,
                live=live,
                start_time=fetch_start,
                end_time=fetch_end,
                unit=unit,
                unit_number=unit_number,
                limit=limit,
                include_partial_bar=False,
            )
            valid_bars = [
                b for b in bars
                if b.get('t') and b.get('o') is not None and b.get('c') is not None
            ]
            valid_bars.sort(key=lambda b: b['t'])
            contract_rows.append({
                'contract_id': contract_id,
                'label': label,
                'interval': {'unit': unit, 'unit_number': unit_number},
                'bars': valid_bars,
                'fill_count': fill_counts.get(contract_id, 0),
            })
        except TopStepXApiError as exc:
            errors += 1
            logger.warning(
                'retrieveBars échoué contract_id=%s: %s',
                contract_id,
                exc,
            )

    contract_rows.sort(
        key=lambda row: (-int(row.get('fill_count') or 0), str(row.get('label') or '')),
    )
    for row in contract_rows:
        row.pop('fill_count', None)

    if not contract_rows:
        status = 'unavailable'
    elif errors and errors < len(contracts_map):
        status = 'partial'
    elif errors:
        status = 'unavailable'
    else:
        status = 'ok'

    return {
        'status': status,
        'fetched_at': django_tz.now().isoformat(),
        'contracts': contract_rows,
    }


def refresh_session_market_data(
    session: Any,
    client: TopStepXApiClient,
    auth_token: str,
    events: Iterable[Any] | None = None,
) -> dict[str, Any]:
    """Re-fetch barres pour une session existante sans reconstruire la timeline."""
    if events is None:
        events = session.events.order_by('sequence')
    market_data = fetch_market_data_for_session(
        client,
        auth_token,
        events,
        started_at=session.started_at,
        ended_at=session.ended_at,
    )
    session.market_data = market_data
    session.save(update_fields=['market_data', 'updated_at'])
    return market_data
