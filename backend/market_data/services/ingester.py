"""Insertion bulk des bougies historiques."""
from __future__ import annotations

from datetime import datetime
from typing import Iterable

from django.utils import timezone as django_tz

from market_data.models import HistoricalBar
from market_data.services.normalizer import NormalizedBar

DEFAULT_BATCH_SIZE = 2000


def bars_to_model_instances(
    bars: Iterable[NormalizedBar],
    *,
    instrument: str,
    symbol: str,
    contract_id: str,
    timeframe: str,
    source: str,
    fetched_at: datetime | None = None,
) -> list[HistoricalBar]:
    fetched_at = fetched_at or django_tz.now()
    instances: list[HistoricalBar] = []
    for bar in bars:
        instances.append(HistoricalBar(
            instrument=instrument,
            symbol=symbol,
            contract_id=contract_id,
            timeframe=timeframe,
            timestamp_utc=bar.timestamp_utc,
            open=bar.open,
            high=bar.high,
            low=bar.low,
            close=bar.close,
            volume=bar.volume,
            ny_date=bar.ny_date,
            ny_time=bar.ny_time,
            session_date=bar.session_date,
            is_rth=bar.is_rth,
            is_eth=bar.is_eth,
            is_us_session=bar.is_us_session,
            source=source,
            fetched_at=fetched_at,
            extra_raw=bar.extra_raw or {},
        ))
    return instances


def bulk_insert_bars(
    bars: Iterable[NormalizedBar],
    *,
    instrument: str,
    symbol: str,
    contract_id: str,
    timeframe: str = '1m',
    source: str = 'topstepx',
    fetched_at: datetime | None = None,
    batch_size: int = DEFAULT_BATCH_SIZE,
) -> int:
    """
    Insert par lots avec ignore_conflicts (contrainte unique).
    Retourne le nombre d'instances soumises (pas forcément créées).
    """
    instances = bars_to_model_instances(
        bars,
        instrument=instrument,
        symbol=symbol,
        contract_id=contract_id,
        timeframe=timeframe,
        source=source,
        fetched_at=fetched_at,
    )
    if not instances:
        return 0
    HistoricalBar.objects.bulk_create(
        instances,
        batch_size=batch_size,
        ignore_conflicts=True,
    )
    return len(instances)
