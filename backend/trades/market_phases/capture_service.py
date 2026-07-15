"""Services capture : validation, upsert, liaison événements."""
from __future__ import annotations

from datetime import time

from django.core.exceptions import ValidationError
from django.db import models, transaction

from .models import (
    MarketPhaseDefinition,
    MarketPhaseEventDefinition,
    SessionMarketPhaseBlock,
    SessionMarketPhaseEvent,
)


def _time_minutes(t: time) -> int:
    return t.hour * 60 + t.minute


def _event_in_block(occurred_at: time, block: SessionMarketPhaseBlock) -> bool:
    start = _time_minutes(block.range_start)
    cur = _time_minutes(occurred_at)
    if block.range_end is None:
        return cur >= start
    end = _time_minutes(block.range_end)
    if end <= start:
        end += 24 * 60
        if cur < start:
            cur += 24 * 60
    return start <= cur <= end


def _times_overlap(s1: time, e1: time | None, s2: time, e2: time | None) -> bool:
    a1 = _time_minutes(s1)
    b1 = _time_minutes(e1) if e1 is not None else a1 + 1
    a2 = _time_minutes(s2)
    b2 = _time_minutes(e2) if e2 is not None else a2 + 1
    if b1 <= a1:
        b1 += 24 * 60
    if b2 <= a2:
        b2 += 24 * 60
    return a1 < b2 and a2 < b1


def validate_no_block_overlap(
    blocks: list[SessionMarketPhaseBlock],
    *,
    exclude_id: int | None = None,
) -> None:
    active = list(blocks)
    if exclude_id is not None:
        active = [b for b in active if getattr(b, 'id', None) != exclude_id]
    for i, b1 in enumerate(active):
        for b2 in active[i + 1:]:
            if _times_overlap(b1.range_start, b1.range_end, b2.range_start, b2.range_end):
                raise ValidationError('Les blocs de phase ne peuvent pas se chevaucher.')


def find_parent_block(
    blocks: list[SessionMarketPhaseBlock],
    occurred_at: time,
) -> SessionMarketPhaseBlock | None:
    for block in blocks:
        if _event_in_block(occurred_at, block):
            return block
    return None


def _resolve_phase(user, item: dict) -> MarketPhaseDefinition | None:
    phase_id = item.get('phase_id')
    phase_code = item.get('phase_code')
    if phase_id:
        return MarketPhaseDefinition.objects.filter(pk=phase_id).first()
    if phase_code:
        return MarketPhaseDefinition.objects.filter(code=phase_code).filter(
            models.Q(user=user) | models.Q(user__isnull=True, is_system=True)
        ).first()
    return None


def _resolve_event_type(user, item: dict) -> MarketPhaseEventDefinition | None:
    event_type_id = item.get('event_type_id')
    event_code = item.get('event_type_code')
    if event_type_id:
        return MarketPhaseEventDefinition.objects.filter(pk=event_type_id).first()
    if event_code:
        return MarketPhaseEventDefinition.objects.filter(code=event_code).filter(
            models.Q(user=user) | models.Q(user__isnull=True, is_system=True)
        ).first()
    return None


@transaction.atomic
def bulk_upsert_capture(
    *,
    user,
    trading_account,
    session_date,
    instrument_key: str,
    blocks_data: list[dict],
    events_data: list[dict],
    source: str = 'live',
    trading_session_id: int | None = None,
) -> tuple[list[SessionMarketPhaseBlock], list[SessionMarketPhaseEvent]]:
    SessionMarketPhaseBlock.objects.filter(
        user=user,
        trading_account=trading_account,
        session_date=session_date,
        instrument_key=instrument_key,
    ).delete()

    blocks: list[SessionMarketPhaseBlock] = []
    for item in blocks_data:
        phase = _resolve_phase(user, item)
        if not phase:
            continue
        block = SessionMarketPhaseBlock(
            user=user,
            trading_account=trading_account,
            session_date=session_date,
            instrument_key=instrument_key,
            range_start=item['range_start'],
            range_end=item.get('range_end'),
            phase=phase,
            preceding_context=item.get('preceding_context', 'none'),
            notes=(item.get('notes') or '')[:120],
            source=item.get('source', source),
            trading_session_id=trading_session_id,
        )
        block.full_clean()
        blocks.append(block)

    validate_no_block_overlap(blocks)
    for block in blocks:
        block.save()

    events: list[SessionMarketPhaseEvent] = []
    for item in events_data:
        event_type = _resolve_event_type(user, item)
        if not event_type:
            continue
        occurred = item['occurred_at']
        parent = find_parent_block(blocks, occurred)
        ev = SessionMarketPhaseEvent(
            user=user,
            trading_account=trading_account,
            session_date=session_date,
            instrument_key=instrument_key,
            occurred_at=occurred,
            event_type=event_type,
            direction=item.get('direction', 'neutral'),
            candle_part=item.get('candle_part', 'unknown'),
            outcome=item.get('outcome', 'unknown'),
            parent_block=parent,
            attributes=item.get('attributes') or {},
            source=item.get('source', source),
            trading_session_id=trading_session_id,
        )
        ev.save()
        events.append(ev)

    return blocks, events


@transaction.atomic
def delete_period_captures(
    *,
    user,
    instrument_key: str,
    date_from,
    date_to,
    trading_account_id: int | None = None,
    range_start: time | None = None,
    range_end: time | None = None,
    ranges: list[tuple[time, time]] | None = None,
) -> dict[str, int]:
    """Supprime les blocs (et événements liés) d'un ou plusieurs créneaux exacts sur une plage de dates."""
    from django.db.models import Q

    from .period_projection import event_in_period

    period_ranges: list[tuple[time, time]] = list(ranges or [])
    if range_start is not None and range_end is not None:
        period_ranges.append((range_start, range_end))
    # Déduplication en conservant l'ordre
    seen: set[tuple[time, time]] = set()
    unique_ranges: list[tuple[time, time]] = []
    for item in period_ranges:
        if item in seen:
            continue
        seen.add(item)
        unique_ranges.append(item)
    if not unique_ranges:
        return {'deleted_blocks': 0, 'deleted_events': 0}

    blocks_qs = SessionMarketPhaseBlock.objects.filter(
        user=user,
        instrument_key=instrument_key,
        session_date__gte=date_from,
        session_date__lte=date_to,
    )
    if trading_account_id is not None:
        blocks_qs = blocks_qs.filter(trading_account_id=trading_account_id)

    range_filter = Q()
    for start, end in unique_ranges:
        range_filter |= Q(range_start=start, range_end=end)
    blocks_qs = blocks_qs.filter(range_filter)

    block_ids = list(blocks_qs.values_list('id', flat=True))

    events_qs = SessionMarketPhaseEvent.objects.filter(
        user=user,
        instrument_key=instrument_key,
        session_date__gte=date_from,
        session_date__lte=date_to,
    )
    if trading_account_id is not None:
        events_qs = events_qs.filter(trading_account_id=trading_account_id)

    event_ids: list[int] = []
    for ev in events_qs.only('id', 'occurred_at', 'parent_block_id'):
        if ev.parent_block_id in block_ids:
            event_ids.append(ev.id)
            continue
        if any(event_in_period(ev.occurred_at, start, end) for start, end in unique_ranges):
            event_ids.append(ev.id)

    deleted_events = 0
    if event_ids:
        deleted_events, _ = SessionMarketPhaseEvent.objects.filter(id__in=event_ids).delete()

    deleted_blocks = 0
    if block_ids:
        deleted_blocks, _ = SessionMarketPhaseBlock.objects.filter(id__in=block_ids).delete()

    return {'deleted_blocks': deleted_blocks, 'deleted_events': deleted_events}
