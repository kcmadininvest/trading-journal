"""Profils de séance futures (IANA) — métadonnées calendaires, pas de stratégie."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Iterable
from zoneinfo import ZoneInfo

NY_TZ = ZoneInfo('America/New_York')
PARIS_TZ = ZoneInfo('Europe/Paris')
UTC = ZoneInfo('UTC')

# Indices equity CME Globex
EQUITY_INDEX_INSTRUMENTS = frozenset({
    'NQ', 'MNQ', 'ES', 'MES', 'RTY', 'M2K', 'YM', 'MYM', 'EMD', 'NKD',
})


@dataclass(frozen=True)
class SessionFlags:
    ny_date: date
    ny_time: time
    session_date: date
    is_rth: bool
    is_eth: bool
    is_us_session: bool
    profile_known: bool


@dataclass(frozen=True)
class SessionProfile:
    """Horaires en America/New_York."""

    name: str
    # Séance Globex : ouverture la veille à open_et jusqu'à close_et le jour de séance
    eth_open: time  # ex. 18:00
    eth_close: time  # ex. 17:00
    rth_open: time  # ex. 09:30
    rth_close: time  # ex. 16:00
    daily_halt_start: time | None = time(17, 0)  # 17:00
    daily_halt_end: time | None = time(18, 0)  # 18:00


EQUITY_CME_PROFILE = SessionProfile(
    name='equity_cme_globex',
    eth_open=time(18, 0),
    eth_close=time(17, 0),
    rth_open=time(9, 30),
    rth_close=time(16, 0),
    daily_halt_start=time(17, 0),
    daily_halt_end=time(18, 0),
)


def get_session_profile(instrument: str) -> SessionProfile | None:
    root = (instrument or '').upper().strip()
    if root in EQUITY_INDEX_INSTRUMENTS:
        return EQUITY_CME_PROFILE
    return None


def to_ny(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(NY_TZ)


def to_paris(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(PARIS_TZ)


def session_date_for(dt_utc: datetime, profile: SessionProfile | None) -> date:
    """
    Date de séance CME equity : une séance = 18:00 ET J-1 → 17:00 ET J.
    Avant 18:00 ET le dimanche / après halt : date du jour civil NY si >= 18:00
    sinon date du jour civil NY (séance courante).
    """
    ny = to_ny(dt_utc)
    if profile is None:
        return ny.date()
    # Si heure NY >= eth_open (18:00), la séance porte la date du lendemain civil
    if ny.timetz().replace(tzinfo=None) >= profile.eth_open:
        return (ny.date() + timedelta(days=1))
    return ny.date()


def compute_session_flags(dt_utc: datetime, instrument: str) -> SessionFlags:
    profile = get_session_profile(instrument)
    ny = to_ny(dt_utc)
    ny_date = ny.date()
    ny_time = ny.time().replace(microsecond=0)
    profile_known = profile is not None

    if profile is None:
        return SessionFlags(
            ny_date=ny_date,
            ny_time=ny_time,
            session_date=ny_date,
            is_rth=False,
            is_eth=False,
            is_us_session=False,
            profile_known=False,
        )

    t = ny_time
    is_rth = profile.rth_open <= t < profile.rth_close
    # ETH = dans la fenêtre Globex hors RTH (et hors halt quotidien)
    in_halt = False
    if profile.daily_halt_start and profile.daily_halt_end:
        in_halt = profile.daily_halt_start <= t < profile.daily_halt_end

    # Globex: 18:00→24:00 ou 00:00→17:00
    in_globex = (t >= profile.eth_open) or (t < profile.eth_close)
    is_eth = in_globex and not is_rth and not in_halt
    is_us_session = is_rth

    return SessionFlags(
        ny_date=ny_date,
        ny_time=ny_time,
        session_date=session_date_for(dt_utc, profile),
        is_rth=is_rth,
        is_eth=is_eth,
        is_us_session=is_us_session,
        profile_known=profile_known,
    )


def _is_weekend_closed(ny_dt: datetime, profile: SessionProfile) -> bool:
    """
    Globex equity : fermé ven. 17:00 ET → dim. 18:00 ET.
    """
    wd = ny_dt.weekday()  # 0=Mon … 6=Sun
    t = ny_dt.time().replace(microsecond=0)
    if wd == 4 and t >= (profile.daily_halt_start or time(17, 0)):
        return True
    if wd == 5:
        return True
    if wd == 6 and t < profile.eth_open:
        return True
    return False


def _is_daily_halt(ny_dt: datetime, profile: SessionProfile) -> bool:
    if not profile.daily_halt_start or not profile.daily_halt_end:
        return False
    t = ny_dt.time().replace(microsecond=0)
    return profile.daily_halt_start <= t < profile.daily_halt_end


def is_expected_gap_minute(dt_utc: datetime, instrument: str) -> bool:
    """True si cette minute M1 n'est pas attendue (halt / week-end)."""
    profile = get_session_profile(instrument)
    if profile is None:
        return False
    ny = to_ny(dt_utc)
    if _is_weekend_closed(ny, profile):
        return True
    if _is_daily_halt(ny, profile):
        return True
    return False


def expected_timestamps(
    start_utc: datetime,
    end_utc: datetime,
    instrument: str,
    *,
    bar_seconds: int = 60,
) -> list[datetime]:
    """
    Liste des timestamps UTC attendus (début de bougie) pour la plage,
    hors expected_gap (halt / week-end). Jours fériés : non exclus ici
    (conservateur — un manque férié apparaîtra comme gap et pourra être
    reclassé plus tard).
    """
    if start_utc.tzinfo is None:
        start_utc = start_utc.replace(tzinfo=UTC)
    if end_utc.tzinfo is None:
        end_utc = end_utc.replace(tzinfo=UTC)

    # Alignement sur la minute
    cur = start_utc.astimezone(UTC).replace(second=0, microsecond=0)
    end = end_utc.astimezone(UTC)
    step = timedelta(seconds=bar_seconds)
    out: list[datetime] = []
    while cur < end:
        if not is_expected_gap_minute(cur, instrument):
            out.append(cur)
        cur += step
    return out


def count_expected_vs_gaps(
    start_utc: datetime,
    end_utc: datetime,
    instrument: str,
    *,
    bar_seconds: int = 60,
) -> tuple[int, int]:
    """Retourne (bars_expected, expected_gap_count) sur la plage."""
    if start_utc.tzinfo is None:
        start_utc = start_utc.replace(tzinfo=UTC)
    if end_utc.tzinfo is None:
        end_utc = end_utc.replace(tzinfo=UTC)

    cur = start_utc.astimezone(UTC).replace(second=0, microsecond=0)
    end = end_utc.astimezone(UTC)
    step = timedelta(seconds=bar_seconds)
    expected = 0
    gaps = 0
    while cur < end:
        if is_expected_gap_minute(cur, instrument):
            gaps += 1
        else:
            expected += 1
        cur += step
    return expected, gaps
