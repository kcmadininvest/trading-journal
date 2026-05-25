import React from 'react';

const TICKER_SHELL_BASE =
  'font-sans flex min-h-[3.25rem] w-full min-w-0 gap-4 overflow-x-auto rounded-xl border border-white/10 bg-gradient-to-r from-[#0f172a] via-[#172554] to-[#0f172a] shadow-lg shadow-blue-950/30 text-white backdrop-blur-xl dark:from-slate-950 dark:via-blue-950 dark:to-slate-950';

/** Bandeau horizontal centré (cotations live). */
export const TICKER_SHELL_CLASS = `${TICKER_SHELL_BASE} items-center justify-center px-4 py-2.5 sm:px-5 sm:py-3`;

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
