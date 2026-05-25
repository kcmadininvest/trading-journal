import React from 'react';

const BAND_SHELL_VISUAL =
  'w-full min-w-0 rounded-xl border border-white/10 bg-gradient-to-r from-[#0f172a] via-[#172554] to-[#0f172a] shadow-lg shadow-blue-950/30 text-white backdrop-blur-xl dark:from-slate-950 dark:via-blue-950 dark:to-slate-950';

/** Bandeau horizontal centré (cotations live). */
export const TICKER_SHELL_CLASS = `${BAND_SHELL_VISUAL} flex min-h-[3.25rem] items-center justify-center gap-4 overflow-x-auto px-4 py-2.5 sm:px-5 sm:py-3`;

/** Barre de filtres : hauteur min. pour h-9/h-10 + py-2 ; overflow visible pour les menus portés. */
export const FILTER_BAR_SHELL_CLASS = `${BAND_SHELL_VISUAL} flex min-h-[3.5rem] items-center justify-start gap-2 overflow-visible px-3 py-2 sm:gap-3 sm:px-4`;

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
