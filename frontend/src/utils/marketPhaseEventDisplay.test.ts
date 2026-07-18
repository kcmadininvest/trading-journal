import { describe, expect, it } from 'vitest';
import {
  getMarketPhaseEventActionByKey,
  MARKET_PHASE_EVENT_ACTIONS,
  marketPhaseEventActionKey,
} from './marketPhaseEventDisplay';
import {
  appendMarketPhaseEvent,
  nextDistinctEventTime,
  pruneToPrimaryPlusReentryPerBlock,
  toggleSlotEvent,
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

  const block2: MarketPhaseBlock = {
    instrument_key: 'nasdaq',
    range_start: '11:00',
    range_end: '12:00',
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

  it('toggleSlotEvent keeps primary when adding reentry', () => {
    const body: MarketPhaseEvent = {
      occurred_at: '10:30',
      event_type_code: 'range_breakout_up',
      direction: 'up',
      candle_part: 'body',
      outcome: 'hold',
    };
    const reentry: MarketPhaseEvent = {
      occurred_at: '10:31',
      event_type_code: 'range_reentry',
      direction: 'neutral',
      candle_part: 'unknown',
      outcome: 'reentry',
    };
    const withBody = toggleSlotEvent([], [], body, [block]);
    expect(withBody).toEqual([body]);

    const withBoth = toggleSlotEvent(withBody, withBody, reentry, [block]);
    expect(withBoth).toHaveLength(2);
    expect(withBoth.map((e) => e.event_type_code)).toEqual([
      'range_breakout_up',
      'range_reentry',
    ]);
  });

  it('toggleSlotEvent replaces primary without removing reentry', () => {
    const body: MarketPhaseEvent = {
      occurred_at: '10:30',
      event_type_code: 'range_breakout_up',
      direction: 'up',
      candle_part: 'body',
      outcome: 'hold',
    };
    const reentry: MarketPhaseEvent = {
      occurred_at: '10:31',
      event_type_code: 'range_reentry',
      direction: 'neutral',
      candle_part: 'unknown',
      outcome: 'reentry',
    };
    const wick: MarketPhaseEvent = {
      occurred_at: '10:32',
      event_type_code: 'range_breakout_up',
      direction: 'up',
      candle_part: 'wick',
      outcome: 'unknown',
    };
    const slot = [body, reentry];
    const next = toggleSlotEvent(slot, slot, wick, [block]);
    expect(next).toHaveLength(2);
    expect(next.find((e) => e.event_type_code === 'range_reentry')).toBeTruthy();
    expect(next.find((e) => e.candle_part === 'wick')).toBeTruthy();
    expect(next.find((e) => e.candle_part === 'body')).toBeUndefined();
  });

  it('toggleSlotEvent deselects only the clicked event', () => {
    const body: MarketPhaseEvent = {
      occurred_at: '10:30',
      event_type_code: 'range_breakout_up',
      direction: 'up',
      candle_part: 'body',
      outcome: 'hold',
    };
    const reentry: MarketPhaseEvent = {
      occurred_at: '10:31',
      event_type_code: 'range_reentry',
      direction: 'neutral',
      candle_part: 'unknown',
      outcome: 'reentry',
    };
    const slot = [body, reentry];
    expect(toggleSlotEvent(slot, slot, body, [block])).toEqual([reentry]);
    expect(toggleSlotEvent(slot, slot, reentry, [block])).toEqual([body]);
  });

  it('toggleSlotEvent on a second block does not clear the first block', () => {
    const slot1Ev: MarketPhaseEvent = {
      occurred_at: '10:30',
      event_type_code: 'range_breakout_up',
      direction: 'up',
      candle_part: 'body',
      outcome: 'hold',
    };
    const slot2Ev: MarketPhaseEvent = {
      occurred_at: '11:30',
      event_type_code: 'range_breakout_down',
      direction: 'down',
      candle_part: 'wick',
      outcome: 'unknown',
    };
    const afterSlot1 = toggleSlotEvent([], [], slot1Ev, [block, block2]);
    const afterSlot2 = toggleSlotEvent(afterSlot1, [], slot2Ev, [block, block2]);
    expect(afterSlot2).toHaveLength(2);
    expect(afterSlot2).toEqual(expect.arrayContaining([slot1Ev, slot2Ev]));
  });

  it('pruneToPrimaryPlusReentryPerBlock keeps primary + reentry', () => {
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
    const extra: MarketPhaseEvent = {
      occurred_at: '10:25',
      event_type_code: 'wick_sweep_high',
      direction: 'up',
      candle_part: 'wick',
      outcome: 'unknown',
    };
    const { events, pruned } = pruneToPrimaryPlusReentryPerBlock(
      [block],
      [early, extra, late],
    );
    expect(pruned).toBe(true);
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.event_type_code).sort()).toEqual([
      'range_reentry',
      'wick_sweep_high',
    ]);
    // Dernier primaire conservé
    expect(events.find((e) => e.event_type_code !== 'range_reentry')?.occurred_at).toBe('10:25');
  });
});
