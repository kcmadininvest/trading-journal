import { ChartOptions, TooltipOptions, ChartType } from 'chart.js';

export type AppFontFamily =
  | 'inter'
  | 'lato'
  | 'montserrat'
  | 'noto_sans'
  | 'nunito'
  | 'open_sans'
  | 'poppins'
  | 'raleway'
  | 'roboto'
  | 'source_sans_3'
  | 'ubuntu'
  | 'work_sans';

export const APP_FONT_FAMILY_STORAGE_KEY = 'font_family';
export const APP_FONT_LINK_ID = 'app-google-font';
export const SYSTEM_FONT_FALLBACK = 'ui-sans-serif, system-ui, sans-serif';
const DEFAULT_FONT_FAMILY: AppFontFamily = 'inter';

export interface AppFontOption {
  value: AppFontFamily;
  cssFamily: string;
  googleFamilyParam: string;
}

/** Ordre alphabétique sur le nom affiché (cssFamily). */
const APP_FONT_OPTIONS: AppFontOption[] = [
  { value: 'inter', cssFamily: 'Inter', googleFamilyParam: 'Inter:wght@400;500;600;700' },
  { value: 'lato', cssFamily: 'Lato', googleFamilyParam: 'Lato:wght@400;700' },
  { value: 'montserrat', cssFamily: 'Montserrat', googleFamilyParam: 'Montserrat:wght@400;500;600;700' },
  { value: 'noto_sans', cssFamily: 'Noto Sans', googleFamilyParam: 'Noto+Sans:wght@400;500;600;700' },
  { value: 'nunito', cssFamily: 'Nunito', googleFamilyParam: 'Nunito:wght@400;500;600;700' },
  { value: 'open_sans', cssFamily: 'Open Sans', googleFamilyParam: 'Open+Sans:wght@400;500;600;700' },
  { value: 'poppins', cssFamily: 'Poppins', googleFamilyParam: 'Poppins:wght@400;500;600;700' },
  { value: 'raleway', cssFamily: 'Raleway', googleFamilyParam: 'Raleway:wght@400;500;600;700' },
  { value: 'roboto', cssFamily: 'Roboto', googleFamilyParam: 'Roboto:wght@400;500;700' },
  { value: 'source_sans_3', cssFamily: 'Source Sans 3', googleFamilyParam: 'Source+Sans+3:wght@400;500;600;700' },
  { value: 'ubuntu', cssFamily: 'Ubuntu', googleFamilyParam: 'Ubuntu:wght@400;500;700' },
  { value: 'work_sans', cssFamily: 'Work Sans', googleFamilyParam: 'Work+Sans:wght@400;500;600;700' },
];

const APP_FONT_OPTION_MAP = new Map<AppFontFamily, AppFontOption>(
  APP_FONT_OPTIONS.map((option) => [option.value, option]),
);

export const getAppFontOptions = (): AppFontOption[] => APP_FONT_OPTIONS;

export const isAppFontFamily = (value: string | null | undefined): value is AppFontFamily => {
  if (!value) {
    return false;
  }
  return APP_FONT_OPTION_MAP.has(value as AppFontFamily);
};

export const normalizeAppFontFamily = (value: string | null | undefined): AppFontFamily => {
  if (isAppFontFamily(value)) {
    return value;
  }
  return DEFAULT_FONT_FAMILY;
};

export const getFontStackFromFamily = (fontFamily: AppFontFamily): string => {
  const option = APP_FONT_OPTION_MAP.get(fontFamily) ?? APP_FONT_OPTION_MAP.get(DEFAULT_FONT_FAMILY)!;
  return `'${option.cssFamily}', ${SYSTEM_FONT_FALLBACK}`;
};

export const getGoogleFontsUrl = (fontFamily: AppFontFamily): string => {
  const option = APP_FONT_OPTION_MAP.get(fontFamily) ?? APP_FONT_OPTION_MAP.get(DEFAULT_FONT_FAMILY)!;
  return `https://fonts.googleapis.com/css2?family=${option.googleFamilyParam}&display=swap`;
};

export const applyAppFontFamilyToDocument = (fontFamily: AppFontFamily): string => {
  const fontStack = getFontStackFromFamily(fontFamily);
  document.documentElement.style.setProperty('--app-font-sans', fontStack);
  return fontStack;
};

export const ensureGoogleFontLink = (fontFamily: AppFontFamily): void => {
  const href = getGoogleFontsUrl(fontFamily);
  let link = document.getElementById(APP_FONT_LINK_ID) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = APP_FONT_LINK_ID;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  if (link.href !== href) {
    link.href = href;
  }
};

export const applyAppFontFamily = (fontFamily: AppFontFamily): string => {
  ensureGoogleFontLink(fontFamily);
  const fontStack = applyAppFontFamilyToDocument(fontFamily);
  syncChartFontFamily(fontStack);
  return fontStack;
};

export const getStoredAppFontFamily = (): AppFontFamily => {
  try {
    const stored = localStorage.getItem(APP_FONT_FAMILY_STORAGE_KEY);
    return normalizeAppFontFamily(stored);
  } catch {
    return DEFAULT_FONT_FAMILY;
  }
};

export const storeAppFontFamily = (fontFamily: AppFontFamily): void => {
  try {
    localStorage.setItem(APP_FONT_FAMILY_STORAGE_KEY, fontFamily);
  } catch {
    // Ignore localStorage errors.
  }
};

/** Même pile que `Chart.defaults.font` dans `index.tsx`. Obligatoire pour datalabels et tout `font` partiel (sinon fallback Helvetica interne de `helpers.toFont`). */
export let CHART_FONT_FAMILY = getFontStackFromFamily(DEFAULT_FONT_FAMILY);

export const syncChartFontFamily = (fontFamily: string): void => {
  CHART_FONT_FAMILY = fontFamily;
};

/** Hauteur standard des graphiques (onglet Graphiques — cartes principales). */
export const STRATEGY_CHART_LAZY_HEIGHT = 'h-64 sm:h-72 md:h-80';

/** Min-height équivalente (graphique qui remplit une cellule extensible). */
export const STRATEGY_CHART_LAZY_MIN_HEIGHT = 'min-h-64 sm:min-h-72 md:min-h-80';

/** Graphique en flex : remplit l'espace tout en gardant la hauteur mini des autres onglets. */
export const STRATEGY_CHART_LAZY_FILL_HEIGHT =
  'h-full min-h-0 flex-1 min-h-64 sm:min-h-72 md:min-h-80';

/** Hauteur minimale d'une tuile (en-tête + graphique standard), pour grilles à hauteur fixe. */
export const STRATEGY_CHART_TILE_MIN_HEIGHT_CLASS =
  'min-h-[22rem] sm:min-h-[24rem] md:min-h-[26rem]';

/** Colonne insights (2 cartes empilées) = une tuile graphique standard. */
export const STRATEGY_INSIGHTS_LEFT_COLUMN_CLASS =
  'flex h-full min-h-0 flex-col gap-2 sm:gap-3';

/** Carte insights dans une colonne empilée : moitié de la tuile standard. */
export const STRATEGY_INSIGHTS_STACKED_CARD_CLASS =
  'flex min-h-0 flex-1 basis-0 flex-col overflow-hidden';

/** Coquille compacte pour cartes insights empilées. */
export const STRATEGY_INSIGHTS_COMPACT_SHELL_CLASS =
  'bg-white dark:bg-gray-800 rounded-lg shadow p-2 sm:p-3 border border-gray-200 dark:border-gray-700';

/** Coquille visuelle alignée sur `ChartSection` (Stratégies). */
export const STRATEGY_CHART_SECTION_SHELL_CLASS =
  'bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 md:p-6';
/** Carte graphique standard (page Analytics). */
export const ANALYTICS_CHART_CARD_CLASS =
  'h-full bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl transition-shadow duration-300 min-h-[450px] flex flex-col';

/** En-tête titre + info (une ligne). */
export const ANALYTICS_CHART_HEADER_CLASS = 'flex items-center gap-2 mb-6 flex-shrink-0';

/** Zone de tracé — même hauteur minimale que les autres graphiques Analytics. */
export const ANALYTICS_CHART_BODY_CLASS = 'relative flex-1 min-h-[320px]';

export const ANALYTICS_CHART_MIN_HEIGHT = 320;

/**
 * Marges de base pour graphiques SVG Analytics.
 * Aligné sur chartArea Chart.js (auto-fit des ticks) et Recharts (ex. MaeMfe).
 */
export const ANALYTICS_SVG_CHART_MARGIN = {
  top: 8,
  right: 12,
  bottom: 52,
  /** Axe X à deux lignes de ticks + titre (ex. corrélation PnL / trades). */
  bottomDenseX: 58,
  minLeft: 4,
  tickGap: 6,
  edgePad: 2,
} as const;

export interface AnalyticsSvgPlotMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

let svgTextMeasureCanvas: HTMLCanvasElement | null = null;

function measureSvgTickLabelWidth(text: string, fontSize: number): number {
  if (typeof document === 'undefined') {
    return text.length * fontSize * 0.6;
  }

  if (!svgTextMeasureCanvas) {
    svgTextMeasureCanvas = document.createElement('canvas');
  }

  const ctx = svgTextMeasureCanvas.getContext('2d');
  if (!ctx) {
    return text.length * fontSize * 0.6;
  }

  ctx.font = `${fontSize}px ${CHART_FONT_FAMILY}`;
  return ctx.measureText(text).width;
}

/** Marge gauche selon la largeur réelle des libellés (équivalent auto-fit Chart.js). */
export function computeAnalyticsSvgLeftMargin(
  tickLabels: string[],
  tickFontSize: number,
  options?: {
    minLeft?: number;
    tickGap?: number;
    edgePad?: number;
  },
): number {
  const minLeft = options?.minLeft ?? ANALYTICS_SVG_CHART_MARGIN.minLeft;
  const tickGap = options?.tickGap ?? ANALYTICS_SVG_CHART_MARGIN.tickGap;
  const edgePad = options?.edgePad ?? ANALYTICS_SVG_CHART_MARGIN.edgePad;

  const maxLabelWidth = tickLabels.reduce(
    (max, label) => Math.max(max, measureSvgTickLabelWidth(label, tickFontSize)),
    0,
  );

  return Math.max(minLeft, Math.ceil(maxLabelWidth) + tickGap + edgePad);
}

export function computeAnalyticsSvgPlotMargins(params: {
  yTickLabels: string[];
  tickFontSize: number;
  bottom?: number;
}): AnalyticsSvgPlotMargins {
  const { yTickLabels, tickFontSize, bottom } = params;

  return {
    top: ANALYTICS_SVG_CHART_MARGIN.top,
    right: ANALYTICS_SVG_CHART_MARGIN.right,
    bottom: bottom ?? ANALYTICS_SVG_CHART_MARGIN.bottom,
    left: computeAnalyticsSvgLeftMargin(yTickLabels, tickFontSize),
  };
}

export type ChartFontSizePreference = 'small' | 'medium' | 'large';

/** Tailles SVG alignées sur Paramètres → Taille (graphiques hors Chart.js). */
export const getChartSvgFontSizes = (fontSize: ChartFontSizePreference = 'medium') => {
  const sizes: Record<ChartFontSizePreference, { tick: number; axis: number; title: number; caption: number }> = {
    small: { tick: 10, axis: 11, title: 12, caption: 9 },
    medium: { tick: 12, axis: 13, title: 13, caption: 10 },
    large: { tick: 14, axis: 15, title: 15, caption: 11 },
  };
  return sizes[fontSize] ?? sizes.medium;
};

export interface ChartColors {
  text: string;
  textSecondary: string;
  background: string;
  grid: string;
  border: string;
  tooltipBg: string;
  tooltipTitle: string;
  tooltipBody: string;
  tooltipBorder: string;
}

/** Variante de tooltip Chart.js mutualisée (barres vs courbes multi-séries). */
export type ChartTooltipVariant = 'barStackedLike' | 'lineMultiSeries';

export interface BuildChartTooltipPluginOptions {
  /** Ex. masquage privacy : `enabled: false` */
  enabled?: boolean;
}

const baseTooltipFonts = () => ({
  titleFont: {
    family: CHART_FONT_FAMILY,
    size: 14,
    weight: 600 as const,
  },
  bodyFont: {
    family: CHART_FONT_FAMILY,
    size: 13,
    weight: 500 as const,
  },
});

/**
 * Configuration standard `plugins.tooltip` pour l’application (couleurs getChartColors, typo, padding).
 * Les `callbacks` et autres surcharges se passent via `overrides` (spread après l’appel).
 */
export function buildChartTooltipPlugin<TChartType extends ChartType = ChartType>(
  chartColors: ChartColors,
  variant: ChartTooltipVariant,
  options?: BuildChartTooltipPluginOptions,
  /** Surcharges (callbacks, external, filter, etc.) */
  overrides?: Record<string, unknown>
): Partial<TooltipOptions<TChartType>> {
  const common = {
    backgroundColor: chartColors.tooltipBg,
    titleColor: chartColors.tooltipTitle,
    bodyColor: chartColors.tooltipBody,
    borderColor: chartColors.tooltipBorder,
    borderWidth: 1,
    padding: 16,
    ...baseTooltipFonts(),
    ...(options?.enabled !== undefined ? { enabled: options.enabled } : {}),
  };

  const variantPart =
    variant === 'lineMultiSeries'
      ? {
          displayColors: true,
          mode: 'index' as const,
          intersect: false,
        }
      : {
          displayColors: false,
          mode: 'index' as const,
          intersect: false,
        };

  return {
    ...common,
    ...variantPart,
    ...(overrides as object),
  } as Partial<TooltipOptions<TChartType>>;
}

/** Barres horizontales : sans axe Y, Chart.js associe le mauvais index au survol. */
export const horizontalBarChartInteraction = {
  mode: 'index' as const,
  axis: 'y' as const,
  intersect: false,
};

/** Tooltip Chart.js pour barres horizontales (aligné GainsVsLossesChart). */
export function buildHorizontalBarChartTooltipPlugin<TChartType extends ChartType = ChartType>(
  chartColors: ChartColors,
  overrides?: Record<string, unknown>
): Partial<TooltipOptions<TChartType>> {
  return buildChartTooltipPlugin(chartColors, 'barStackedLike', undefined, {
    axis: 'y' as const,
    padding: 12,
    ...(overrides as object),
  });
}

interface WindowSize {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

export const getChartColors = (isDark: boolean): ChartColors => ({
  text: isDark ? '#d1d5db' : '#374151',
  textSecondary: isDark ? '#9ca3af' : '#6b7280',
  background: isDark ? '#1f2937' : '#ffffff',
  grid: isDark ? '#374151' : '#e5e7eb',
  border: isDark ? '#4b5563' : '#d1d5db',
  tooltipBg: isDark ? '#374151' : '#ffffff',
  tooltipTitle: isDark ? '#d1d5db' : '#4b5563',
  tooltipBody: isDark ? '#f3f4f6' : '#1f2937',
  tooltipBorder: isDark ? '#4b5563' : '#e5e7eb',
});

interface BaseChartOptionsParams {
  chartColors: ChartColors;
  isMobile: boolean;
  showLegend?: boolean;
  showDataLabels?: boolean;
  yAxisLabel?: string;
  yAxisMax?: number;
  stacked?: boolean;
}

export const createBaseChartOptions = ({
  chartColors,
  isMobile,
  showLegend = true,
  showDataLabels = true,
  yAxisLabel,
  yAxisMax,
  stacked = false,
}: BaseChartOptionsParams): Partial<ChartOptions<any>> => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: showLegend,
      position: 'top' as const,
      labels: {
        usePointStyle: true,
        padding: isMobile ? 12 : 20,
        font: {
          family: CHART_FONT_FAMILY,
          size: isMobile ? 10 : 12,
        },
        color: chartColors.textSecondary,
      },
    },
    datalabels: {
      display: showDataLabels,
      color: '#ffffff',
      font: {
        family: CHART_FONT_FAMILY,
        weight: 600,
        size: isMobile ? 10 : 13,
      },
    },
    tooltip: buildChartTooltipPlugin(chartColors, 'barStackedLike'),
  },
  scales: {
    y: {
      beginAtZero: true,
      stacked,
      max: yAxisMax,
      ticks: {
        color: chartColors.textSecondary,
        font: {
          family: CHART_FONT_FAMILY,
          size: isMobile ? 10 : 12,
        },
      },
      grid: {
        color: chartColors.grid,
        lineWidth: 1,
      },
      border: {
        color: chartColors.border,
        display: false,
      },
      title: yAxisLabel ? {
        display: true,
        text: yAxisLabel,
        color: chartColors.text,
        font: {
          family: CHART_FONT_FAMILY,
          size: isMobile ? 11 : 13,
          weight: 600,
        },
      } : {
        display: false,
      },
    },
    x: {
      stacked,
      ticks: {
        color: chartColors.textSecondary,
        font: {
          family: CHART_FONT_FAMILY,
          size: isMobile ? 10 : 12,
        },
      },
      grid: {
        color: chartColors.grid,
        lineWidth: 1,
      },
      border: {
        color: chartColors.border,
      },
      title: {
        display: false,
      },
    },
  },
});

export const generateChartColors = (count: number): { backgroundColor: string[]; borderColor: string[] } => {
  const baseColors = [
    { bg: 'rgba(59, 130, 246, 0.8)', border: 'rgb(59, 130, 246)' },
    { bg: 'rgba(34, 197, 94, 0.8)', border: 'rgb(34, 197, 94)' },
    { bg: 'rgba(239, 68, 68, 0.8)', border: 'rgb(239, 68, 68)' },
    { bg: 'rgba(251, 191, 36, 0.8)', border: 'rgb(251, 191, 36)' },
    { bg: 'rgba(168, 85, 247, 0.8)', border: 'rgb(168, 85, 247)' },
    { bg: 'rgba(236, 72, 153, 0.8)', border: 'rgb(236, 72, 153)' },
    { bg: 'rgba(20, 184, 166, 0.8)', border: 'rgb(20, 184, 166)' },
    { bg: 'rgba(249, 115, 22, 0.8)', border: 'rgb(249, 115, 22)' },
    { bg: 'rgba(6, 182, 212, 0.8)', border: 'rgb(6, 182, 212)' },
    { bg: 'rgba(132, 204, 22, 0.8)', border: 'rgb(132, 204, 22)' },
    { bg: 'rgba(234, 179, 8, 0.8)', border: 'rgb(234, 179, 8)' },
    { bg: 'rgba(225, 29, 72, 0.8)', border: 'rgb(225, 29, 72)' },
    { bg: 'rgba(139, 92, 246, 0.8)', border: 'rgb(139, 92, 246)' },
    { bg: 'rgba(14, 165, 233, 0.8)', border: 'rgb(14, 165, 233)' },
    { bg: 'rgba(5, 150, 105, 0.8)', border: 'rgb(5, 150, 105)' },
    { bg: 'rgba(217, 119, 6, 0.8)', border: 'rgb(217, 119, 6)' },
    { bg: 'rgba(190, 24, 93, 0.8)', border: 'rgb(190, 24, 93)' },
    { bg: 'rgba(99, 102, 241, 0.8)', border: 'rgb(99, 102, 241)' },
  ];

  const colors: string[] = [];
  const borders: string[] = [];
  for (let i = 0; i < count; i++) {
    const color = baseColors[i % baseColors.length];
    colors.push(color.bg);
    borders.push(color.border);
  }
  return { backgroundColor: colors, borderColor: borders };
};

// Factory pour créer les options de base d'un graphique en barres
export const createBarChartOptions = (
  chartColors: ChartColors,
  windowSize: WindowSize,
  options: {
    stacked?: boolean;
    maxValue?: number;
    showPercentage?: boolean;
    yAxisTitle?: string;
  } = {}
): Partial<ChartOptions<'bar'>> => {
  const { stacked = false, maxValue, showPercentage = false, yAxisTitle } = options;

  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: windowSize.isMobile ? 12 : 20,
          font: {
            family: CHART_FONT_FAMILY,
            size: windowSize.isMobile ? 10 : 12,
          },
          color: chartColors.textSecondary,
        },
      },
      tooltip: buildChartTooltipPlugin(chartColors, 'barStackedLike'),
    },
    scales: {
      y: {
        beginAtZero: true,
        stacked,
        ...(maxValue && { max: maxValue }),
        ticks: {
          callback: showPercentage ? (value: any) => value + '%' : undefined,
          color: chartColors.textSecondary,
          font: {
            family: CHART_FONT_FAMILY,
            size: windowSize.isMobile ? 10 : 12,
          },
        },
        grid: {
          color: chartColors.grid,
          lineWidth: 1,
        },
        border: {
          color: chartColors.border,
          display: false,
        },
        ...(yAxisTitle && {
          title: {
            display: true,
            text: yAxisTitle,
            color: chartColors.text,
            font: {
              family: CHART_FONT_FAMILY,
              size: windowSize.isMobile ? 11 : 13,
              weight: 600,
            },
          },
        }),
      },
      x: {
        stacked,
        ticks: {
          color: chartColors.textSecondary,
          font: {
            family: CHART_FONT_FAMILY,
            size: windowSize.isMobile ? 10 : 12,
          },
        },
        grid: {
          color: chartColors.grid,
          lineWidth: 1,
        },
        border: {
          color: chartColors.border,
        },
      },
    },
  };
};

// Factory pour créer les options d'un graphique en ligne
export const createLineChartOptions = (
  chartColors: ChartColors,
  windowSize: WindowSize,
  options: {
    yMin?: number;
    yMax?: number;
    showPercentage?: boolean;
    yAxisTitle?: string;
    xAxisRotation?: number;
  } = {}
): Partial<ChartOptions<'line'>> => {
  const { yMin, yMax, showPercentage = false, yAxisTitle, xAxisRotation = 0 } = options;

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: windowSize.isMobile ? 12 : 20,
          font: {
            family: CHART_FONT_FAMILY,
            size: windowSize.isMobile ? 10 : 12,
          },
          color: chartColors.textSecondary,
        },
      },
      tooltip: buildChartTooltipPlugin(chartColors, 'lineMultiSeries'),
    },
    scales: {
      y: {
        ...(yMin !== undefined && { min: yMin }),
        ...(yMax !== undefined && { max: yMax }),
        ticks: {
          callback: showPercentage ? (value: any) => value + '%' : undefined,
          color: chartColors.textSecondary,
          font: {
            family: CHART_FONT_FAMILY,
            size: windowSize.isMobile ? 10 : 12,
          },
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.1)',
          lineWidth: 1,
        },
        border: {
          color: chartColors.border,
          display: false,
        },
        ...(yAxisTitle && {
          title: {
            display: true,
            text: yAxisTitle,
            color: chartColors.text,
            font: {
              family: CHART_FONT_FAMILY,
              size: windowSize.isMobile ? 11 : 13,
              weight: 600,
            },
          },
        }),
      },
      x: {
        ticks: {
          color: chartColors.textSecondary,
          font: {
            family: CHART_FONT_FAMILY,
            size: windowSize.isMobile ? 10 : 12,
          },
          ...(xAxisRotation > 0 && {
            maxRotation: xAxisRotation,
            minRotation: xAxisRotation,
          }),
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.1)',
          lineWidth: 1,
        },
        border: {
          color: chartColors.border,
          display: false,
        },
      },
    },
    elements: {
      point: {
        hoverRadius: 6,
        hoverBorderWidth: 3,
      },
      line: {
        borderCapStyle: 'round' as const,
        borderJoinStyle: 'round' as const,
      },
    },
  };
};
