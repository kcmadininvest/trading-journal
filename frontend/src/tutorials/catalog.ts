/**
 * Catalogue des tutoriels in-app (source de vérité des slugs / steps).
 * Les textes i18n vivent sous le namespace `help`.
 */

export type TutorialSection =
  | 'getting-started'
  | 'workspace'
  | 'trades-pnl'
  | 'journal'
  | 'strategies';

/** Ordre d’affichage des sections dans le hub Aide. */
export const TUTORIAL_SECTION_ORDER: TutorialSection[] = [
  'getting-started',
  'workspace',
  'trades-pnl',
  'journal',
  'strategies',
];

export type TutorialStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';

export interface TutorialStepDef {
  /** Clé i18n relative : help:tutorials.<slug>.steps.<id>.* */
  id: string;
  /** Capture sous /tutorials/<locale>/<slug>-step-<n>.png (1-based) */
  imageStep: number;
}

export interface TutorialDef {
  slug: string;
  section: TutorialSection;
  /** Durée estimée en minutes (affichage) */
  estimatedMinutes: number;
  steps: TutorialStepDef[];
  /** Stub : contenu minimal, captures optionnelles */
  stub?: boolean;
}

export const TUTORIALS: TutorialDef[] = [
  // —— Pour bien démarrer ——
  {
    slug: 'getting-started',
    section: 'getting-started',
    estimatedMinutes: 5,
    steps: [
      { id: 'account', imageStep: 1 },
      { id: 'import', imageStep: 2 },
      { id: 'dashboard', imageStep: 3 },
      { id: 'journal', imageStep: 4 },
    ],
  },

  // —— Compte & préférences ——
  {
    slug: 'trading-accounts',
    section: 'workspace',
    estimatedMinutes: 4,
    steps: [
      { id: 'list', imageStep: 1 },
      { id: 'create', imageStep: 2 },
      { id: 'switch', imageStep: 3 },
    ],
  },
  {
    slug: 'display-settings',
    section: 'workspace',
    estimatedMinutes: 4,
    steps: [
      { id: 'open-display', imageStep: 1 },
      { id: 'locale-timezone', imageStep: 2 },
      { id: 'formats', imageStep: 3 },
    ],
  },
  {
    slug: 'api-connections',
    section: 'workspace',
    estimatedMinutes: 4,
    steps: [
      { id: 'open-settings', imageStep: 1 },
      { id: 'credentials', imageStep: 2 },
      { id: 'test-connection', imageStep: 3 },
      { id: 'sync-account', imageStep: 4 },
    ],
  },

  // —— Trades & performance ——
  {
    slug: 'trades',
    section: 'trades-pnl',
    estimatedMinutes: 4,
    steps: [
      { id: 'list', imageStep: 1 },
      { id: 'filters', imageStep: 2 },
      { id: 'detail', imageStep: 3 },
    ],
  },
  {
    slug: 'import-trades',
    section: 'trades-pnl',
    estimatedMinutes: 4,
    steps: [
      { id: 'open-import', imageStep: 1 },
      { id: 'format', imageStep: 2 },
    ],
  },
  {
    slug: 'dashboard-filters',
    section: 'trades-pnl',
    estimatedMinutes: 4,
    steps: [
      { id: 'overview', imageStep: 1 },
      { id: 'period-account', imageStep: 2 },
      { id: 'widgets', imageStep: 3 },
    ],
  },
  {
    slug: 'calendar',
    section: 'trades-pnl',
    estimatedMinutes: 3,
    steps: [
      { id: 'overview', imageStep: 1 },
      { id: 'day-detail', imageStep: 2 },
    ],
  },
  {
    slug: 'transactions-profitability',
    section: 'trades-pnl',
    estimatedMinutes: 5,
    steps: [
      { id: 'flow', imageStep: 1 },
      { id: 'transactions', imageStep: 2 },
      { id: 'profitability', imageStep: 3 },
      { id: 'link-credits', imageStep: 4 },
    ],
  },

  // —— Journal & revue ——
  {
    slug: 'daily-journal',
    section: 'journal',
    estimatedMinutes: 4,
    steps: [
      { id: 'open', imageStep: 1 },
      { id: 'filters', imageStep: 2 },
      { id: 'entry', imageStep: 3 },
    ],
  },
  {
    slug: 'journal-questions',
    section: 'journal',
    estimatedMinutes: 5,
    steps: [
      { id: 'flow', imageStep: 1 },
      { id: 'templates', imageStep: 2 },
      { id: 'questionnaires', imageStep: 3 },
      { id: 'answer-daily', imageStep: 4 },
    ],
  },

  // —— Stratégies & backtest ——
  {
    slug: 'position-strategies',
    section: 'strategies',
    estimatedMinutes: 5,
    steps: [
      { id: 'flow', imageStep: 1 },
      { id: 'list', imageStep: 2 },
      { id: 'edit-sections', imageStep: 3 },
      { id: 'versions', imageStep: 4 },
    ],
  },
  {
    slug: 'backtest-market-replay',
    section: 'strategies',
    estimatedMinutes: 6,
    steps: [
      { id: 'flow', imageStep: 1 },
      { id: 'backtest-journal', imageStep: 2 },
      { id: 'historical-data', imageStep: 3 },
      { id: 'market-replay', imageStep: 4 },
    ],
  },
];

export const TUTORIAL_BY_SLUG: Record<string, TutorialDef> = Object.fromEntries(
  TUTORIALS.map((t) => [t.slug, t])
);

export const P0_SLUG = 'getting-started';

export type TutorialProgressEntry = {
  status: TutorialStatus;
  /** Index 0-based de la dernière étape vue / sautée */
  stepIndex?: number;
  updatedAt?: string;
};

export type TutorialsProgress = Record<string, TutorialProgressEntry>;

export function getTutorialStatus(
  progress: TutorialsProgress | null | undefined,
  slug: string
): TutorialStatus {
  return progress?.[slug]?.status ?? 'not_started';
}

export function isP0Incomplete(progress: TutorialsProgress | null | undefined): boolean {
  const status = getTutorialStatus(progress, P0_SLUG);
  return status !== 'completed' && status !== 'skipped';
}

/** Locales pour lesquelles des captures dédiées sont générées (Playwright). */
export const TUTORIAL_SHOT_LOCALES = ['fr', 'en'] as const;

export function tutorialImagePath(locale: string, slug: string, stepNumber: number): string {
  const lang = (locale || 'fr').split('-')[0];
  return `/tutorials/${lang}/${slug}-step-${stepNumber}.png`;
}

/**
 * Chemins image à tenter dans l’ordre : locale UI, puis EN, puis FR.
 * Permet au viewer de suivre le changement de langue et de dégrader
 * proprement si une locale n’a pas encore de captures.
 */
export function tutorialImageCandidates(
  locale: string,
  slug: string,
  stepNumber: number
): string[] {
  const lang = (locale || 'fr').split('-')[0];
  const ordered = [lang, 'en', 'fr'].filter((value, index, all) => all.indexOf(value) === index);
  return ordered.map((code) => tutorialImagePath(code, slug, stepNumber));
}
