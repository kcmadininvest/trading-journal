from __future__ import annotations

import time
from datetime import date

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils.dateparse import parse_date

from market_data.models import BarCoverage, HistoricalBar
from market_data.services.aggregate_storage import (
    AGGREGATED_BAR_SOURCE,
    DERIVED_TIMEFRAMES,
    aggregate_contract_range,
    normalized_bar_from_model,
)
from market_data.services.aggregation import aggregate_m1_session
from market_data.services.sessions import get_session_profile, session_bounds_utc
from market_data.services.timeframes import parse_timeframe

User = get_user_model()


class Command(BaseCommand):
    help = 'Prévisualise ou reconstruit les timeframes dérivés depuis les bougies 1m (par user).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--user',
            required=True,
            help='Username (ou id numérique) du propriétaire des barres.',
        )
        parser.add_argument('--instrument', action='append', dest='instruments')
        parser.add_argument('--contract', action='append', dest='contracts')
        parser.add_argument('--start')
        parser.add_argument('--end')
        parser.add_argument('--timeframes', default=','.join(DERIVED_TIMEFRAMES))
        parser.add_argument('--pause-ms', type=int, default=100)
        parser.add_argument('--apply', action='store_true')

    def handle(self, *args, **options):
        user = self._resolve_user(options['user'])
        instruments = {value.upper().strip() for value in options['instruments'] or []}
        contracts = {value.strip() for value in options['contracts'] or []}
        start_date = self._parse_optional_date(options['start'], '--start')
        end_date = self._parse_optional_date(options['end'], '--end')
        if start_date and end_date and start_date > end_date:
            raise CommandError('--start doit être antérieur ou égal à --end.')
        if options['pause_ms'] < 0:
            raise CommandError('--pause-ms doit être positif ou nul.')

        try:
            timeframes = tuple(dict.fromkeys(
                parse_timeframe(raw.strip()).code
                for raw in options['timeframes'].split(',')
                if raw.strip()
            ))
        except ValueError as exc:
            raise CommandError(str(exc)) from exc
        if not timeframes or '1m' in timeframes:
            raise CommandError('Sélectionnez au moins un timeframe dérivé, sans 1m.')
        unsupported = set(timeframes) - set(DERIVED_TIMEFRAMES)
        if unsupported:
            raise CommandError(f'Timeframes non dérivés: {sorted(unsupported)}')
        if options['apply'] and (start_date or end_date):
            raise CommandError(
                'Un apply doit couvrir tout l’historique du ou des contrats sélectionnés; '
                'retirez --start/--end et utilisez-les uniquement pour le dry-run.',
            )

        groups = self._session_groups(user, instruments, contracts, start_date, end_date, timeframes)
        if not groups:
            self.stdout.write('Aucune séance M1 ou timeframe dérivé à traiter.')
            return

        self.stdout.write(f'User: {user.username} (id={user.pk})')
        self.stdout.write('Mode: application demandée' if options['apply'] else 'Mode: DRY-RUN — aucune modification')
        self.stdout.write(f'Séances: {len(groups)} | Timeframes: {", ".join(timeframes)}')
        totals = {code: {'existing': 0, 'proposed': 0} for code in timeframes}

        for instrument, contract_id, session_date in groups:
            rows = list(
                HistoricalBar.objects.filter(
                    user=user,
                    instrument=instrument,
                    contract_id=contract_id,
                    timeframe='1m',
                    session_date=session_date,
                ).order_by('timestamp_utc')
            )
            source_bars = [normalized_bar_from_model(row) for row in rows]
            for timeframe in timeframes:
                result = aggregate_m1_session(
                    source_bars,
                    instrument=instrument,
                    session_date=session_date,
                    timeframe=timeframe,
                )
                existing = HistoricalBar.objects.filter(
                    user=user,
                    instrument=instrument,
                    contract_id=contract_id,
                    timeframe=timeframe,
                    session_date=session_date,
                ).count()
                proposed = result.report.bars_stored
                totals[timeframe]['existing'] += existing
                totals[timeframe]['proposed'] += proposed
                self.stdout.write(
                    f'{instrument} {contract_id} {session_date} {timeframe}: '
                    f'M1={len(source_bars)} existantes={existing} calculées={proposed} '
                    f'couverture={result.report.status}',
                )

        for timeframe, counts in totals.items():
            self.stdout.write(
                f'Total {timeframe}: existantes={counts["existing"]} '
                f'calculées={counts["proposed"]}',
            )

        if options['apply']:
            confirmation = input(
                'Cette opération remplace les timeframes dérivés, sans toucher aux 1m. '
                'Tapez REBUILD pour confirmer: ',
            )
            if confirmation != 'REBUILD':
                raise CommandError('Reconstruction non appliquée.')
            for instrument, contract_id, session_date in groups:
                rows = list(
                    HistoricalBar.objects.filter(
                        user=user,
                        instrument=instrument,
                        contract_id=contract_id,
                        timeframe='1m',
                        session_date=session_date,
                    ).order_by('timestamp_utc')
                )
                start_utc, end_utc = session_bounds_utc(session_date, instrument)
                aggregate_contract_range(
                    user=user,
                    instrument=instrument,
                    contract_id=contract_id,
                    start=start_utc,
                    end=end_utc,
                    timeframes=timeframes,
                    symbol=rows[0].symbol if rows else contract_id,
                )
                if options['pause_ms']:
                    time.sleep(options['pause_ms'] / 1000)
            for instrument, contract_id in sorted({(row[0], row[1]) for row in groups}):
                BarCoverage.objects.filter(
                    user=user,
                    instrument=instrument,
                    contract_id=contract_id,
                    timeframe__in=timeframes,
                ).exclude(source=AGGREGATED_BAR_SOURCE).delete()
            self.stdout.write(self.style.SUCCESS('Reconstruction terminée.'))

    @staticmethod
    def _resolve_user(raw: str):
        raw = (raw or '').strip()
        if not raw:
            raise CommandError('--user est obligatoire.')
        if raw.isdigit():
            user = User.objects.filter(pk=int(raw)).first()
        else:
            user = User.objects.filter(username=raw).first()
        if user is None:
            raise CommandError(f'Utilisateur introuvable: {raw}')
        return user

    @staticmethod
    def _parse_optional_date(raw: str | None, option: str) -> date | None:
        if not raw:
            return None
        parsed = parse_date(raw)
        if parsed is None:
            raise CommandError(f'{option} doit être au format YYYY-MM-DD.')
        return parsed

    @staticmethod
    def _session_groups(user, instruments, contracts, start_date, end_date, timeframes):
        query = HistoricalBar.objects.filter(
            user=user,
            timeframe__in=('1m', *timeframes),
            session_date__isnull=False,
        )
        if instruments:
            query = query.filter(instrument__in=instruments)
        if contracts:
            query = query.filter(contract_id__in=contracts)
        if start_date:
            query = query.filter(session_date__gte=start_date)
        if end_date:
            query = query.filter(session_date__lte=end_date)
        rows = query.values_list('instrument', 'contract_id', 'session_date').distinct()
        return sorted(
            (instrument, contract_id, session_date)
            for instrument, contract_id, session_date in rows.iterator(chunk_size=1000)
            if get_session_profile(instrument) is not None
        )
