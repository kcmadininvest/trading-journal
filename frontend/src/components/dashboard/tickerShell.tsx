import React from 'react';
import { getChartColors } from '../../utils/chartConfig';

/** Dégradé bleu nuit — réservé aux cotations live (MarketQuotesTicker). */
export const BAND_SHELL_VISUAL =
  'w-full min-w-0 rounded-xl border border-white/10 bg-gradient-to-r from-[#0f172a] via-[#172554] to-[#0f172a] shadow-lg shadow-blue-950/30 text-white backdrop-blur-xl dark:from-slate-950 dark:via-blue-950 dark:to-slate-950';

/** Cartes dashboard (filtres, panneaux, stats) — fond uni, pas de dégradé. */
export const DASHBOARD_CARD_SHELL =
  'w-full min-w-0 rounded-xl border border-gray-200 bg-white text-gray-900 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

/** Bandeau horizontal centré (cotations live). */
export const TICKER_SHELL_CLASS = `${BAND_SHELL_VISUAL} flex min-h-[3.25rem] items-center justify-center gap-4 overflow-x-auto px-4 py-2.5 sm:px-5 sm:py-3`;

/** Barre de filtres : hauteur min. pour h-9/h-10 + py-2 ; overflow visible pour les menus portés. */
export const FILTER_BAR_SHELL_CLASS = `${DASHBOARD_CARD_SHELL} flex min-h-[3.5rem] items-center justify-start gap-2 overflow-visible px-3 py-2 sm:gap-3 sm:px-4`;

/** Panneau de section (KPI période, graphiques par jour). */
export const DASHBOARD_PANEL_SHELL_CLASS = `${DASHBOARD_CARD_SHELL} p-3 sm:p-4`;

/** Carte ou tuile à l'intérieur d'un panneau dashboard. */
export const DASHBOARD_INNER_CARD_CLASS =
  'rounded-lg border border-gray-200 bg-gray-50 transition-colors dark:border-gray-600 dark:bg-gray-700/40';

/** Carte stats autonome (grille dashboard). */
export const DASHBOARD_STAT_CARD_SHELL_CLASS = `${DASHBOARD_CARD_SHELL} rounded-lg`;

export const DASHBOARD_PANEL_TITLE_CLASS =
  'text-sm font-semibold text-gray-900 dark:text-gray-100';
export const DASHBOARD_PANEL_HINT_CLASS = 'text-xs font-normal text-gray-500 dark:text-gray-400';
export const DASHBOARD_INNER_LABEL_CLASS =
  'text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400';

/** Tuile regroupée (soldes, trades, meilleur jour…) dans un panneau dashboard. */
export const DASHBOARD_INNER_TILE_CLASS =
  'flex h-full min-w-0 w-full flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 transition-colors duration-150 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700/40 dark:hover:bg-gray-700/60 xl:flex-row xl:items-stretch xl:gap-0';

export const DASHBOARD_TILE_DIVIDER_CLASS =
  'hidden w-px shrink-0 self-stretch bg-gray-200 dark:bg-gray-600 xl:mx-4 xl:block';

export const DASHBOARD_GAUGE_TILE_CLASS = `${DASHBOARD_INNER_CARD_CLASS} flex flex-col items-center p-3 shadow-none transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-md dark:hover:shadow-none sm:p-4`;

export const DASHBOARD_BAND_DATE_LABEL_CLASS =
  'absolute -top-2.5 left-2 z-10 px-1 text-xs font-medium leading-none text-gray-500 bg-white dark:bg-gray-800 dark:text-gray-400';

export const DASHBOARD_BAND_DATE_INPUT_CLASS =
  'w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/30';

/** @deprecated Utiliser getDashboardChartAxisColors(isDark) — conservé pour imports existants. */
export const DASHBOARD_CHART_TICK = 'rgba(255, 255, 255, 0.55)';
export const DASHBOARD_CHART_GRID = 'rgba(255, 255, 255, 0.08)';
export const DASHBOARD_CHART_BORDER = 'rgba(255, 255, 255, 0.12)';

export function getDashboardChartAxisColors(isDark: boolean) {
  const colors = getChartColors(isDark);
  return {
    tick: colors.textSecondary,
    grid: colors.grid,
    border: colors.border,
  };
}

/** PnL dashboard : bleu = gain, rose = perte (convention historique des graphiques). */
export const DASHBOARD_PNL_POSITIVE_BAR_BG = 'rgba(59, 130, 246, 0.8)';
export const DASHBOARD_PNL_POSITIVE_BAR_BORDER = '#3b82f6';
export const DASHBOARD_PNL_NEGATIVE_BAR_BG = 'rgba(236, 72, 153, 0.8)';
export const DASHBOARD_PNL_NEGATIVE_BAR_BORDER = '#ec4899';
export const DASHBOARD_PNL_POSITIVE_TEXT_CLASS = 'text-blue-600 dark:text-blue-400';
export const DASHBOARD_PNL_NEGATIVE_TEXT_CLASS = 'text-pink-600 dark:text-pink-400';

export function getDashboardPerformanceBadgeClasses(color?: string): string {
  switch (color) {
    case '#10b981':
      return 'rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-400';
    case '#f59e0b':
      return 'rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-400';
    case '#ef4444':
      return 'rounded-full border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 dark:border-red-400/30 dark:bg-red-500/15 dark:text-red-400';
    default:
      return 'rounded-full border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300';
  }
}

export function DashboardPanel({
  children,
  className = '',
  ariaLabel,
  padding = 'default',
}: {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  padding?: 'default' | 'large';
}) {
  const pad = padding === 'large' ? 'p-4 sm:p-6' : '';
  return (
    <div
      className={`${DASHBOARD_PANEL_SHELL_CLASS} ${pad} ${className}`.trim()}
      role={ariaLabel ? 'region' : undefined}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}

export function TickerShell({
  children,
  ariaLabel,
  shellClassName = TICKER_SHELL_CLASS,
}: {
  children: React.ReactNode;
  ariaLabel: string;
  shellClassName?: string;
}) {
  return (
    <div className="w-full min-w-0" role="region" aria-label={ariaLabel}>
      <div className={shellClassName}>{children}</div>
    </div>
  );
}
