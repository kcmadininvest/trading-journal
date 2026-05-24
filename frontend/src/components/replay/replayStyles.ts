/** Classes partagées alignées sur le calendrier (CalendarPage / DailyView). */

import { getReplayPnlColors } from './replayPnlColors';

export const replayCardClass =
  'bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700';

export const replayPanelClass = `${replayCardClass} p-4`;

export const replayPrimaryButtonClass =
  'inline-flex items-center justify-center h-10 px-3 sm:px-4 text-sm font-medium bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap';

export const replaySecondaryButtonClass =
  'inline-flex items-center justify-center h-10 px-3 sm:px-4 text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed';

/** Aligné sur TradesFilters / TransactionHistory */
export const replayDateInputClass =
  'w-full h-10 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

export function getReplayPnlTextClass(value: number): string {
  if (value > 0) return 'text-green-600 dark:text-green-400';
  if (value < 0) return 'text-red-600 dark:text-red-400';
  return 'text-gray-500 dark:text-gray-400';
}

/** Palette SVG du bandeau marché replay (bleu haussier / rose baissier + gris futur). */
export interface MarketTapeTheme {
  background: string;
  chartBgTop: string;
  chartBgBottom: string;
  border: string;
  gridLine: string;
  bullFill: string;
  bearFill: string;
  wickFill: string;
  futureFill: string;
  cursor: string;
  cursorMuted: string;
  positionBand: string;
  entryLong: string;
  entryShort: string;
  exitWin: string;
  exitLoss: string;
  fillDot: string;
  orderRing: string;
}

export function getMarketTapeTheme(isDark: boolean): MarketTapeTheme {
  const pnl = getReplayPnlColors(isDark);
  const cursor = isDark ? '#06b6d4' : '#2563eb';
  const fillDot = isDark ? '#22d3ee' : '#2563eb';

  if (isDark) {
    return {
      background: '#0B1020',
      chartBgTop: '#0F172A',
      chartBgBottom: '#0B1020',
      border: 'rgba(255,255,255,0.1)',
      gridLine: '#ffffff',
      bullFill: '#3b82f6',
      bearFill: '#f472b6',
      wickFill: '#334155',
      futureFill: '#64748b',
      cursor,
      cursorMuted: 'rgba(6, 182, 212, 0.25)',
      positionBand: 'rgba(6, 182, 212, 0.15)',
      entryLong: pnl.positive,
      entryShort: pnl.negative,
      exitWin: pnl.positive,
      exitLoss: pnl.negative,
      fillDot,
      orderRing: '#94a3b8',
    };
  }
  return {
    background: '#ffffff',
    chartBgTop: '#f8fafc',
    chartBgBottom: '#ffffff',
    border: '#e5e7eb',
    gridLine: '#64748b',
    bullFill: '#3b82f6',
    bearFill: '#f472b6',
    wickFill: '#1e293b',
    futureFill: '#d1d5db',
    cursor,
    cursorMuted: 'rgba(37, 99, 235, 0.12)',
    positionBand: 'rgba(37, 99, 235, 0.1)',
    entryLong: pnl.positive,
    entryShort: pnl.negative,
    exitWin: pnl.positive,
    exitLoss: pnl.negative,
    fillDot,
    orderRing: '#6b7280',
  };
}

export function getReplayPnlBgClass(value: number, isSelected = false): string {
  if (isSelected) {
    return value > 0
      ? 'bg-green-100 dark:bg-green-900/30 ring-2 ring-blue-500 dark:ring-blue-400 ring-inset'
      : value < 0
        ? 'bg-red-100 dark:bg-red-900/30 ring-2 ring-blue-500 dark:ring-blue-400 ring-inset'
        : 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500 dark:ring-blue-400 ring-inset';
  }
  if (value > 0) return 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30';
  if (value < 0) return 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30';
  return 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700';
}
