/**
 * Catalogue des tutoriels in-app (source de vérité des slugs / steps).
 * Les textes i18n vivent sous le namespace `help`.
 */

export type TutorialSection = 'getting-started' | 'go-further';

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
  {
    slug: 'import-trades',
    section: 'go-further',
    estimatedMinutes: 4,
    stub: true,
    steps: [
      { id: 'open-import', imageStep: 1 },
      { id: 'format', imageStep: 2 },
    ],
  },
  {
    slug: 'calendar',
    section: 'go-further',
    estimatedMinutes: 3,
    stub: true,
    steps: [
      { id: 'overview', imageStep: 1 },
      { id: 'day-detail', imageStep: 2 },
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
