import { describe, expect, it } from 'vitest';
import {
  getMarketPhaseEventActionByKey,
  MARKET_PHASE_EVENT_ACTIONS,
  marketPhaseEventActionKey,
} from './marketPhaseEventDisplay';

describe('marketPhaseEventDisplay', () => {
  it('exposes wick sweeps and explicit fakeouts in capture actions', () => {
    const codes = MARKET_PHASE_EVENT_ACTIONS.map((action) => action.code);
    expect(codes).toContain('wick_sweep_high');
    expect(codes).toContain('wick_sweep_low');
    expect(
      MARKET_PHASE_EVENT_ACTIONS.some(
        (action) =>
          action.code === 'range_breakout_up' &&
          action.candlePart === 'wick' &&
          action.outcome === 'reentry',
      ),
    ).toBe(true);
    expect(
      MARKET_PHASE_EVENT_ACTIONS.some(
        (action) =>
          action.code === 'range_breakout_down' &&
          action.candlePart === 'wick' &&
          action.outcome === 'reentry',
      ),
    ).toBe(true);
    expect(MARKET_PHASE_EVENT_ACTIONS).toHaveLength(9);
  });

  it('resolves actions by stable keys', () => {
    const action = MARKET_PHASE_EVENT_ACTIONS[0];
    const key = marketPhaseEventActionKey(action);
    expect(getMarketPhaseEventActionByKey(key)).toEqual(action);
    expect(getMarketPhaseEventActionByKey('wick_sweep_low:wick:unknown')?.code).toBe('wick_sweep_low');
  });
});
