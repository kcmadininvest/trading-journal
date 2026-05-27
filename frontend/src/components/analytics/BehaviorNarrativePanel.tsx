import React from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { NarrativeSection, NarrativeTone } from '../../utils/behaviorNarrative';

interface BehaviorNarrativePanelProps {
  sections: NarrativeSection[];
  isLoading?: boolean;
  error?: Error | null;
}

const TONE_SECTION_CLASSES: Record<NarrativeTone, string> = {
  excellent:
    'border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-900/25',
  positive:
    'border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/20',
  mixed:
    'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/80',
  challenging:
    'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/15',
};

const TONE_INTRO_CLASSES: Record<NarrativeTone, string> = {
  excellent:
    'border-blue-300 dark:border-blue-700 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/40 dark:to-gray-800/90',
  positive:
    'border-emerald-300 dark:border-emerald-800 bg-gradient-to-br from-emerald-50/80 to-white dark:from-emerald-950/30 dark:to-gray-800/90',
  mixed:
    'border-gray-200 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-800/90',
  challenging:
    'border-amber-300 dark:border-amber-700 bg-gradient-to-br from-amber-50/80 to-white dark:from-amber-950/30 dark:to-gray-800/90',
};

function sectionTone(section: NarrativeSection): NarrativeTone {
  return section.toneVariant ?? 'mixed';
}

export const BehaviorNarrativePanel: React.FC<BehaviorNarrativePanelProps> = ({
  sections,
  isLoading = false,
  error = null,
}) => {
  const { t } = useTranslation('analytics');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
        <p className="text-sm text-red-800 dark:text-red-300">{error.message}</p>
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {t('behaviorNarrative.insufficientData.partial')}
      </p>
    );
  }

  return (
    <article className="space-y-6">
      {sections.map((section, index) => {
        const tone = sectionTone(section);
        const isIntro = section.id === 'intro';

        return (
          <section
            key={`${section.id}-${index}`}
            className={clsx(
              'rounded-lg border p-4 sm:p-6 shadow-sm',
              isIntro ? TONE_INTRO_CLASSES[tone] : TONE_SECTION_CLASSES[tone],
            )}
          >
            {section.titleKey ? (
              <h2
                className={clsx(
                  'font-semibold text-gray-900 dark:text-gray-100 mb-3',
                  isIntro ? 'text-lg sm:text-xl' : 'text-base',
                )}
              >
                {t(section.titleKey)}
              </h2>
            ) : null}
            <div className="space-y-3">
              {section.paragraphs.map((paragraph, pIndex) => (
                <p
                  key={pIndex}
                  className={clsx(
                    'leading-relaxed text-gray-700 dark:text-gray-300',
                    isIntro && pIndex === 0 ? 'text-base sm:text-lg' : 'text-sm',
                  )}
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        );
      })}
    </article>
  );
};
