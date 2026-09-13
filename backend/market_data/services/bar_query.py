"""API Python de lecture : get_bars / get_available_data."""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

import pandas as pd
from django.utils.dateparse import parse_datetime

from market_data.models import BarCoverage, HistoricalBar
from market_data.services.contracts import list_contracts_for_instrument
from market_data.services.roll import UnsupportedRollMethod, get_roll_method
from market_data.services.sessions import to_paris


def _parse_bound(value: str | date | datetime, *, end: bool = False) -> datetime:
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, date):
        if end:
            dt = datetime(value.year, value.month, value.day, 23, 59, 59, tzinfo=timezone.utc)
        else:
            dt = datetime(value.year, value.month, value.day, tzinfo=timezone.utc)
    else:
        raw = str(value).strip()
        dt = parse_datetime(raw)
        if dt is None:
            # date seule
            try:
                d = date.fromisoformat(raw[:10])
            except ValueError as exc:
                raise ValueError(f'Date invalide: {value!r}') from exc
            if end:
                dt = datetime(d.year, d.month, d.day, 23, 59, 59, tzinfo=timezone.utc)
            else:
                dt = datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _queryset_to_dataframe(qs) -> pd.DataFrame:
    rows = list(qs.values(
        'timestamp_utc',
        'open',
        'high',
        'low',
        'close',
        'volume',
        'instrument',
        'symbol',
        'contract_id',
        'timeframe',
        'ny_date',
        'ny_time',
        'session_date',
        'is_rth',
        'is_eth',
        'is_us_session',
        'source',
        'extra_raw',
    ))
    if not rows:
        return pd.DataFrame(columns=[
            'timestamp_utc', 'open', 'high', 'low', 'close', 'volume',
            'instrument', 'symbol', 'contract_id', 'timeframe',
            'ny_date', 'ny_time', 'session_date',
            'is_rth', 'is_eth', 'is_us_session', 'source', 'extra_raw',
            'is_roll',
        ])
    df = pd.DataFrame(rows)
    df['is_roll'] = False
    df = df.sort_values('timestamp_utc').reset_index(drop=True)
    return df


def get_bars(
    instrument: str,
    timeframe: str = '1m',
    start: str | date | datetime = '',
    end: str | date | datetime = '',
    contract: str | None = None,
    roll_method: str = 'calendar',
    *,
    include_paris: bool = False,
) -> pd.DataFrame:
    """
    Retourne un DataFrame de bougies brutes, chronologiques, non ajustées.

    - contract=<id réel> : une série d'un seul contrat
    - contract="front" : vue assemblée via roll_method (défaut calendar)
    - contract=None : tous les contrats de l'instrument sur la période
      (plusieurs contract_id possibles — pas une série continue)
    """
    instrument = (instrument or '').upper().strip()
    if not instrument:
        raise ValueError('instrument requis')
    start_dt = _parse_bound(start, end=False)
    end_dt = _parse_bound(end, end=True)
    if start_dt >= end_dt:
        raise ValueError('start doit être < end')

    contract_key = (contract or '').strip()

    if contract_key and contract_key.lower() != 'front':
        qs = HistoricalBar.objects.filter(
            instrument=instrument,
            timeframe=timeframe,
            contract_id=contract_key,
            timestamp_utc__gte=start_dt,
            timestamp_utc__lt=end_dt,
        ).order_by('timestamp_utc')
        df = _queryset_to_dataframe(qs)
    elif contract_key.lower() == 'front':
        method = get_roll_method(roll_method)
        contracts = list_contracts_for_instrument(
            instrument,
            start=start_dt.date(),
            end=end_dt.date(),
        )
        # Enrichir avec les contrats déjà en base
        db_cids = (
            HistoricalBar.objects.filter(
                instrument=instrument,
                timeframe=timeframe,
                timestamp_utc__gte=start_dt,
                timestamp_utc__lt=end_dt,
            )
            .values_list('contract_id', flat=True)
            .distinct()
        )
        known_ids = {c.contract_id for c in contracts}
        from market_data.services.contracts import parse_expiry_from_contract_id, ResolvedContract
        for cid in db_cids:
            if cid in known_ids:
                continue
            month, year, expiry = parse_expiry_from_contract_id(cid)
            contracts.append(ResolvedContract(
                contract_id=cid,
                instrument=instrument,
                symbol='',
                symbol_id='',
                broker_symbol='',
                expiry_month=month,
                expiry_year=year,
                expiry_date=expiry,
                raw={},
            ))
            known_ids.add(cid)

        segments = method.segments(contracts, start_dt, end_dt)
        frames: list[pd.DataFrame] = []
        for seg in segments:
            qs = HistoricalBar.objects.filter(
                instrument=instrument,
                timeframe=timeframe,
                contract_id=seg.contract_id,
                timestamp_utc__gte=seg.start,
                timestamp_utc__lt=seg.end,
            ).order_by('timestamp_utc')
            part = _queryset_to_dataframe(qs)
            if not part.empty:
                frames.append(part)
        if not frames:
            df = _queryset_to_dataframe(HistoricalBar.objects.none())
        else:
            df = pd.concat(frames, ignore_index=True)
            df = df.sort_values('timestamp_utc').reset_index(drop=True)
            # Marquer is_roll sur la première barre d'un nouveau contract_id
            df['is_roll'] = False
            if len(df) > 0:
                prev = None
                roll_flags = []
                for cid in df['contract_id']:
                    roll_flags.append(prev is not None and cid != prev)
                    prev = cid
                df['is_roll'] = roll_flags
    else:
        qs = HistoricalBar.objects.filter(
            instrument=instrument,
            timeframe=timeframe,
            timestamp_utc__gte=start_dt,
            timestamp_utc__lt=end_dt,
        ).order_by('timestamp_utc')
        df = _queryset_to_dataframe(qs)

    if include_paris and not df.empty:
        df['timestamp_paris'] = df['timestamp_utc'].apply(
            lambda ts: to_paris(ts.to_pydatetime() if hasattr(ts, 'to_pydatetime') else ts)
        )
    return df


def get_available_data(instrument: str | None = None) -> list[dict[str, Any]]:
    """Agrège BarCoverage pour connaître les périodes téléchargées."""
    qs = BarCoverage.objects.all()
    if instrument:
        qs = qs.filter(instrument=instrument.upper().strip())
    qs = qs.order_by('instrument', 'contract_id', 'start_utc')

    # Agrégation simple par instrument + contract + timeframe
    grouped: dict[tuple, dict[str, Any]] = {}
    for cov in qs:
        key = (cov.instrument, cov.contract_id, cov.timeframe)
        entry = grouped.get(key)
        if entry is None:
            grouped[key] = {
                'instrument': cov.instrument,
                'contract_id': cov.contract_id,
                'timeframe': cov.timeframe,
                'start_utc': cov.start_utc.isoformat(),
                'end_utc': cov.end_utc.isoformat(),
                'bars_stored': cov.bars_stored,
                'bars_expected': cov.bars_expected,
                'unexpected_missing_count': cov.unexpected_missing_count,
                'status': cov.status,
                'ranges': [{
                    'start_utc': cov.start_utc.isoformat(),
                    'end_utc': cov.end_utc.isoformat(),
                    'status': cov.status,
                    'bars_stored': cov.bars_stored,
                    'bars_expected': cov.bars_expected,
                }],
            }
        else:
            entry['bars_stored'] += cov.bars_stored
            entry['bars_expected'] += cov.bars_expected
            entry['unexpected_missing_count'] += cov.unexpected_missing_count
            if cov.start_utc.isoformat() < entry['start_utc']:
                entry['start_utc'] = cov.start_utc.isoformat()
            if cov.end_utc.isoformat() > entry['end_utc']:
                entry['end_utc'] = cov.end_utc.isoformat()
            # Status global : complete seulement si toutes les plages le sont
            if entry['status'] != BarCoverage.Status.COMPLETE or cov.status != BarCoverage.Status.COMPLETE:
                if cov.status == BarCoverage.Status.EMPTY and entry['status'] == BarCoverage.Status.EMPTY:
                    entry['status'] = BarCoverage.Status.EMPTY
                else:
                    entry['status'] = BarCoverage.Status.PARTIAL
            entry['ranges'].append({
                'start_utc': cov.start_utc.isoformat(),
                'end_utc': cov.end_utc.isoformat(),
                'status': cov.status,
                'bars_stored': cov.bars_stored,
                'bars_expected': cov.bars_expected,
            })

    return list(grouped.values())
