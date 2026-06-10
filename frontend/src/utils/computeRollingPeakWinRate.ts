import { getTradeDisplayPnlValue, PnlDisplayMode, TradePnlFields } from './pnlDisplay';
import type { PeriodPreset } from './periodPresetRanges';
import { classifyTradeOutcomeFromPnl } from './tradeDurationBuckets';
import { WIN_RATE_ROLLING_WINDOW } from './tradingSampleThresholds';

export interface TradeForWinRate extends TradePnlFields {
  entered_at?: string | null;
}

export type TradePnlOutcome = 'win' | 'loss' | 'breakeven';

/** Résultat aligné sur le P/L affiché (net ou brut), pas sur is_profitable (toujours net). */
export function getTradePnlOutcome(
  trade: TradeForWinRate,
  mode: PnlDisplayMode,
): TradePnlOutcome | null {
  const pnl = getTradeDisplayPnlValue(trade, mode);
  if (pnl == null) return null;
  return classifyTradeOutcomeFromPnl(pnl);
}

export function orderTradesChronologically<T extends { entered_at?: string | null }>(
  trades: T[],
): T[] {
  return [...trades].sort((a, b) => {
    const ta = a.entered_at ? new Date(a.entered_at).getTime() : 0;
    const tb = b.entered_at ? new Date(b.entered_at).getTime() : 0;
    return ta - tb;
  });
}

/**
 * Pic de win rate sur une fenêtre glissante de N trades chronologiques consécutifs.
 * Les breakeven occupent une place dans la fenêtre mais ne comptent pas comme victoire.
 */
export function computeRollingPeakWinRate(
  trades: TradeForWinRate[],
  pnlDisplayMode: PnlDisplayMode,
  windowSize: number = WIN_RATE_ROLLING_WINDOW,
): number | null {
  const ordered = orderTradesChronologically(
    trades.filter((trade) => getTradePnlOutcome(trade, pnlDisplayMode) != null),
  );

  if (ordered.length < windowSize) return null;

  let peak: number | null = null;
  for (let i = windowSize - 1; i < ordered.length; i++) {
    const slice = ordered.slice(i - windowSize + 1, i + 1);
    const winsInWindow = slice.filter(
      (trade) => getTradePnlOutcome(trade, pnlDisplayMode) === 'win',
    ).length;
    const rate = (winsInWindow / windowSize) * 100;
    if (peak == null || rate > peak) {
      peak = rate;
    }
  }

  return peak;
}

/**
 * Win rate sur les N derniers trades chronologiques (fenêtre terminale).
 */
export function computeTrailingWinRate(
  trades: TradeForWinRate[],
  pnlDisplayMode: PnlDisplayMode,
  windowSize: number = WIN_RATE_ROLLING_WINDOW,
): number | null {
  const ordered = orderTradesChronologically(
    trades.filter((trade) => getTradePnlOutcome(trade, pnlDisplayMode) != null),
  );

  if (ordered.length < windowSize) return null;

  const slice = ordered.slice(-windowSize);
  const winsInWindow = slice.filter(
    (trade) => getTradePnlOutcome(trade, pnlDisplayMode) === 'win',
  ).length;

  return (winsInWindow / windowSize) * 100;
}

export type WinRateRingSecondaryMode = 'peak' | 'recent';

/** Toujours les N derniers trades de la période : le pic historique reste trompeur même sur 3/6 mois glissants. */
export function usesRecentWinRateRing(_periodPreset?: PeriodPreset): boolean {
  return true;
}

export function resolveWinRateRingSecondary(
  trades: TradeForWinRate[],
  pnlDisplayMode: PnlDisplayMode,
  _periodPreset?: PeriodPreset,
): { value: number | null; mode: WinRateRingSecondaryMode } {
  return {
    value: computeTrailingWinRate(trades, pnlDisplayMode),
    mode: 'recent',
  };
}

export type TradeOutcomeLetter = 'W' | 'L' | 'B';

export interface TradeOutcomeSeriesItem {
  letter: TradeOutcomeLetter;
  trade: TradeForWinRate;
}

function outcomeToLetter(outcome: TradePnlOutcome): TradeOutcomeLetter {
  if (outcome === 'win') return 'W';
  if (outcome === 'loss') return 'L';
  return 'B';
}

export interface BuildTradeOutcomeSeriesOptions {
  /** Nombre max d'éléments à conserver. */
  limit?: number;
  /** Si true (défaut quand limit est défini), garde les N derniers trades. */
  tail?: boolean;
}

/**
 * Série chronologique W/L/B alignée sur le P/L affiché (net ou brut).
 * Ordre : plus ancien → plus récent (gauche → droite).
 */
export function buildTradeOutcomeSeries(
  trades: TradeForWinRate[],
  pnlDisplayMode: PnlDisplayMode,
  options?: BuildTradeOutcomeSeriesOptions,
): TradeOutcomeSeriesItem[] {
  const ordered = orderTradesChronologically(trades);

  const series: TradeOutcomeSeriesItem[] = [];
  for (const trade of ordered) {
    const outcome = getTradePnlOutcome(trade, pnlDisplayMode);
    if (outcome == null) continue;
    series.push({ letter: outcomeToLetter(outcome), trade });
  }

  const limit = options?.limit;
  if (limit == null || limit <= 0 || series.length <= limit) {
    return series;
  }

  const tail = options?.tail ?? true;
  return tail ? series.slice(-limit) : series.slice(0, limit);
}
