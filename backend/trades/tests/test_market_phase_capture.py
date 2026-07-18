"""Tests modèles et capture market phases."""
from datetime import date, time

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase

from trades.market_phases.capture_service import (
    bulk_upsert_capture,
    find_parent_block,
    validate_no_block_overlap,
)
from trades.market_phases.models import (
    MarketPhaseDefinition,
    MarketPhaseEventDefinition,
    SessionMarketPhaseBlock,
)
from trades.models import TradingAccount

User = get_user_model()


class MarketPhaseCaptureTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username='mpuser', password='test')
        cls.account = TradingAccount.objects.create(
            user=cls.user,
            name='Test',
            account_type='topstep',
        )
        cls.consolidation = MarketPhaseDefinition.objects.filter(
            code='consolidation', is_system=True
        ).first()
        cls.breakout_up = MarketPhaseEventDefinition.objects.filter(
            code='range_breakout_up', is_system=True
        ).first()
        cls.reentry = MarketPhaseEventDefinition.objects.filter(
            code='range_reentry', is_system=True
        ).first()

    def test_bulk_upsert_links_event_to_parent_block(self):
        blocks, events = bulk_upsert_capture(
            user=self.user,
            trading_account=self.account,
            session_date=date(2026, 7, 10),
            instrument_key='nasdaq',
            blocks_data=[{
                'phase_code': 'consolidation',
                'range_start': time(12, 18),
                'range_end': time(13, 24),
                'preceding_context': 'after_bullish_push',
            }],
            events_data=[
                {
                    'event_type_code': 'range_breakout_up',
                    'occurred_at': time(12, 50),
                    'candle_part': 'body',
                    'direction': 'up',
                },
                {
                    'event_type_code': 'range_reentry',
                    'occurred_at': time(12, 52),
                    'direction': 'neutral',
                    'outcome': 'reentry',
                },
            ],
        )
        self.assertEqual(len(blocks), 1)
        self.assertEqual(len(events), 2)
        self.assertEqual(events[0].parent_block_id, blocks[0].id)
        self.assertEqual(events[1].parent_block_id, blocks[0].id)

    def test_block_overlap_raises(self):
        b1 = SessionMarketPhaseBlock(
            user=self.user,
            trading_account=self.account,
            session_date=date(2026, 7, 10),
            instrument_key='nasdaq',
            range_start=time(10, 0),
            range_end=time(11, 0),
            phase=self.consolidation,
        )
        b2 = SessionMarketPhaseBlock(
            user=self.user,
            trading_account=self.account,
            session_date=date(2026, 7, 10),
            instrument_key='nasdaq',
            range_start=time(10, 30),
            range_end=time(11, 30),
            phase=self.consolidation,
        )
        from trades.market_phases.capture_service import _times_overlap
        self.assertTrue(_times_overlap(
            b1.range_start, b1.range_end, b2.range_start, b2.range_end,
        ))
        with self.assertRaises(ValidationError):
            validate_no_block_overlap([b1, b2])

    def test_bulk_upsert_does_not_accumulate_orphan_events(self):
        from trades.market_phases.models import SessionMarketPhaseEvent

        payload = dict(
            user=self.user,
            trading_account=self.account,
            session_date=date(2026, 7, 10),
            instrument_key='nasdaq',
            blocks_data=[{
                'phase_code': 'consolidation',
                'range_start': time(12, 0),
                'range_end': time(13, 0),
            }],
            events_data=[{
                'event_type_code': 'range_breakout_up',
                'occurred_at': time(12, 30),
                'candle_part': 'body',
                'direction': 'up',
            }],
        )
        bulk_upsert_capture(**payload)
        bulk_upsert_capture(**payload)
        bulk_upsert_capture(**payload)

        self.assertEqual(
            SessionMarketPhaseEvent.objects.filter(
                user=self.user,
                trading_account=self.account,
                session_date=date(2026, 7, 10),
                instrument_key='nasdaq',
            ).count(),
            1,
        )
        self.assertEqual(
            SessionMarketPhaseEvent.objects.filter(
                user=self.user,
                trading_account=self.account,
                parent_block__isnull=True,
            ).count(),
            0,
        )

    def test_find_parent_block(self):
        block = SessionMarketPhaseBlock(
            range_start=time(12, 18),
            range_end=time(13, 24),
        )
        parent = find_parent_block([block], time(12, 50))
        self.assertIs(parent, block)
