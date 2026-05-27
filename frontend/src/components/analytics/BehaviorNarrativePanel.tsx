import React from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { BehaviorNarrativeContext, NarrativeSection, NarrativeTone } from '../../utils/behaviorNarrative';
import type { NarrativeHighlight } from '../../utils/behaviorNarrative/types';
import { maskValue } from '../../hooks/usePrivacySettings';
import { MultiCurrencyWarningBanner } from './MultiCurrencyWarningBanner';

interface BehaviorNarrativePanelProps {
  sections: NarrativeSection[];
  context: BehaviorNarrativeContext | null;
  isLoading?: boolean;
  error?: Error | null;
  hideMoney?: boolean;
  currencySymbol?: string;
  showMultiCurrencyWarning?: boolean;
  formatNumber: (value: number, digits?: number) => string;
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

const TONE_BADGE_CLASSES: Record<NarrativeTone, string> = {
  excellent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',
  positive: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
  mixed: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  challenging: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
};

const HIGHLIGHT_VALUE_CLASSES: Record<
  NonNullable<NarrativeHighlight['tone']>,
  string
> = {
  positive: 'text-emerald-700 dark:text-emerald-300',
  negative: 'text-red-700 dark:text-red-300',
  neutral: 'text-gray-900 dark:text-gray-100',
};

function sectionTone(section: NarrativeSection): NarrativeTone {
  return section.toneVariant ?? 'mixed';
}

function gridSpanClass(section: NarrativeSection): string {
  if (section.id === 'intro') return 'md:col-span-2';
  if (section.kind === 'alert') return 'md:col-span-2';
  return '';
}

function NarrativeSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true">
      <div className="h-28 rounded-lg bg-gray-100 dark:bg-gray-700/60" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="h-20 rounded-lg bg-gray-100 dark:bg-gray-700/60" />
        <div className="h-20 rounded-lg bg-gray-100 dark:bg-gray-700/60" />
        <div className="h-20 rounded-lg bg-gray-100 dark:bg-gray-700/60" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="h-36 rounded-lg bg-gray-100 dark:bg-gray-700/60" />
        <div className="h-36 rounded-lg bg-gray-100 dark:bg-gray-700/60" />
      </div>
    </div>
  );
}

function KpiStrip({
  context,
  hideMoney,
  currencySymbol,
  formatNumber,
}: {
  context: BehaviorNarrativeContext;
  hideMoney: boolean;
  currencySymbol: string;
  formatNumber: (value: number, digits?: number) => string;
}) {
  const { t } = useTranslation('analytics');

  const items = [
    {
      key: 'winRate',
      label: t('behaviorNarrative.ui.kpiWinRate'),
      value: `${formatNumber(context.winRate, 1)}%`,
      alwaysShow: true,
    },
    {
      key: 'pf',
      label: t('behaviorNarrative.ui.kpiProfitFactor'),
      value:
        context.profitFactor != null ? formatNumber(context.profitFactor, 2) : '—',
      alwaysShow: false,
    },
    {
      key: 'sharpe',
      label: t('behaviorNarrative.ui.kpiSharpe'),
      value:
        context.sharpeAnnualized != null
          ? formatNumber(context.sharpeAnnualized, 2)
          : '—',
      alwaysShow: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.key}
          className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-600 dark:bg-gray-800/90"
        >
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{item.label}</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {hideMoney && !item.alwaysShow
              ? maskValue(null, currencySymbol)
              : item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function HighlightGrid({ highlights }: { highlights: NarrativeHighlight[] }) {
  const { t } = useTranslation('analytics');

  return (
    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {highlights.map((h, idx) => (
        <div
          key={`${h.labelKey}-${idx}`}
          className="rounded-md border border-gray-200/80 bg-white/60 px-3 py-2 dark:border-gray-600/80 dark:bg-gray-900/30"
        >
          <p className="text-xs text-gray-500 dark:text-gray-400">{t(h.labelKey)}</p>
          <p
            className={clsx(
              'text-lg font-bold tabular-nums',
              HIGHLIGHT_VALUE_CLASSES[h.tone ?? 'neutral'],
            )}
          >
            {h.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function SectionCard({ section }: { section: NarrativeSection }) {
  const { t } = useTranslation('analytics');
  const tone = sectionTone(section);
  const isIntro = section.id === 'intro';
  const isAlert = section.kind === 'alert';

  return (
    <section
      id={`section-${section.id}`}
      aria-labelledby={`heading-${section.id}`}
      className={clsx(
        'rounded-lg border p-4 sm:p-5 shadow-sm',
        gridSpanClass(section),
        isIntro ? TONE_INTRO_CLASSES[tone] : TONE_SECTION_CLASSES[tone],
        isAlert && 'border-l-4 border-l-red-600 dark:border-l-red-500',
      )}
    >
      {section.titleKey ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {!isIntro ? (
            <div
              className="h-6 w-1 shrink-0 rounded-full bg-gradient-to-b from-blue-500 to-blue-600"
              aria-hidden
            />
          ) : null}
          <h2
            id={`heading-${section.id}`}
            className={clsx(
              'font-semibold text-gray-900 dark:text-gray-100',
              isIntro ? 'text-lg sm:text-xl' : 'text-base',
            )}
          >
            {t(section.titleKey)}
          </h2>
        </div>
      ) : null}

      {section.highlights && section.highlights.length > 0 ? (
        <HighlightGrid highlights={section.highlights} />
      ) : null}

      <div className={clsx(section.highlights?.length ? 'mt-4' : '', 'space-y-3')}>
        {section.paragraphs.length > 1 ? (
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {section.paragraphs.map((paragraph, pIndex) => (
              <li key={pIndex}>{paragraph}</li>
            ))}
          </ul>
        ) : (
          section.paragraphs.map((paragraph, pIndex) => (
            <p
              key={pIndex}
              className={clsx(
                'leading-relaxed text-gray-700 dark:text-gray-300',
                isIntro && pIndex === 0 ? 'text-base sm:text-lg' : 'text-sm',
              )}
            >
              {paragraph}
            </p>
          ))
        )}
      </div>
    </section>
  );
}

export const BehaviorNarrativePanel: React.FC<BehaviorNarrativePanelProps> = ({
  sections,
  context,
  isLoading = false,
  error = null,
  hideMoney = false,
  currencySymbol = '',
  showMultiCurrencyWarning = false,
  formatNumber,
}) => {
  const { t } = useTranslation('analytics');

  if (isLoading) {
    return <NarrativeSkeleton />;
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

  const introSection = sections.find((s) => s.id === 'intro');
  const bodySections = sections.filter((s) => s.id !== 'intro');
  const tone = context?.tone ?? introSection?.toneVariant ?? 'mixed';

  return (
    <article className="space-y-4 sm:space-y-6">
      <MultiCurrencyWarningBanner show={showMultiCurrencyWarning} />

      {introSection ? (
        <div className="space-y-4">
          <div
            className={clsx(
              'rounded-lg border p-4 sm:p-6 shadow-sm',
              TONE_INTRO_CLASSES[tone],
            )}
          >
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span
                className={clsx(
                  'inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide',
                  TONE_BADGE_CLASSES[tone],
                )}
              >
                {t(`behaviorNarrative.ui.toneBadge.${tone}`)}
              </span>
              {introSection.titleKey ? (
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 sm:text-xl">
                  {t(introSection.titleKey)}
                </h2>
              ) : null}
            </div>
            {introSection.paragraphs.map((paragraph, pIndex) => (
              <p
                key={pIndex}
                className={clsx(
                  'leading-relaxed text-gray-700 dark:text-gray-300',
                  pIndex === 0 ? 'text-base sm:text-lg' : 'mt-2 text-sm',
                )}
              >
                {paragraph}
              </p>
            ))}
          </div>
          {context ? (
            <KpiStrip
              context={context}
              hideMoney={hideMoney}
              currencySymbol={currencySymbol}
              formatNumber={formatNumber}
            />
          ) : null}
        </div>
      ) : null}

      {bodySections.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {bodySections.map((section, index) => (
            <SectionCard key={`${section.id}-${index}`} section={section} />
          ))}
        </div>
      ) : null}
    </article>
  );
};
