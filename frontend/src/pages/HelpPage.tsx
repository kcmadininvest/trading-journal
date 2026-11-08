import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePreferences } from '../hooks/usePreferences';
import userService, { UserPreferences } from '../services/userService';
import { PageShell } from '../components/layout';
import TutorialViewer from '../components/help/TutorialViewer';
import {
  TUTORIALS,
  TUTORIAL_BY_SLUG,
  TutorialProgressEntry,
  TutorialsProgress,
  getTutorialStatus,
  TutorialDef,
} from '../tutorials/catalog';

export interface HelpPageProps {
  /** Slug issu du hash `#help/<slug>` */
  initialSlug?: string | null;
  onNavigateHash?: (hash: string) => void;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
    case 'in_progress':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
    case 'skipped':
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
    default:
      return 'bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200';
  }
}

const HelpPage: React.FC<HelpPageProps> = ({ initialSlug = null, onNavigateHash }) => {
  const { t } = useTranslation(['help', 'common']);
  const { preferences, mergePreferences } = usePreferences();
  const progress = (preferences.tutorials_progress || {}) as TutorialsProgress;
  const [filter, setFilter] = useState('');
  const [activeSlug, setActiveSlug] = useState<string | null>(initialSlug);

  React.useEffect(() => {
    setActiveSlug(initialSlug || null);
  }, [initialSlug]);

  const persistProgress = async (slug: string, entry: TutorialProgressEntry) => {
    const next: TutorialsProgress = {
      ...progress,
      [slug]: entry,
    };
    mergePreferences({ tutorials_progress: next } as Partial<UserPreferences>);
    try {
      await userService.updatePreferences({ tutorials_progress: next });
    } catch {
      // silencieux : merge local déjà appliqué
    }
  };

  const openTutorial = (slug: string) => {
    setActiveSlug(slug);
    onNavigateHash?.(`help/${slug}`);
  };

  const closeTutorial = () => {
    setActiveSlug(null);
    onNavigateHash?.('help');
  };

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return TUTORIALS;
    return TUTORIALS.filter((tut) => {
      const title = t(`help:tutorials.${tut.slug}.title`, { defaultValue: tut.slug }).toLowerCase();
      const summary = t(`help:tutorials.${tut.slug}.summary`, { defaultValue: '' }).toLowerCase();
      return title.includes(q) || summary.includes(q) || tut.slug.includes(q);
    });
  }, [filter, t]);

  const starters = filtered.filter((x) => x.section === 'getting-started');
  const further = filtered.filter((x) => x.section === 'go-further');
  const activeTutorial: TutorialDef | null = activeSlug ? TUTORIAL_BY_SLUG[activeSlug] || null : null;

  const renderCard = (tut: TutorialDef) => {
    const status = getTutorialStatus(progress, tut.slug);
    return (
      <li key={tut.slug} className="min-w-0 h-full">
        <button
          type="button"
          onClick={() => openTutorial(tut.slug)}
          className="flex h-full w-full flex-col text-left rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-500"
          data-testid={`help-card-${tut.slug}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {t(`help:tutorials.${tut.slug}.title`)}
              </h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {t(`help:tutorials.${tut.slug}.summary`)}
              </p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                {t('help:hub.estimatedMinutes', { count: tut.estimatedMinutes })}
                {tut.stub ? ` · ${t('help:hub.stub')}` : ''}
              </p>
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusBadgeClass(status)}`}>
              {t(`help:status.${status}`)}
            </span>
          </div>
        </button>
      </li>
    );
  };

  return (
    <PageShell>
      <div data-testid="help-page" className="max-w-full">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('help:hub.title')}</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">{t('help:hub.subtitle')}</p>
        </header>

        {activeTutorial ? (
          <section
            aria-label={t(`help:tutorials.${activeTutorial.slug}.title`)}
            className="mb-8 overflow-hidden rounded-lg border border-gray-200 bg-white p-4 shadow dark:border-gray-700 dark:bg-gray-800 sm:p-6"
          >
            <button
              type="button"
              onClick={closeTutorial}
              className="mb-4 inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:focus:ring-offset-gray-800"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              {t('help:hub.backToLibrary')}
            </button>
            <TutorialViewer
              tutorial={activeTutorial}
              progressEntry={progress[activeTutorial.slug]}
              onProgressChange={(entry) => void persistProgress(activeTutorial.slug, entry)}
              onClose={closeTutorial}
            />
          </section>
        ) : (
          <>
            {TUTORIALS.length > 8 && (
              <div className="mb-4">
                <label htmlFor="help-filter" className="sr-only">
                  {t('help:hub.search')}
                </label>
                <input
                  id="help-filter"
                  type="search"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder={t('help:hub.search')}
                  className="w-full max-w-md rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <section className="mb-8" aria-labelledby="help-section-start">
              <h2 id="help-section-start" className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                {t('help:hub.sectionStart')}
              </h2>
              <ul className="space-y-3">{starters.map(renderCard)}</ul>
            </section>

            <section aria-labelledby="help-section-further">
              <h2 id="help-section-further" className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                {t('help:hub.sectionFurther')}
              </h2>
              {/* Grille 1×2 (1 col mobile, 2 cols dès sm) — 3 tutos go-further. */}
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                {further.map(renderCard)}
              </ul>
              {further.length === 0 && filtered.length === 0 && (
                <p className="text-sm text-gray-500">{t('help:hub.noResults')}</p>
              )}
            </section>
          </>
        )}
      </div>
    </PageShell>
  );
};

export default HelpPage;
