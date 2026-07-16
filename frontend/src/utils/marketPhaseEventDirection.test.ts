import { describe, expect, it } from 'vitest';
import {
  eventMatchesAction,
  findEventForAction,
  resolveEventDisplayDirection,
} from '../components/marketPhases/MarketPhaseEventButtons';
import type { MarketPhaseEventAction } from './marketPhaseEventDisplay';

describe('resolveEventDisplayDirection', () => {
  it('uses explicit direction when present', () => {
    expect(resolveEventDisplayDirection({ occurred_at: '10:00', direction: 'up' })).toBe('up');
    expect(resolveEventDisplayDirection({ occurred_at: '10:00', direction: 'down' })).toBe('down');
    expect(resolveEventDisplayDirection({ occurred_at: '10:00', direction: 'neutral' })).toBe('neutral');
  });

  it('infers from event type code', () => {
    expect(
      resolveEventDisplayDirection({ occurred_at: '10:00', event_type_code: 'range_breakout_up' }),
    ).toBe('up');
    expect(
      resolveEventDisplayDirection({ occurred_at: '10:00', event_type_code: 'wick_sweep_low' }),
    ).toBe('down');
    expect(
      resolveEventDisplayDirection({ occurred_at: '10:00', event_type_code: 'range_reentry' }),
    ).toBe('neutral');
  });
});

describe('eventMatchesAction toggle', () => {
  const wickUp = {
    code: 'range_breakout_up',
    direction: 'up',
    candlePart: 'wick',
    outcome: 'unknown',
    labelKey: 'events.breakoutUpWick',
    previewKey: 'events.savePreview.breakoutUpWick',
  } as MarketPhaseEventAction;

  it('matches breakout even after outcome becomes reentry', () => {
    expect(
      eventMatchesAction(
        {
          occurred_at: '10:30',
          event_type_code: 'range_breakout_up',
          direction: 'up',
          candle_part: 'wick',
          outcome: 'reentry',
        },
        wickUp,
      ),
    ).toBe(true);
  });

  it('finds action for toggle remove', () => {
    const found = findEventForAction(
      [
        {
          occurred_at: '10:30',
          event_type_code: 'range_breakout_up',
          direction: 'up',
          candle_part: 'wick',
          outcome: 'unknown',
        },
      ],
      wickUp,
    );
    expect(found?.occurred_at).toBe('10:30');
  });
});
