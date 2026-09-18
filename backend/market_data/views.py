"""API HTTP market_data — téléchargement / couverture / instruments."""
from __future__ import annotations

import csv
import io
import logging
from datetime import date as date_cls

from django.http import HttpResponse
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from integrations.topstepx_auth import (
    call_with_valid_session_token,
    get_topstepx_integration,
)
from integrations.topstepx_client import TopStepXApiClient, TopStepXApiError
from market_data.models import (
    BarQualityIssue,
    HistoricalDownloadJob,
    HistoricalSyncRun,
    HistoricalSyncSchedulerState,
    HistoricalSyncSettings,
)
from market_data.serializers import (
    DownloadJobCreateSerializer,
    DownloadJobSerializer,
    QualityIssueSerializer,
    SyncRunSerializer,
    SyncSettingsSerializer,
)
from market_data.services.available_timeframes import (
    latest_replay_coverage,
    list_available_timeframes,
    list_instruments_with_stored_bars,
)
from market_data.services.bar_query import get_available_data, get_bars
from market_data.services.contracts import list_contracts_for_instrument
from market_data.services.download_dispatch import (
    abandon_stale_pending_jobs,
    abandon_stale_running_jobs,
    cancel_active_jobs_for_user,
    celery_workers_available,
    dispatch_historical_download,
)
from market_data.services.instruments import list_instruments, search_instruments
from market_data.services.replay_bars import ReplayBarsError, fetch_replay_bars
from market_data.services.sync_schedule import (
    SCHEDULER_STALE_MINUTES,
    run_sync_for_settings,
    scheduler_is_healthy,
)
from market_data.services.timeframes import UnknownTimeframe, parse_timeframe

logger = logging.getLogger(__name__)

CSV_EXPORT_COLUMNS = (
    'timestamp',
    'open',
    'high',
    'low',
    'close',
    'volume',
    'contract_id',
)
MAX_CSV_ROWS = 500_000


class HistoricalDownloadThrottle(UserRateThrottle):
    """Quota POST downloads — rate lue dans REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']."""
    scope = 'historical_download'


def _require_topstepx(user):
    integration = get_topstepx_integration(user)
    if integration is None:
        return None, Response(
            {'detail': 'Intégration TopStepX requise. Configurez-la dans Paramètres.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return integration, None


def _parse_query_date(raw: str | None) -> date_cls | None:
    if not raw:
        return None
    dt = parse_datetime(raw.replace('Z', '+00:00'))
    if dt is not None:
        return dt.date()
    try:
        return date_cls.fromisoformat(raw[:10])
    except ValueError:
        return None


class InstrumentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        with_bars = (request.query_params.get('with_bars') or '').strip().lower() in (
            '1', 'true', 'yes',
        )
        if with_bars:
            # Pas besoin TopStepX : uniquement les racines présentes en base.
            roots = set(list_instruments_with_stored_bars())
            catalog = {i.instrument: i for i in list_instruments()}
            payload = []
            for root in sorted(roots):
                info = catalog.get(root)
                if info is not None:
                    payload.append({
                        'instrument': info.instrument,
                        'symbol_id': info.symbol_id,
                        'broker_symbol': info.broker_symbol,
                        'name': info.name,
                        'tick_size': info.tick_size,
                        'tick_value': info.tick_value,
                    })
                else:
                    payload.append({
                        'instrument': root,
                        'symbol_id': '',
                        'broker_symbol': '',
                        'name': root,
                        'tick_size': None,
                        'tick_value': None,
                    })
            return Response(payload)

        integration, err = _require_topstepx(request.user)
        if err:
            return err
        q = (request.query_params.get('q') or '').strip()
        client = TopStepXApiClient()
        try:
            def _list(tok: str):
                if q:
                    return search_instruments(q, client=client, auth_token=tok)
                return list_instruments(client=client, auth_token=tok)

            instruments = call_with_valid_session_token(integration, _list)
        except TopStepXApiError as exc:
            logger.warning('list instruments fallback catalog: %s', exc)
            instruments = list_instruments()

        return Response([
            {
                'instrument': i.instrument,
                'symbol_id': i.symbol_id,
                'broker_symbol': i.broker_symbol,
                'name': i.name,
                'tick_size': i.tick_size,
                'tick_value': i.tick_value,
            }
            for i in instruments
        ])


class InstrumentTimeframesView(APIView):
    """Timeframes OHLC réellement disponibles pour un instrument."""

    permission_classes = [IsAuthenticated]

    def get(self, request, instrument: str):
        symbol = (instrument or '').upper().strip()
        if not symbol:
            return Response({'detail': 'Instrument requis.'}, status=400)
        timeframes = list_available_timeframes(symbol)
        coverage = latest_replay_coverage(symbol)
        return Response({
            'symbol': symbol,
            'timeframes': timeframes,
            'last_bar_at': coverage['last_bar_at'],
            'latest_session_date': coverage['latest_session_date'],
        })


class BarsJsonView(APIView):
    """Séries OHLCV JSON multi-timeframe pour Market Replay."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            payload = fetch_replay_bars(
                instrument=request.query_params.get('instrument') or '',
                timeframes_raw=request.query_params.get('timeframes') or '',
                start=request.query_params.get('start') or '',
                end=request.query_params.get('end') or '',
                contract=request.query_params.get('contract') or 'front',
            )
        except ReplayBarsError as exc:
            return Response({'detail': str(exc)}, status=400)
        except Exception as exc:
            logger.exception('bars JSON failed')
            return Response({'detail': str(exc)}, status=500)
        return Response(payload)


class ContractListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        instrument = (request.query_params.get('instrument') or '').upper().strip()
        if not instrument:
            return Response({'detail': 'Paramètre instrument requis.'}, status=400)

        integration, err = _require_topstepx(request.user)
        if err:
            return err

        client = TopStepXApiClient()
        start_d = _parse_query_date(request.query_params.get('start'))
        end_d = _parse_query_date(request.query_params.get('end'))

        try:
            def _fetch(token: str):
                return list_contracts_for_instrument(
                    instrument,
                    client=client,
                    auth_token=token,
                    start=start_d,
                    end=end_d,
                )

            contracts = call_with_valid_session_token(integration, _fetch)
        except TopStepXApiError as exc:
            logger.warning('contracts fallback: %s', exc)
            contracts = list_contracts_for_instrument(
                instrument, start=start_d, end=end_d,
            )

        return Response([
            {
                'contract_id': c.contract_id,
                'instrument': c.instrument,
                'symbol': c.symbol,
                'symbol_id': c.symbol_id,
                'broker_symbol': c.broker_symbol,
                'expiry_month': c.expiry_month,
                'expiry_year': c.expiry_year,
                'expiry_date': c.expiry_date.isoformat() if c.expiry_date else None,
            }
            for c in contracts
        ])


class CoverageListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        instrument = request.query_params.get('instrument')
        data = get_available_data(instrument)
        return Response(data)


class BarsCsvExportView(APIView):
    """Export CSV des bougies stockées pour une période (filtres UI)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        instrument = (request.query_params.get('instrument') or '').upper().strip()
        if not instrument:
            return Response({'detail': 'Paramètre instrument requis.'}, status=400)

        start = (request.query_params.get('start') or '').strip()
        end = (request.query_params.get('end') or '').strip()
        if not start or not end:
            return Response({'detail': 'Paramètres start et end requis.'}, status=400)

        raw_tf = (request.query_params.get('timeframe') or '1m').strip()
        try:
            timeframe = parse_timeframe(raw_tf).code
        except UnknownTimeframe as exc:
            return Response({'detail': str(exc)}, status=400)

        contract = (request.query_params.get('contract_id') or '').strip() or None

        try:
            df = get_bars(
                instrument,
                timeframe=timeframe,
                start=start,
                end=end,
                contract=contract,
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=400)
        except Exception as exc:
            logger.exception('CSV export failed instrument=%s', instrument)
            return Response({'detail': str(exc)}, status=500)

        if len(df) > MAX_CSV_ROWS:
            return Response(
                {
                    'detail': (
                        f'Trop de lignes ({len(df)}). '
                        f'Maximum {MAX_CSV_ROWS} — réduisez la période ou le contrat.'
                    ),
                },
                status=400,
            )

        buffer = io.StringIO()
        if df.empty:
            writer = csv.writer(buffer)
            writer.writerow(CSV_EXPORT_COLUMNS)
        else:
            export_df = df.rename(columns={'timestamp_utc': 'timestamp'})
            # Normaliser timestamp ISO
            export_df = export_df.copy()
            export_df['timestamp'] = export_df['timestamp'].map(
                lambda ts: ts.isoformat().replace('+00:00', 'Z') if hasattr(ts, 'isoformat') else str(ts),
            )
            export_df[list(CSV_EXPORT_COLUMNS)].to_csv(buffer, index=False)

        filename = (
            f"{instrument}_{timeframe}_"
            f"{start[:10]}_{end[:10]}.csv"
        ).replace(' ', '_')
        response = HttpResponse(
            buffer.getvalue(),
            content_type='text/csv; charset=utf-8',
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


class DownloadJobListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [HistoricalDownloadThrottle]

    def get_throttles(self):
        if self.request.method == 'POST':
            return super().get_throttles()
        return []

    def get(self, request):
        jobs = HistoricalDownloadJob.objects.filter(user=request.user).order_by('-created_at')[:20]
        return Response(DownloadJobSerializer(jobs, many=True).data)

    def post(self, request):
        integration, err = _require_topstepx(request.user)
        if err:
            return err

        ser = DownloadJobCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        # Libère les jobs orphelins / bloqués, puis annule tout job actif
        # de cet utilisateur pour permettre une relance immédiate.
        abandon_stale_pending_jobs()
        abandon_stale_running_jobs()
        cancel_active_jobs_for_user(
            request.user,
            reason='Remplacé par un nouveau téléchargement.',
        )

        jobs = []
        for tf in data['timeframes']:
            job = HistoricalDownloadJob.objects.create(
                user=request.user,
                instrument=data['instrument'],
                contract_id=data.get('contract_id') or '',
                timeframe=tf,
                trigger=HistoricalDownloadJob.Trigger.MANUAL,
                start_utc=data['start'],
                end_utc=data['end'],
                status=HistoricalDownloadJob.Status.PENDING,
            )
            dispatch_historical_download(job.id)
            job.refresh_from_db()
            jobs.append(job)

        return Response(
            {'jobs': DownloadJobSerializer(jobs, many=True).data},
            status=status.HTTP_201_CREATED,
        )


class DownloadJobDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, job_id: int):
        try:
            job = HistoricalDownloadJob.objects.get(pk=job_id, user=request.user)
        except HistoricalDownloadJob.DoesNotExist:
            return Response({'detail': 'Job introuvable.'}, status=404)
        return Response(DownloadJobSerializer(job).data)


class DownloadJobIssuesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, job_id: int):
        try:
            job = HistoricalDownloadJob.objects.get(pk=job_id, user=request.user)
        except HistoricalDownloadJob.DoesNotExist:
            return Response({'detail': 'Job introuvable.'}, status=404)
        issues = BarQualityIssue.objects.filter(job=job).order_by('-created_at')[:500]
        return Response(QualityIssueSerializer(issues, many=True).data)


def _get_or_create_sync_settings(user) -> HistoricalSyncSettings:
    settings_obj, _ = HistoricalSyncSettings.objects.get_or_create(user=user)
    return settings_obj


class SyncSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        settings_obj = _get_or_create_sync_settings(request.user)
        return Response(SyncSettingsSerializer().to_representation(settings_obj))

    def put(self, request):
        settings_obj = _get_or_create_sync_settings(request.user)
        ser = SyncSettingsSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        updated = ser.update(settings_obj, ser.validated_data)
        return Response(SyncSettingsSerializer().to_representation(updated))


class SyncSettingsRunNowView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [HistoricalDownloadThrottle]

    def post(self, request):
        integration, err = _require_topstepx(request.user)
        if err:
            return err

        settings_obj = _get_or_create_sync_settings(request.user)
        if not settings_obj.targets.exists():
            return Response(
                {'detail': 'Ajoutez au moins une cible avant de lancer la sync.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = run_sync_for_settings(
            settings_obj,
            force=True,
            trigger=HistoricalDownloadJob.Trigger.MANUAL,
        )
        if result.get('skipped') and result.get('reason') == 'active_job':
            return Response(
                {'detail': 'Un téléchargement est déjà en cours.'},
                status=status.HTTP_409_CONFLICT,
            )

        jobs = result.get('jobs') or []
        settings_obj.refresh_from_db()
        return Response(
            {
                'settings': SyncSettingsSerializer().to_representation(settings_obj),
                'jobs': DownloadJobSerializer(jobs, many=True).data,
            },
            status=status.HTTP_201_CREATED if jobs else status.HTTP_200_OK,
        )


class SyncRunListView(APIView):
    """Historique des runs de sync de l'utilisateur (dernier en premier)."""

    permission_classes = [IsAuthenticated]
    DEFAULT_LIMIT = 20
    MAX_LIMIT = 100

    def get(self, request):
        try:
            limit = int(request.query_params.get('limit', self.DEFAULT_LIMIT))
        except (TypeError, ValueError):
            limit = self.DEFAULT_LIMIT
        limit = max(1, min(self.MAX_LIMIT, limit))
        runs = HistoricalSyncRun.objects.filter(user=request.user)[:limit]
        return Response(SyncRunSerializer(runs, many=True).data)


class SyncHealthView(APIView):
    """Santé du planificateur : le tick tourne-t-il, un worker est-il dispo."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        state = HistoricalSyncSchedulerState.objects.filter(
            pk=HistoricalSyncSchedulerState.SINGLETON_PK,
        ).first()
        celery_ok = celery_workers_available()
        return Response({
            'scheduler_last_tick_at': state.last_tick_at if state else None,
            'scheduler_ok': scheduler_is_healthy(state),
            'scheduler_stale_after_minutes': SCHEDULER_STALE_MINUTES,
            'celery_workers_available': celery_ok,
            'download_dispatch_mode': 'celery' if celery_ok else 'thread',
        })
