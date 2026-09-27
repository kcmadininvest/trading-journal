from datetime import datetime, timedelta, timezone
from io import StringIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase
from django.utils import timezone as django_timezone

from market_data.models import BarCoverage, HistoricalBar

User = get_user_model()
from market_data.services.ingester import bulk_insert_bars
from market_data.services.normalizer import normalize_bars
from market_data.tests.fixtures_bars import make_m1_bars


class RebuildAggregatedBarsCommandTests(TestCase):
    instrument = 'MES'
    contract_id = 'CON.F.US.MES.U26'
    start = datetime(2026, 9, 7, 22, 0, tzinfo=timezone.utc)

    def setUp(self):
        self.user = User.objects.create_user(username='rebuilduser', password='x')
        m1, _ = normalize_bars(make_m1_bars(self.start, 5), instrument=self.instrument)
        bulk_insert_bars(
            m1,
            user=self.user,
            instrument=self.instrument,
            symbol='MESU6',
            contract_id=self.contract_id,
            source='topstepx_sim',
        )
        HistoricalBar.objects.create(
            user=self.user,
            instrument=self.instrument,
            symbol='MESU6',
            contract_id=self.contract_id,
            timeframe='5m',
            timestamp_utc=datetime(2026, 9, 8, 0, 0, tzinfo=timezone.utc),
            open=100,
            high=101,
            low=99,
            close=100,
            volume=99,
            ny_date=datetime(2026, 9, 8).date(),
            ny_time=datetime(2026, 9, 8).time(),
            session_date=datetime(2026, 9, 8).date(),
            fetched_at=django_timezone.now(),
            source='topstepx_sim',
        )
        BarCoverage.objects.create(
            user=self.user,
            instrument=self.instrument,
            contract_id=self.contract_id,
            timeframe='5m',
            start_utc=self.start,
            end_utc=self.start + timedelta(days=1),
            bars_stored=1,
            bars_expected=1,
            status=BarCoverage.Status.COMPLETE,
            source='topstepx_sim',
            fetched_at=django_timezone.now(),
        )

    def test_default_dry_run_does_not_change_bars_or_coverage(self):
        output = StringIO()
        call_command(
            'rebuild_aggregated_bars',
            user=self.user.username,
            instruments=[self.instrument],
            timeframes='5m',
            stdout=output,
        )

        self.assertIn('DRY-RUN', output.getvalue())
        self.assertTrue(HistoricalBar.objects.filter(
            contract_id=self.contract_id,
            timeframe='5m',
            timestamp_utc=datetime(2026, 9, 8, 0, 0, tzinfo=timezone.utc),
        ).exists())
        self.assertTrue(BarCoverage.objects.filter(
            contract_id=self.contract_id,
            timeframe='5m',
            source='topstepx_sim',
        ).exists())

    @patch('builtins.input', return_value='REBUILD')
    def test_apply_replaces_derived_bars_and_keeps_m1(self, _input):
        original_m1_count = HistoricalBar.objects.filter(
            contract_id=self.contract_id,
            timeframe='1m',
        ).count()
        output = StringIO()
        call_command(
            'rebuild_aggregated_bars',
            user=self.user.username,
            instruments=[self.instrument],
            timeframes='5m',
            apply=True,
            stdout=output,
        )

        self.assertEqual(
            HistoricalBar.objects.filter(
                contract_id=self.contract_id,
                timeframe='1m',
            ).count(),
            original_m1_count,
        )
        self.assertTrue(HistoricalBar.objects.filter(
            contract_id=self.contract_id,
            timeframe='5m',
            timestamp_utc=self.start,
            source='local_1m_aggregate',
        ).exists())
        self.assertFalse(BarCoverage.objects.filter(
            contract_id=self.contract_id,
            timeframe='5m',
            source='topstepx_sim',
        ).exists())
        self.assertTrue(BarCoverage.objects.filter(
            contract_id=self.contract_id,
            timeframe='5m',
            source='local_1m_aggregate',
        ).exists())
        self.assertIn('Reconstruction terminée', output.getvalue())

    @patch('builtins.input', return_value='NO')
    def test_wrong_confirmation_leaves_data_unchanged(self, _input):
        original_count = HistoricalBar.objects.filter(
            contract_id=self.contract_id,
            timeframe='5m',
        ).count()
        with self.assertRaises(CommandError):
            call_command(
                'rebuild_aggregated_bars',
                user=self.user.username,
                instruments=[self.instrument],
                timeframes='5m',
                apply=True,
                stdout=StringIO(),
            )
        self.assertEqual(
            HistoricalBar.objects.filter(
                contract_id=self.contract_id,
                timeframe='5m',
            ).count(),
            original_count,
        )
