/** Hauteur des contrôles dans la barre de filtres dashboard (plus compact que h-10). */
export const BAND_CONTROL_HEIGHT = 'h-9';

/** Hauteur minimale de la ligne (contrôles + cartes KPI au chargement). */
export const BAND_ROW_MIN_HEIGHT = 'min-h-10';

const bandPillBase =
  `inline-flex w-full min-w-0 ${BAND_CONTROL_HEIGHT} items-center gap-2 truncate rounded-lg border px-3 text-xs font-medium shadow-sm transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:ring-offset-0 focus:ring-offset-transparent sm:text-sm`;

export const bandPillTrigger = bandPillBase;

export const bandPillTriggerStyle =
  'border-white/15 bg-white/10 text-white hover:border-white/25 hover:bg-white/15';

export const bandChevronClass = 'h-4 w-4 flex-shrink-0 text-white/50 transition-transform';

export const defaultPillTrigger =
  'inline-flex w-full min-w-0 h-10 items-center gap-2 truncate rounded-lg border px-3 text-sm font-medium shadow-sm transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:ring-offset-0 dark:focus:ring-blue-400/30';

export const defaultPillTriggerStyle =
  'border-gray-200 bg-white text-gray-900 hover:border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:border-gray-500 dark:hover:bg-gray-700/70';

export const defaultChevronClass =
  'h-4 w-4 flex-shrink-0 text-gray-400 transition-transform dark:text-gray-500';

export function getPillTriggerClasses(variant: 'default' | 'band' = 'default'): {
  trigger: string;
  style: string;
  chevron: string;
} {
  if (variant === 'band') {
    return {
      trigger: bandPillTrigger,
      style: bandPillTriggerStyle,
      chevron: bandChevronClass,
    };
  }
  return {
    trigger: defaultPillTrigger,
    style: defaultPillTriggerStyle,
    chevron: defaultChevronClass,
  };
}

export const bandFrameClass =
  `${BAND_CONTROL_HEIGHT} w-full min-w-0 inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 text-xs font-medium shadow-sm text-white sm:text-sm`;

export const bandAccountTriggerClass =
  `${BAND_CONTROL_HEIGHT} flex-1 inline-flex items-center justify-between rounded-lg border border-white/15 bg-white/10 px-3 text-xs font-medium text-white shadow-sm transition-colors hover:border-white/25 hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:ring-offset-0 focus:ring-offset-transparent disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm`;
