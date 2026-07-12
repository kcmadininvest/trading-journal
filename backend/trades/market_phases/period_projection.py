"""Projection des blocs sur périodes analytiques avec chevauchement pondéré."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import time, timedelta

MARKET_REGULAR_OPEN: dict[str, time] = {
    'NYSE': time(9, 30),
    'XPAR': time(9, 0),
    'XLON': time(8, 0),
    'XTKS': time(9, 0),
}

MARKET_REGULAR_CLOSE: dict[str, time] = {
    'NYSE': time(16, 0),
    'XPAR': time(17, 30),
    'XLON': time(16, 30),
    'XTKS': time(15, 0),
}


@dataclass(frozen=True)
class AnalyticalPeriod:
    key: str
    label: str
    start: time
    end: time


def _time_to_minutes(t: time) -> int:
    return t.hour * 60 + t.minute


def _minutes_to_time(minutes: int) -> time:
    minutes = minutes % (24 * 60)
    return time(minutes // 60, minutes % 60)


def parse_period_key(period_key: str) -> AnalyticalPeriod | None:
    """Parse '12:00-14:00' → AnalyticalPeriod."""
    if '-' not in period_key:
        return None
    start_s, end_s = period_key.split('-', 1)
    try:
        sh, sm = [int(x) for x in start_s.strip().split(':')]
        eh, em = [int(x) for x in end_s.strip().split(':')]
        start = time(sh, sm)
        end = time(eh, em)
    except (ValueError, TypeError):
        return None
    return AnalyticalPeriod(
        key=period_key,
        label=f'{start.strftime("%H:%M")} – {end.strftime("%H:%M")}',
        start=start,
        end=end,
    )


def overlap_minutes(
    block_start: time,
    block_end: time | None,
    period_start: time,
    period_end: time,
) -> float:
    """Minutes de chevauchement entre bloc et période (même jour)."""
    bs = _time_to_minutes(block_start)
    be = _time_to_minutes(block_end) if block_end else bs + 1
    ps = _time_to_minutes(period_start)
    pe = _time_to_minutes(period_end)
    if be <= bs:
        be += 24 * 60
    if pe <= ps:
        pe += 24 * 60
    start = max(bs, ps)
    end = min(be, pe)
    return max(0.0, float(end - start))


def block_duration_minutes(block_start: time, block_end: time | None) -> float:
    if block_end is None:
        return 1.0
    bs = _time_to_minutes(block_start)
    be = _time_to_minutes(block_end)
    if be <= bs:
        be += 24 * 60
    return max(1.0, float(be - bs))


def event_in_period(occurred_at: time, period_start: time, period_end: time) -> bool:
    t = _time_to_minutes(occurred_at)
    ps = _time_to_minutes(period_start)
    pe = _time_to_minutes(period_end)
    if pe <= ps:
        return t >= ps or t < pe
    return ps <= t < pe


def generate_hourly_periods() -> list[AnalyticalPeriod]:
    periods: list[AnalyticalPeriod] = []
    for h in range(24):
        start = time(h, 0)
        end = time((h + 1) % 24, 0)
        key = f'{start.strftime("%H:%M")}-{end.strftime("%H:%M")}'
        periods.append(AnalyticalPeriod(key=key, label=key.replace('-', ' – '), start=start, end=end))
    return periods


def generate_fixed_slots(
    duration_minutes: int,
    anchor_start: time,
    anchor_end: time | None = None,
) -> list[AnalyticalPeriod]:
    """Découpe régulière depuis anchor_start."""
    if anchor_end is None:
        anchor_end = time(23, 59)
    slots: list[AnalyticalPeriod] = []
    cur = _time_to_minutes(anchor_start)
    end_limit = _time_to_minutes(anchor_end)
    if end_limit <= cur:
        end_limit += 24 * 60
    while cur < end_limit:
        nxt = cur + duration_minutes
        start_t = _minutes_to_time(cur)
        end_t = _minutes_to_time(nxt)
        key = f'{start_t.strftime("%H:%M")}-{end_t.strftime("%H:%M")}'
        slots.append(
            AnalyticalPeriod(key=key, label=key.replace('-', ' – '), start=start_t, end=end_t)
        )
        cur = nxt
    return slots


def periods_from_captured_blocks(
    blocks_qs,
) -> list[AnalyticalPeriod]:
    """Périodes distinctes dérivées des blocs capturés (outil de saisie)."""
    seen: set[str] = set()
    result: list[AnalyticalPeriod] = []
    for block in blocks_qs.only('range_start', 'range_end'):
        if not block.range_end:
            continue
        key = f'{block.range_start.strftime("%H:%M")}-{block.range_end.strftime("%H:%M")}'
        if key in seen:
            continue
        seen.add(key)
        parsed = parse_period_key(key)
        if parsed:
            result.append(parsed)
    result.sort(key=lambda p: _time_to_minutes(p.start))
    return result


def periods_from_config(
    custom_periods: list[dict] | None,
    mode: str,
    *,
    duration_minutes: int = 60,
    anchor: str = 'clock_hour',
    market_code: str = 'NYSE',
) -> list[AnalyticalPeriod]:
    if mode == 'custom' and custom_periods:
        result: list[AnalyticalPeriod] = []
        for item in custom_periods:
            key = item.get('key') or f"{item.get('start')}-{item.get('end')}"
            parsed = parse_period_key(f"{item.get('start', '')}-{item.get('end', '')}")
            if parsed:
                result.append(
                    AnalyticalPeriod(
                        key=key,
                        label=item.get('label') or parsed.label,
                        start=parsed.start,
                        end=parsed.end,
                    )
                )
        if result:
            return result
    if mode == 'hour':
        return generate_hourly_periods()
    if mode == 'fixed':
        anchor_start = time(0, 0)
        anchor_end = time(23, 59)
        if anchor == 'market_open':
            anchor_start = MARKET_REGULAR_OPEN.get(market_code, time(9, 30))
            anchor_end = MARKET_REGULAR_CLOSE.get(market_code, time(16, 0))
        return generate_fixed_slots(duration_minutes, anchor_start, anchor_end)
    return generate_hourly_periods()
