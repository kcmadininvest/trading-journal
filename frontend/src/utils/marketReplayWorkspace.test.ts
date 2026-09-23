import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearMarketReplayWorkspace,
  loadMarketReplayWorkspace,
  saveMarketReplayWorkspace,
  type MarketReplayWorkspace,
} from './marketReplayWorkspace';

const workspace: MarketReplayWorkspace = {
  version: 1,
  instrument: 'NQ',
  sessionDate: '2026-09-22',
  campaignId: 12,
  replayTimestamp: 1_758_550_000,
  speed: 5,
  paneTfs: ['1m', '5m', '15m', '1h'],
  mode: 'disciplined',
  layout: 2,
  draft: {
    direction: 'LONG',
    entryTimestamp: null,
    entryPrice: null,
    exitTimestamp: null,
    exitPrice: null,
    stopPrice: null,
    targetPrice: null,
  },
  positionUi: {
    endTime: null,
    widthBars: null,
    qty: 1,
    chartId: null,
    active: false,
    selected: false,
  },
};

describe('marketReplayWorkspace', () => {
  beforeEach(() => localStorage.clear());

  it('restores a saved workspace', () => {
    saveMarketReplayWorkspace(workspace);
    expect(loadMarketReplayWorkspace()).toEqual(workspace);
  });

  it('ignores malformed and unsupported data', () => {
    localStorage.setItem('trading-journal:market-replay-workspace:v1', '{broken');
    expect(loadMarketReplayWorkspace()).toBeNull();
    localStorage.setItem('trading-journal:market-replay-workspace:v1', JSON.stringify({ version: 2 }));
    expect(loadMarketReplayWorkspace()).toBeNull();
  });

  it('clears the workspace', () => {
    saveMarketReplayWorkspace(workspace);
    clearMarketReplayWorkspace();
    expect(loadMarketReplayWorkspace()).toBeNull();
  });
});
