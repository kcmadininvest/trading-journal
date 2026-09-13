"""
Abstraction des méthodes de roll pour la vue « front ».

Les OHLCV ne sont jamais réécrits — on retourne uniquement des segments
(contract_id, start, end).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Protocol

from market_data.services.contracts import ResolvedContract, expiry_cycle_months


class UnsupportedRollMethod(ValueError):
    """Méthode de roll non enregistrée / non implémentée."""


@dataclass(frozen=True)
class RollSegment:
    contract_id: str
    start: datetime
    end: datetime


class RollMethod(Protocol):
    name: str

    def segments(
        self,
        contracts: list[ResolvedContract],
        start: datetime,
        end: datetime,
    ) -> list[RollSegment]:
        ...


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def calendar_roll_date(expiry: date, instrument: str) -> date:
    """
    Date de roll calendaire par défaut (indices equity) :
    jeudi 8 jours calendaires avant l'échéance (approx. 8 days before expiry).
    Autres familles : 8 jours avant également (extensible plus tard).
    """
    _ = instrument
    return expiry - timedelta(days=8)


class CalendarRollMethod:
    name = 'calendar'

    def segments(
        self,
        contracts: list[ResolvedContract],
        start: datetime,
        end: datetime,
    ) -> list[RollSegment]:
        start = _as_utc(start)
        end = _as_utc(end)
        usable = [c for c in contracts if c.expiry_date is not None]
        usable.sort(key=lambda c: c.expiry_date or date.max)
        if not usable:
            return []

        # Construire les fenêtres front : [prev_roll, roll) pour chaque contrat
        segments: list[RollSegment] = []
        for i, contract in enumerate(usable):
            assert contract.expiry_date is not None
            roll_at = calendar_roll_date(contract.expiry_date, contract.instrument)
            # Début de ce front : roll du précédent, ou start
            if i == 0:
                seg_start_date = start.date()
            else:
                prev = usable[i - 1]
                assert prev.expiry_date is not None
                seg_start_date = calendar_roll_date(prev.expiry_date, prev.instrument)

            seg_end_date = roll_at
            # Convertir en datetime UTC (début de journée NY approx → UTC midnight ok pour découpage)
            seg_start = datetime(seg_start_date.year, seg_start_date.month, seg_start_date.day, tzinfo=timezone.utc)
            seg_end = datetime(seg_end_date.year, seg_end_date.month, seg_end_date.day, tzinfo=timezone.utc)

            # Clip à la fenêtre demandée
            clipped_start = max(seg_start, start)
            clipped_end = min(seg_end, end)
            if clipped_start < clipped_end:
                segments.append(RollSegment(
                    contract_id=contract.contract_id,
                    start=clipped_start,
                    end=clipped_end,
                ))

        # Si le dernier roll est avant end, étendre le dernier contrat jusqu'à end
        if segments and segments[-1].end < end:
            last = segments[-1]
            segments[-1] = RollSegment(last.contract_id, last.start, end)
        elif not segments and usable:
            # Aucun roll dans la fenêtre : prendre le front le plus proche
            # (contrat dont roll_date est le plus proche après start)
            chosen = usable[0]
            for c in usable:
                assert c.expiry_date is not None
                if calendar_roll_date(c.expiry_date, c.instrument) > start.date():
                    chosen = c
                    break
            segments.append(RollSegment(chosen.contract_id, start, end))

        return segments


_REGISTRY: dict[str, RollMethod] = {
    'calendar': CalendarRollMethod(),
}


def register_roll_method(method: RollMethod) -> None:
    _REGISTRY[method.name] = method


def get_roll_method(name: str) -> RollMethod:
    key = (name or 'calendar').strip().lower()
    if key in ('volume', 'open_interest') and key not in _REGISTRY:
        raise UnsupportedRollMethod(
            f'roll_method={key!r} n\'est pas encore implémenté. '
            f'Méthodes disponibles: {sorted(_REGISTRY)}'
        )
    method = _REGISTRY.get(key)
    if method is None:
        raise UnsupportedRollMethod(
            f'roll_method={key!r} inconnu. Méthodes disponibles: {sorted(_REGISTRY)}'
        )
    return method
