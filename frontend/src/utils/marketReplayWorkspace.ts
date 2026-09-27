import type { DraftTrade } from '../components/marketReplay/ReplayTradePanel';
import type { PositionUiState } from './positionToolState';
import type { PaneIndicators } from './replayIndicators';
import type { Drawing, DrawingStyle } from './replayDrawings';
import type { DrawingScope } from '../components/marketReplay/DrawingToolSelect';

export type ReplayMode = 'disciplined' | 'exploration';
export type ReplayLayout = 1 | 2 | 4;
export type MarketReplayWorkspaceScope = 'main' | 'popup';

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
  /** Heure de début optionnelle (HH:mm), fuseau Settings. */
  sessionStartTime?: string;
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

const STORAGE_KEYS: Record<MarketReplayWorkspaceScope, string> = {
  main: 'trading-journal:market-replay-workspace:v1',
  popup: 'trading-journal:market-replay-workspace:v1:popup',
};

function storageKey(scope: MarketReplayWorkspaceScope = 'main'): string {
  return STORAGE_KEYS[scope];
}

export function loadMarketReplayWorkspace(
  scope: MarketReplayWorkspaceScope = 'main',
): MarketReplayWorkspace | null {
  try {
    const raw = localStorage.getItem(storageKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MarketReplayWorkspace>;
    if (parsed.version !== 1 || typeof parsed.instrument !== 'string' || typeof parsed.sessionDate !== 'string') {
      return null;
    }
    if (
      parsed.sessionStartTime != null &&
      (typeof parsed.sessionStartTime !== 'string' ||
        (parsed.sessionStartTime !== '' && !/^\d{1,2}:\d{2}$/.test(parsed.sessionStartTime)))
    ) {
      delete parsed.sessionStartTime;
    }
    return parsed as MarketReplayWorkspace;
  } catch {
    return null;
  }
}

export function saveMarketReplayWorkspace(
  workspace: MarketReplayWorkspace,
  scope: MarketReplayWorkspaceScope = 'main',
): void {
  try {
    localStorage.setItem(storageKey(scope), JSON.stringify(workspace));
  } catch {
    return;
  }
}

export function clearMarketReplayWorkspace(
  scope: MarketReplayWorkspaceScope = 'main',
): void {
  try {
    localStorage.removeItem(storageKey(scope));
  } catch {
    return;
  }
}
