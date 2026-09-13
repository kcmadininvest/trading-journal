"""Tests downloader : chunks, skip complete, ingest, reprise."""
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone as django_tz

from market_data.models import BarCoverage, HistoricalBar, HistoricalDownloadJob
from market_data.services.downloader import (
    _subtract_ranges,
    download_contract_range,
)
from market_data.services.ingester import bulk_insert_bars
from market_data.services.normalizer import normalize_bars
from market_data.tests.fixtures_bars import make_m1_bars

User = get_user_model()


class RangeSubtractTests(TestCase):
    def test_subtract_middle(self):
        start = datetime(2025, 1, 1, tzinfo=timezone.utc)
        end = datetime(2025, 1, 4, tzinfo=timezone.utc)
        covered = [
            (datetime(2025, 1, 2, tzinfo=timezone.utc), datetime(2025, 1, 3, tzinfo=timezone.utc)),
        ]
        gaps = _subtract_ranges(start, end, covered)
        self.assertEqual(len(gaps), 2)
        self.assertEqual(gaps[0][1], covered[0][0])
        self.assertEqual(gaps[1][0], covered[0][1])


class IngesterTests(TestCase):
    def test_bulk_insert_dedup_constraint(self):
        start = datetime(2025, 3, 10, 14, 0, tzinfo=timezone.utc)
        rows = make_m1_bars(start, 3)
        bars, _ = normalize_bars(rows, instrument='NQ')
        n1 = bulk_insert_bars(
            bars,
            instrument='NQ',
            symbol='NQH5',
            contract_id='CON.F.US.ENQ.H25',
            source='test',
        )
        n2 = bulk_insert_bars(
            bars,
            instrument='NQ',
            symbol='NQH5',
            contract_id='CON.F.US.ENQ.H25',
            source='test',
        )
        self.assertEqual(n1, 3)
        self.assertEqual(n2, 3)
        self.assertEqual(
            HistoricalBar.objects.filter(contract_id='CON.F.US.ENQ.H25').count(),
            3,
        )


class DownloadContractRangeTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='mduser', password='x')
        self.start = datetime(2025, 3, 10, 14, 0, tzinfo=timezone.utc)
        self.end = self.start + timedelta(minutes=5)

    def test_skips_complete_coverage(self):
        BarCoverage.objects.create(
            instrument='NQ',
            contract_id='CON.F.US.ENQ.H25',
            timeframe='1m',
            start_utc=self.start,
            end_utc=self.end,
            bars_stored=5,
            bars_expected=5,
            unexpected_missing_count=0,
            status=BarCoverage.Status.COMPLETE,
            source='test',
            fetched_at=django_tz.now(),
        )
        client = MagicMock()
        result = download_contract_range(
            client,
            lambda: 'token',
            instrument='NQ',
            contract_id='CON.F.US.ENQ.H25',
            symbol='NQH5',
            start=self.start,
            end=self.end,
        )
        client.retrieve_bars.assert_not_called()
        self.assertEqual(result['bars_fetched'], 0)

    def test_download_and_mark_partial_if_short(self):
        rows = make_m1_bars(self.start, 2)  # incomplete vs 5 expected
        client = MagicMock()
        client.retrieve_bars.return_value = rows

        job = HistoricalDownloadJob.objects.create(
            user=self.user,
            instrument='NQ',
            contract_id='CON.F.US.ENQ.H25',
            timeframe='1m',
            start_utc=self.start,
            end_utc=self.end,
        )
        with patch('market_data.services.downloader.time.sleep'):
            download_contract_range(
                client,
                lambda: 'token',
                instrument='NQ',
                contract_id='CON.F.US.ENQ.H25',
                symbol='NQH5',
                start=self.start,
                end=self.end,
                job=job,
                live_preference=(False,),
            )
        cov = BarCoverage.objects.get(contract_id='CON.F.US.ENQ.H25')
        self.assertEqual(cov.status, BarCoverage.Status.PARTIAL)
        self.assertGreater(cov.unexpected_missing_count, 0)
        self.assertEqual(HistoricalBar.objects.filter(contract_id='CON.F.US.ENQ.H25').count(), 2)

    def test_download_complete_when_full(self):
        rows = make_m1_bars(self.start, 5)
        client = MagicMock()
        client.retrieve_bars.return_value = rows
        with patch('market_data.services.downloader.time.sleep'):
            download_contract_range(
                client,
                lambda: 'token',
                instrument='NQ',
                contract_id='CON.F.US.ENQ.H25',
                symbol='NQH5',
                start=self.start,
                end=self.end,
                live_preference=(False,),
            )
        cov = BarCoverage.objects.get(contract_id='CON.F.US.ENQ.H25')
        self.assertEqual(cov.status, BarCoverage.Status.COMPLETE)
        self.assertEqual(cov.unexpected_missing_count, 0)

    def test_retrieve_bars_uses_timeframe_unit(self):
        """5m et 1h doivent mapper unit/unitNumber TopstepX correctement."""
        client = MagicMock()
        client.retrieve_bars.return_value = []
        with patch('market_data.services.downloader.time.sleep'):
            download_contract_range(
                client,
                lambda: 'token',
                instrument='NQ',
                contract_id='CON.F.US.ENQ.H25',
                symbol='NQH5',
                start=self.start,
                end=self.end,
                timeframe='5m',
                live_preference=(False,),
            )
        kwargs = client.retrieve_bars.call_args.kwargs
        self.assertEqual(kwargs['unit'], 2)
        self.assertEqual(kwargs['unit_number'], 5)

        client.reset_mock()
        client.retrieve_bars.return_value = []
        with patch('market_data.services.downloader.time.sleep'):
            download_contract_range(
                client,
                lambda: 'token',
                instrument='NQ',
                contract_id='CON.F.US.ENQ.H25',
                symbol='NQH5',
                start=self.start,
                end=self.end,
                timeframe='1h',
                live_preference=(False,),
            )
        kwargs = client.retrieve_bars.call_args.kwargs
        self.assertEqual(kwargs['unit'], 3)
        self.assertEqual(kwargs['unit_number'], 1)

    def test_empty_sim_then_live_bars_are_kept(self):
        """Un [] sim ne doit pas empêcher d'utiliser les barres live."""
        rows = make_m1_bars(self.start, 5)
        client = MagicMock()

        def _retrieve(*_a, **kwargs):
            if kwargs.get('live'):
                return rows
            return []

        client.retrieve_bars.side_effect = _retrieve
        with patch('market_data.services.downloader.time.sleep'):
            result = download_contract_range(
                client,
                lambda: 'token',
                instrument='NQ',
                contract_id='CON.F.US.ENQ.H25',
                symbol='NQH5',
                start=self.start,
                end=self.end,
                live_preference=(False, True),
            )
        self.assertEqual(result['bars_fetched'], 5)
        self.assertEqual(HistoricalBar.objects.filter(contract_id='CON.F.US.ENQ.H25').count(), 5)
        lives = [c.kwargs.get('live') for c in client.retrieve_bars.call_args_list]
        self.assertIn(False, lives)
        self.assertIn(True, lives)
