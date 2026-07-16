import { describe, expect, it } from 'vitest';
import {
  getMarketPhaseEventActionByKey,
  MARKET_PHASE_EVENT_ACTIONS,
  marketPhaseEventActionKey,
} from './marketPhaseEventDisplay';
import {
  appendMarketPhaseEvent,
  nextDistinctEventTime,
  pruneToExclusiveEventPerBlock,
  toggleExclusiveSlotEvent,
} from './marketPhaseEventCapture';
import type { MarketPhaseBlock, MarketPhaseEvent } from '../services/marketPhases';

describe('marketPhaseEventDisplay', () => {
  it('exposes atomic actions without composed wick fakeouts', () => {
    const codes = MARKET_PHASE_EVENT_ACTIONS.map((action) => action.code);
    expect(codes).toContain('wick_sweep_high');
    expect(codes).toContain('wick_sweep_low');
    expect(codes).toContain('range_reentry');
    const actionKeys = MARKET_PHASE_EVENT_ACTIONS.map((action) => marketPhaseEventActionKey(action));
    expect(actionKeys).not.toContain('range_breakout_up:wick:reentry');
    expect(actionKeys).not.toContain('range_breakout_down:wick:reentry');
    expect(MARKET_PHASE_EVENT_ACTIONS).toHaveLength(7);
  });

  it('resolves actions by stable keys', () => {
    const action = MARKET_PHASE_EVENT_ACTIONS[0];
    const key = marketPhaseEventActionKey(action);
    expect(getMarketPhaseEventActionByKey(key)).toEqual(action);
    expect(getMarketPhaseEventActionByKey('wick_sweep_low:wick:unknown')?.code).toBe('wick_sweep_low');
  });
});

describe('marketPhaseEventCapture', () => {
  const block: MarketPhaseBlock = {
    instrument_key: 'nasdaq',
    range_start: '10:00',
    range_end: '11:00',
    phase_code: 'range_bound',
  };

  it('increments time when preferred slot is already used', () => {
    expect(nextDistinctEventTime('10:30', ['10:30', '10:31'], '11:00')).toBe('10:32');
  });

  it('appends multiple events and marks wick breakout as reentry', () => {
    const wick: MarketPhaseEvent = {
      occurred_at: '10:30',
      event_type_code: 'range_breakout_up',
      direction: 'up',
      candle_part: 'wick',
      outcome: 'unknown',
    };
    const reentry: MarketPhaseEvent = {
      occurred_at: '10:31',
      event_type_code: 'range_reentry',
      direction: 'neutral',
      candle_part: 'unknown',
      outcome: 'reentry',
    };
    const afterWick = appendMarketPhaseEvent([], wick, [block]);
    const afterReentry = appendMarketPhaseEvent(afterWick, reentry, [block]);
    expect(afterReentry).toHaveLength(2);
    expect(afterReentry[0].outcome).toBe('reentry');
    expect(afterReentry[1].event_type_code).toBe('range_reentry');
  });

  it('toggleExclusiveSlotEvent selects, clears, and replaces', () => {
    const body: MarketPhaseEvent = {
      occurred_at: '10:30',
      event_type_code: 'range_breakout_up',
      direction: 'up',
      candle_part: 'body',
      outcome: 'hold',
    };
    const wick: MarketPhaseEvent = {
      occurred_at: '10:30',
      event_type_code: 'range_breakout_up',
      direction: 'up',
      candle_part: 'wick',
      outcome: 'unknown',
    };
    const selected = toggleExclusiveSlotEvent([], [], body, [block]);
    expect(selected).toEqual([body]);

    const cleared = toggleExclusiveSlotEvent(selected, selected, body, [block]);
    expect(cleared).toEqual([]);

    const replaced = toggleExclusiveSlotEvent(selected, selected, wick, [block]);
    expect(replaced).toEqual([wick]);
  });

  it('toggleExclusiveSlotEvent clears every event in the slot on deselect', () => {
    const body: MarketPhaseEvent = {
      occurred_at: '10:30',
      event_type_code: 'range_breakout_up',
      direction: 'up',
      candle_part: 'body',
      outcome: 'hold',
    };
    const wick: MarketPhaseEvent = {
      occurred_at: '10:31',
      event_type_code: 'range_breakout_up',
      direction: 'up',
      candle_part: 'wick',
      outcome: 'unknown',
    };
    const slot = [body, wick];
    expect(toggleExclusiveSlotEvent(slot, slot, body, [block])).toEqual([]);
  });

  it('pruneToExclusiveEventPerBlock keeps only the latest event per block', () => {
    const early: MarketPhaseEvent = {
      occurred_at: '10:20',
      event_type_code: 'range_breakout_up',
      direction: 'up',
      candle_part: 'body',
      outcome: 'hold',
    };
    const late: MarketPhaseEvent = {
      occurred_at: '10:40',
      event_type_code: 'range_reentry',
      direction: 'neutral',
      candle_part: 'unknown',
      outcome: 'reentry',
    };
    const { events, pruned } = pruneToExclusiveEventPerBlock([block], [early, late]);
    expect(pruned).toBe(true);
    expect(events).toEqual([late]);
  });
});
