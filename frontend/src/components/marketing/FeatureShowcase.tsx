import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import type { MarketingFeature } from './marketingFeatures';

type FeatureShowcaseProps = {
  title: string;
  features: MarketingFeature[];
  accent?: 'core' | 'advanced';
  autoPlayMs?: number;
};

const FeatureShowcase: React.FC<FeatureShowcaseProps> = ({
  title,
  features,
  accent = 'core',
  autoPlayMs = 5500,
}) => {
  const { t } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const count = features.length;
  const active = features[activeIndex] ?? features[0];

  const goTo = useCallback(
    (index: number) => {
      const next = ((index % count) + count) % count;
      setActiveIndex(next);
      setAnimKey((k) => k + 1);
    },
    [count],
  );

  const goPrev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);
  const goNext = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);

  useEffect(() => {
    if (paused || reduceMotion || count < 2) return undefined;
    const id = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % count);
      setAnimKey((k) => k + 1);
    }, autoPlayMs);
    return () => window.clearInterval(id);
  }, [paused, reduceMotion, count, autoPlayMs]);

  if (!active) return null;

  const stageRing =
    accent === 'advanced'
      ? 'ring-1 ring-indigo-200/80 border-indigo-100'
      : 'ring-1 ring-blue-200/70 border-blue-100';

  return (
    <section
      className="mb-16 outline-none"
      aria-roledescription="carousel"
      aria-label={title}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          goPrev();
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          goNext();
        }
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setPaused(false);
        }
      }}
    >
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">{title}</h2>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:border-blue-400 hover:text-blue-600"
            aria-label={paused ? t('home:features.carousel.play') : t('home:features.carousel.pause')}
            title={paused ? t('home:features.carousel.play') : t('home:features.carousel.pause')}
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={goPrev}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:border-blue-400 hover:text-blue-600"
            aria-label={t('common:previous')}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={goNext}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:border-blue-400 hover:text-blue-600"
            aria-label={t('common:next')}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className={`relative rounded-3xl border bg-white shadow-xl ${stageRing}`}>
        <div
          className={`pointer-events-none absolute inset-0 overflow-hidden rounded-3xl bg-gradient-to-br opacity-[0.07] ${active.color}`}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gradient-to-br from-blue-400/20 to-indigo-500/10 blur-3xl"
          aria-hidden
        />

        <div className="relative grid lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.9fr)]">
          {/* Panneau détail */}
          <div className="min-w-0 rounded-t-3xl lg:rounded-l-3xl lg:rounded-tr-none">
            <div
              key={animKey}
              className="box-border flex min-h-[260px] flex-col justify-center p-6 sm:p-8 md:min-h-[300px] md:p-10 animate-feature-in"
              aria-live="polite"
            >
              <div
                className={`mb-6 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg md:h-20 md:w-20 ${active.color}`}
              >
                <svg className="h-9 w-9 text-white md:h-10 md:w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={active.path} />
                </svg>
              </div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-indigo-600">
                {activeIndex + 1} / {count}
              </p>
              <h3 className="mb-4 break-words text-2xl font-bold leading-tight text-gray-900 sm:text-3xl md:text-4xl">
                {t(`home:features.${active.key}.title`)}
              </h3>
              <p className="max-w-xl break-words text-base leading-relaxed text-gray-600 sm:text-lg">
                {t(`home:features.${active.key}.description`)}
              </p>

              {!reduceMotion && !paused && (
                <div className="mt-8 h-1 w-full max-w-xs overflow-hidden rounded-full bg-gray-100" aria-hidden>
                  <div
                    key={`progress-${animKey}`}
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 animate-feature-progress"
                    style={{ animationDuration: `${autoPlayMs}ms` }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Sélecteur : grille de pastilles, sans scrollbar */}
          <div className="min-w-0 border-t border-gray-100 bg-gradient-to-b from-slate-50/90 to-white p-4 md:p-5 lg:rounded-r-3xl lg:border-l lg:border-t-0">
            <div
              className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2"
              role="tablist"
              aria-label={title}
            >
              {features.map((feature, index) => {
                const isActive = index === activeIndex;
                return (
                  <button
                    key={feature.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => goTo(index)}
                    className={`flex min-h-[4.5rem] flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all duration-200 ${
                      isActive
                        ? 'border-blue-300 bg-white shadow-md ring-1 ring-blue-100'
                        : 'border-gray-100 bg-white/70 hover:border-gray-200 hover:bg-white hover:shadow-sm'
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br shadow-sm ${feature.color}`}
                    >
                      <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.path} />
                      </svg>
                    </span>
                    <span
                      className={`line-clamp-2 text-xs font-semibold leading-snug sm:text-sm ${
                        isActive ? 'text-gray-900' : 'text-gray-600'
                      }`}
                    >
                      {t(`home:features.${feature.key}.title`)}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Indicateurs points */}
            <div className="mt-4 flex items-center justify-center gap-1.5" aria-hidden>
              {features.map((feature, index) => (
                <button
                  key={`dot-${feature.key}`}
                  type="button"
                  onClick={() => goTo(index)}
                  className={`h-2 rounded-full transition-all duration-200 ${
                    index === activeIndex ? 'w-6 bg-blue-600' : 'w-2 bg-gray-300 hover:bg-gray-400'
                  }`}
                  aria-label={t(`home:features.${feature.key}.title`)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <ul className="sr-only">
        {features.map((feature) => (
          <li key={`seo-${feature.key}`}>
            <strong>{t(`home:features.${feature.key}.title`)}</strong>
            {' — '}
            {t(`home:features.${feature.key}.description`)}
          </li>
        ))}
      </ul>
    </section>
  );
};

export default FeatureShowcase;
