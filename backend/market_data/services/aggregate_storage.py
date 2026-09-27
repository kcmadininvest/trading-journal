from __future__ import annotations

from datetime import date, datetime
from typing import Callable, Iterable

from django.db import transaction
from django.utils import timezone

from market_data.models import BarCoverage, HistoricalBar
from market_data.services.aggregation import aggregate_m1_session
from market_data.services.ingester import bulk_insert_bars
from market_data.services.normalizer import NormalizedBar
from market_data.services.sessions import session_bounds_utc
from market_data.services.timeframes import ALLOWED_TIMEFRAMES, parse_timeframe

DERIVED_TIMEFRAMES = tuple(code for code in ALLOWED_TIMEFRAMES if code != '1m')
AGGREGATED_BAR_SOURCE = 'local_1m_aggregate'


def normalized_bar_from_model(row: HistoricalBar) -> NormalizedBar:
    return NormalizedBar(
        timestamp_utc=row.timestamp_utc,
        open=row.open,
        high=row.high,
        low=row.low,
        close=row.close,
        volume=row.volume,
        ny_date=row.ny_date,
        ny_time=row.ny_time,
        session_date=row.session_date,
        is_rth=row.is_rth,
        is_eth=row.is_eth,
        is_us_session=row.is_us_session,
        profile_known=True,
        extra_raw=row.extra_raw or {},
    )


def _persist_session_timeframe(
    m1_bars: list[NormalizedBar],
    *,
    instrument: str,
    contract_id: str,
    symbol: str,
    session_date: date,
    timeframe: str,
) -> int:
    """
    Remplace les TF dérivés de la séance par l'agrégat M1 local.

    Politique : dès que du M1 est présent, toutes les sources du couple
    (contrat, TF, séance) sont effacées puis réécrites en
    ``local_1m_aggregate`` (source de vérité pour les TF dérivés profilés).
    Sans M1, ne pas appeler cette fonction — voir ``aggregate_contract_range``.
    """
    result = aggregate_m1_session(
        m1_bars,
        instrument=instrument,
        session_date=session_date,
        timeframe=timeframe,
    )
    start_utc, end_utc = session_bounds_utc(session_date, instrument)

    with transaction.atomic():
        HistoricalBar.objects.filter(
            instrument=instrument,
            contract_id=contract_id,
            timeframe=timeframe,
            session_date=session_date,
        ).delete()
        inserted = bulk_insert_bars(
            result.bars,
            instrument=instrument,
            symbol=symbol,
            contract_id=contract_id,
            timeframe=timeframe,
            source=AGGREGATED_BAR_SOURCE,
        )
        BarCoverage.objects.filter(
            instrument=instrument,
            contract_id=contract_id,
            timeframe=timeframe,
            source=AGGREGATED_BAR_SOURCE,
            start_utc=start_utc,
            end_utc=end_utc,
        ).delete()
        BarCoverage.objects.create(
            instrument=instrument,
            contract_id=contract_id,
            timeframe=timeframe,
            start_utc=start_utc,
            end_utc=end_utc,
            bars_stored=result.report.bars_stored,
            bars_expected=result.report.bars_expected,
            expected_gap_count=result.report.expected_gap_count,
            unexpected_missing_count=result.report.unexpected_missing_count,
            status=result.report.status,
            source=AGGREGATED_BAR_SOURCE,
            fetched_at=timezone.now(),
        )
    return inserted


def aggregate_contract_range(
    *,
    instrument: str,
    contract_id: str,
    start: datetime,
    end: datetime,
    timeframes: Iterable[str],
    symbol: str = '',
    should_cancel: Callable[[], bool] | None = None,
) -> dict[str, int]:
    instrument = (instrument or '').upper().strip()
    contract_id = (contract_id or '').strip()
    if not instrument or not contract_id:
        raise ValueError('Instrument et contrat requis pour agréger les bougies.')
    if start >= end:
        return {}

    parsed_codes = []
    for raw_code in timeframes:
        code = parse_timeframe(raw_code).code
        if code != '1m' and code not in parsed_codes:
            parsed_codes.append(code)
    codes = tuple(parsed_codes)
    if not codes:
        return {}
    unsupported = set(codes) - set(DERIVED_TIMEFRAMES)
    if unsupported:
        raise ValueError(f'Timeframes dérivés non pris en charge: {sorted(unsupported)}')

    # Uniquement les séances qui ont du M1 : agréger sans M1 effacerait les
    # TF dérivés existants (delete + insert 0).
    sessions = sorted(set(HistoricalBar.objects.filter(
        instrument=instrument,
        contract_id=contract_id,
        timeframe='1m',
        session_date__isnull=False,
        timestamp_utc__gte=start,
        timestamp_utc__lt=end,
    ).values_list('session_date', flat=True).distinct()))

    counts = {code: 0 for code in codes}
    for session_date in sessions:
        if should_cancel and should_cancel():
            break
        rows = list(
            HistoricalBar.objects.filter(
                instrument=instrument,
                contract_id=contract_id,
                timeframe='1m',
                session_date=session_date,
            ).order_by('timestamp_utc')
        )
        if not rows:
            continue
        session_bars = [normalized_bar_from_model(row) for row in rows]
        session_symbol = symbol or rows[0].symbol or contract_id
        for code in codes:
            counts[code] += _persist_session_timeframe(
                session_bars,
                instrument=instrument,
                contract_id=contract_id,
                symbol=session_symbol,
                session_date=session_date,
                timeframe=code,
            )
    return counts
