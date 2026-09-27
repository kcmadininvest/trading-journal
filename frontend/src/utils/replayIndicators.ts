import type { VisibleCandle } from './replayEngine';
import type { DrawingStyle } from './replayDrawings';

export const MIN_MA_PERIOD = 2;
export const MAX_MA_PERIOD = 500;
export const MAX_AVWAPS = 10;
export const AVWAP_HIT_TOLERANCE_PX = 6;

export type MaKind = 'sma' | 'ema';

export interface ReplayMaIndicator {
  id: string;
  kind: MaKind;
  period: number;
}

export interface ReplayAvwapIndicator {
  id: string;
  anchorTime: number | null;
  style: DrawingStyle;
}

export interface PaneIndicators {
  vwap: boolean;
  avwaps: ReplayAvwapIndicator[];
  mas: ReplayMaIndicator[];
}

export interface IndicatorPoint {
  time: number;
  value: number;
}

export interface IndicatorOverlay {
  id: string;
  title: string;
  color: string;
  lineWidth?: number;
  data: IndicatorPoint[];
}

export const VWAP_COLOR = '#f59e0b';
export const AVWAP_COLOR = '#a855f7';

export const DEFAULT_AVWAP_STYLE: DrawingStyle = {
  color: AVWAP_COLOR,
  lineWidth: 2,
};

export const AVWAP_COLORS = [
  '#a855f7',
  '#ec4899',
  '#8b5cf6',
  '#d946ef',
  '#6366f1',
  '#c084fc',
  '#f472b6',
  '#a78bfa',
] as const;

export const MA_COLORS = [
  '#3b82f6',
  '#14b8a6',
  '#eab308',
  '#ef4444',
  '#22c55e',
  '#06b6d4',
  '#f97316',
  '#6366f1',
] as const;

export function emptyPaneIndicators(): PaneIndicators {
  return {
    vwap: false,
    avwaps: [],
    mas: [],
  };
}

export function countActiveIndicators(state: PaneIndicators): number {
  return state.mas.length + (state.vwap ? 1 : 0) + state.avwaps.length;
}

export function isValidMaPeriod(period: number): boolean {
  return Number.isInteger(period) && period >= MIN_MA_PERIOD && period <= MAX_MA_PERIOD;
}

export function colorForMa(index: number): string {
  return MA_COLORS[index % MA_COLORS.length];
}

export function isAvwapOverlayId(id: string): boolean {
  return id.startsWith('avwap-');
}

export function pendingAvwap(state: PaneIndicators): ReplayAvwapIndicator | null {
  return state.avwaps.find((a) => a.anchorTime == null) ?? null;
}

function nextAvwapColor(state: PaneIndicators): string {
  const used = new Set(state.avwaps.map((a) => a.style.color.toLowerCase()));
  const free = AVWAP_COLORS.find((c) => !used.has(c.toLowerCase()));
  return free ?? AVWAP_COLORS[state.avwaps.length % AVWAP_COLORS.length];
}

function newAvwapId(): string {
  return `avwap-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function typicalPrice(candle: VisibleCandle): number {
  return (candle.high + candle.low + candle.close) / 3;
}

export function computeSma(candles: VisibleCandle[], period: number): IndicatorPoint[] {
  if (!isValidMaPeriod(period) || candles.length < period) return [];
  const points: IndicatorPoint[] = [];
  let windowSum = 0;
  for (let i = 0; i < candles.length; i += 1) {
    windowSum += candles[i].close;
    if (i >= period) {
      windowSum -= candles[i - period].close;
    }
    if (i >= period - 1) {
      points.push({ time: candles[i].time, value: windowSum / period });
    }
  }
  return points;
}

export function computeEma(candles: VisibleCandle[], period: number): IndicatorPoint[] {
  if (!isValidMaPeriod(period) || candles.length < period) return [];
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i += 1) {
    sum += candles[i].close;
  }
  let ema = sum / period;
  const points: IndicatorPoint[] = [{ time: candles[period - 1].time, value: ema }];
  for (let i = period; i < candles.length; i += 1) {
    ema = candles[i].close * k + ema * (1 - k);
    points.push({ time: candles[i].time, value: ema });
  }
  return points;
}

export function computeSessionVwap(candles: VisibleCandle[]): IndicatorPoint[] {
  return computeVwapFrom(candles, null);
}

export function computeAnchoredVwap(
  candles: VisibleCandle[],
  anchorTime: number,
): IndicatorPoint[] {
  return computeVwapFrom(candles, anchorTime);
}

function computeVwapFrom(
  candles: VisibleCandle[],
  fromTime: number | null,
): IndicatorPoint[] {
  const points: IndicatorPoint[] = [];
  let cumPv = 0;
  let cumVol = 0;
  for (const candle of candles) {
    if (fromTime != null && candle.time < fromTime) continue;
    if (candle.volume > 0) {
      cumPv += typicalPrice(candle) * candle.volume;
      cumVol += candle.volume;
    }
    if (cumVol > 0) {
      points.push({ time: candle.time, value: cumPv / cumVol });
    }
  }
  return points;
}

function valueAtTime(data: IndicatorPoint[], time: number): number | null {
  let best: IndicatorPoint | null = null;
  for (const point of data) {
    if (point.time > time) break;
    best = point;
  }
  return best?.value ?? null;
}

/**
 * Hit-test AVWAP overlays near a click (price Y in chart coords).
 * Returns the closest AVWAP id within tolerance, or null.
 */
export function pickAvwapAt(
  overlays: IndicatorOverlay[],
  time: number,
  clickY: number,
  priceToY: (price: number) => number | null,
  tolerancePx: number = AVWAP_HIT_TOLERANCE_PX,
): string | null {
  let bestId: string | null = null;
  let bestDist = Infinity;
  for (const overlay of overlays) {
    if (!isAvwapOverlayId(overlay.id)) continue;
    const value = valueAtTime(overlay.data, time);
    if (value == null) continue;
    const y = priceToY(value);
    if (y == null || !Number.isFinite(y)) continue;
    const dist = Math.abs(y - clickY);
    if (dist <= tolerancePx && dist < bestDist) {
      bestDist = dist;
      bestId = overlay.id;
    }
  }
  return bestId;
}

export function buildReplayOverlays(
  candles: VisibleCandle[],
  state: PaneIndicators,
): IndicatorOverlay[] {
  const overlays: IndicatorOverlay[] = [];
  state.mas.forEach((ma, index) => {
    const data = ma.kind === 'ema' ? computeEma(candles, ma.period) : computeSma(candles, ma.period);
    overlays.push({
      id: ma.id,
      title: `${ma.kind.toUpperCase()} ${ma.period}`,
      color: colorForMa(index),
      data,
    });
  });
  if (state.vwap) {
    overlays.push({
      id: 'vwap',
      title: 'VWAP',
      color: VWAP_COLOR,
      data: computeSessionVwap(candles),
    });
  }
  for (const avwap of state.avwaps) {
    if (avwap.anchorTime == null) continue;
    overlays.push({
      id: avwap.id,
      title: 'AVWAP',
      color: avwap.style.color,
      lineWidth: avwap.style.lineWidth,
      data: computeAnchoredVwap(candles, avwap.anchorTime),
    });
  }
  return overlays;
}

export function addMovingAverage(
  state: PaneIndicators,
  kind: MaKind,
  period: number,
): PaneIndicators {
  if (!isValidMaPeriod(period)) return state;
  if (state.mas.some((ma) => ma.kind === kind && ma.period === period)) return state;
  return {
    ...state,
    mas: [
      ...state.mas,
      { id: `${kind}-${period}-${Date.now()}`, kind, period },
    ],
  };
}

export function removeMovingAverage(state: PaneIndicators, id: string): PaneIndicators {
  return { ...state, mas: state.mas.filter((ma) => ma.id !== id) };
}

export function toggleVwap(state: PaneIndicators, enabled: boolean): PaneIndicators {
  return { ...state, vwap: enabled };
}

export function addAvwap(state: PaneIndicators): PaneIndicators {
  if (pendingAvwap(state) != null) return state;
  if (state.avwaps.length >= MAX_AVWAPS) return state;
  return {
    ...state,
    avwaps: [
      ...state.avwaps,
      {
        id: newAvwapId(),
        anchorTime: null,
        style: {
          color: nextAvwapColor(state),
          lineWidth: DEFAULT_AVWAP_STYLE.lineWidth,
        },
      },
    ],
  };
}

export function removeAvwap(state: PaneIndicators, id: string): PaneIndicators {
  return { ...state, avwaps: state.avwaps.filter((a) => a.id !== id) };
}

export function setAvwapAnchor(
  state: PaneIndicators,
  id: string,
  time: number,
): PaneIndicators {
  return {
    ...state,
    avwaps: state.avwaps.map((a) =>
      a.id === id ? { ...a, anchorTime: time } : a,
    ),
  };
}

export function setAvwapStyle(
  state: PaneIndicators,
  id: string,
  style: DrawingStyle,
): PaneIndicators {
  return {
    ...state,
    avwaps: state.avwaps.map((a) =>
      a.id === id
        ? {
            ...a,
            style: {
              color: style.color,
              lineWidth: style.lineWidth,
            },
          }
        : a,
    ),
  };
}

function isDrawingStyle(value: unknown): value is DrawingStyle {
  if (!value || typeof value !== 'object') return false;
  const style = value as Record<string, unknown>;
  return typeof style.color === 'string' && typeof style.lineWidth === 'number';
}

function isReplayAvwap(value: unknown): value is ReplayAvwapIndicator {
  if (!value || typeof value !== 'object') return false;
  const a = value as Record<string, unknown>;
  return (
    typeof a.id === 'string' &&
    isAvwapOverlayId(a.id) &&
    (a.anchorTime === null || typeof a.anchorTime === 'number') &&
    isDrawingStyle(a.style)
  );
}

function isReplayMa(value: unknown): value is ReplayMaIndicator {
  if (!value || typeof value !== 'object') return false;
  const ma = value as Record<string, unknown>;
  return (
    typeof ma.id === 'string' &&
    (ma.kind === 'sma' || ma.kind === 'ema') &&
    typeof ma.period === 'number'
  );
}

/** Normalize workspace / legacy PaneIndicators to the current shape. */
export function normalizePaneIndicators(raw: unknown): PaneIndicators {
  const base = emptyPaneIndicators();
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Record<string, unknown>;

  const vwap = Boolean(obj.vwap);
  const mas = Array.isArray(obj.mas) ? obj.mas.filter(isReplayMa) : [];

  let avwaps: ReplayAvwapIndicator[] = [];
  if (Array.isArray(obj.avwaps)) {
    avwaps = obj.avwaps.filter(isReplayAvwap).slice(0, MAX_AVWAPS);
  } else if (obj.avwap === true) {
    const anchor =
      typeof obj.avwapAnchor === 'number'
        ? obj.avwapAnchor
        : obj.avwapAnchor === null
          ? null
          : null;
    const style = isDrawingStyle(obj.avwapStyle)
      ? { color: obj.avwapStyle.color, lineWidth: obj.avwapStyle.lineWidth }
      : { ...DEFAULT_AVWAP_STYLE };
    avwaps = [
      {
        id: 'avwap-legacy',
        anchorTime: anchor,
        style,
      },
    ];
  }

  // At most one pending AVWAP: keep the first, drop extras
  let seenPending = false;
  avwaps = avwaps.filter((a) => {
    if (a.anchorTime != null) return true;
    if (seenPending) return false;
    seenPending = true;
    return true;
  });

  return { vwap, avwaps, mas };
}
