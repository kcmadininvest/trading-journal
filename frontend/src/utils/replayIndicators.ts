import type { VisibleCandle } from './replayEngine';
import type { DrawingStyle } from './replayDrawings';

export const MIN_MA_PERIOD = 2;
export const MAX_MA_PERIOD = 500;

export type MaKind = 'sma' | 'ema';

export interface ReplayMaIndicator {
  id: string;
  kind: MaKind;
  period: number;
}

export interface PaneIndicators {
  vwap: boolean;
  avwap: boolean;
  avwapAnchor: number | null;
  avwapStyle: DrawingStyle;
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
    avwap: false,
    avwapAnchor: null,
    avwapStyle: { ...DEFAULT_AVWAP_STYLE },
    mas: [],
  };
}

export function countActiveIndicators(state: PaneIndicators): number {
  return state.mas.length + (state.vwap ? 1 : 0) + (state.avwap ? 1 : 0);
}

export function isValidMaPeriod(period: number): boolean {
  return Number.isInteger(period) && period >= MIN_MA_PERIOD && period <= MAX_MA_PERIOD;
}

export function colorForMa(index: number): string {
  return MA_COLORS[index % MA_COLORS.length];
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
  if (state.avwap && state.avwapAnchor != null) {
    overlays.push({
      id: 'avwap',
      title: 'AVWAP',
      color: state.avwapStyle.color,
      lineWidth: state.avwapStyle.lineWidth,
      data: computeAnchoredVwap(candles, state.avwapAnchor),
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

export function toggleAvwap(state: PaneIndicators, enabled: boolean): PaneIndicators {
  return {
    ...state,
    avwap: enabled,
    avwapAnchor: enabled ? state.avwapAnchor : null,
  };
}

export function setAvwapAnchor(state: PaneIndicators, time: number): PaneIndicators {
  if (!state.avwap) return state;
  return { ...state, avwapAnchor: time };
}

export function setAvwapStyle(state: PaneIndicators, style: DrawingStyle): PaneIndicators {
  return {
    ...state,
    avwapStyle: {
      color: style.color,
      lineWidth: style.lineWidth,
    },
  };
}
