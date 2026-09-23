import type { DraftTrade } from '../components/marketReplay/ReplayTradePanel';
import type { PositionUiState } from './positionToolState';
import type { PaneIndicators } from './replayIndicators';
import type { Drawing, DrawingStyle } from './replayDrawings';
import type { DrawingScope } from '../components/marketReplay/DrawingToolSelect';

export type ReplayMode = 'disciplined' | 'exploration';
export type ReplayLayout = 1 | 2 | 4;

export type ReplayGridWorkspace = {
  indicatorsByPane: Record<string, PaneIndicators>;
  drawingScope: DrawingScope;
  drawingsByPane: Record<string, Drawing[]>;
  sharedDrawings: Drawing[];
  drawingStyle: DrawingStyle;
};

export type MarketReplayWorkspace = {
  version: 1;
  instrument: string;
  sessionDate: string;
  campaignId: number | null;
  replayTimestamp: number;
  speed: number;
  paneTfs: (string | null)[];
  mode: ReplayMode;
  layout: ReplayLayout;
  draft: DraftTrade;
  positionUi: PositionUiState;
  grid?: ReplayGridWorkspace;
};

const STORAGE_KEY = 'trading-journal:market-replay-workspace:v1';

export function loadMarketReplayWorkspace(): MarketReplayWorkspace | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MarketReplayWorkspace>;
    if (parsed.version !== 1 || typeof parsed.instrument !== 'string' || typeof parsed.sessionDate !== 'string') {
      return null;
    }
    return parsed as MarketReplayWorkspace;
  } catch {
    return null;
  }
}

export function saveMarketReplayWorkspace(workspace: MarketReplayWorkspace): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  } catch {
    return;
  }
}

export function clearMarketReplayWorkspace(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    return;
  }
}
