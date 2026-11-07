import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TutorialDef,
  TutorialProgressEntry,
  TutorialStatus,
  tutorialImageCandidates,
} from '../../tutorials/catalog';

export interface TutorialViewerProps {
  tutorial: TutorialDef;
  /** Progression actuelle pour ce tuto (optionnel) */
  progressEntry?: TutorialProgressEntry | null;
  onProgressChange: (entry: TutorialProgressEntry) => void;
  onClose: () => void;
  /** Affiche les contrôles « passer étape / passer tuto » */
  allowSkip?: boolean;
}

const TutorialViewer: React.FC<TutorialViewerProps> = ({
  tutorial,
  progressEntry,
  onProgressChange,
  onClose,
  allowSkip = true,
}) => {
  const { t, i18n } = useTranslation('help');
  const initialIndex = Math.min(
    Math.max(progressEntry?.stepIndex ?? 0, 0),
    Math.max(tutorial.steps.length - 1, 0)
  );
  const [stepIndex, setStepIndex] = useState(initialIndex);
  const [imgFailed, setImgFailed] = useState(false);
  const [imgCandidateIndex, setImgCandidateIndex] = useState(0);

  const locale = i18n.language?.split('-')[0] || 'fr';

  useEffect(() => {
    setStepIndex(initialIndex);
  }, [tutorial.slug, initialIndex]);

  // Recalcule les captures dès que la langue UI ou l’étape change
  useEffect(() => {
    setImgFailed(false);
    setImgCandidateIndex(0);
  }, [stepIndex, tutorial.slug, locale]);

  const total = tutorial.steps.length;
  const step = tutorial.steps[stepIndex];
  const isLast = stepIndex >= total - 1;
  const imageCandidates = step
    ? tutorialImageCandidates(locale, tutorial.slug, step.imageStep)
    : [];
  const imageSrc = imageCandidates[imgCandidateIndex] || '';

  const markSeen = (nextIndex: number, status: TutorialStatus) => {
    onProgressChange({
      status,
      stepIndex: nextIndex,
      updatedAt: new Date().toISOString(),
    });
  };

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(next, total - 1));
    setStepIndex(clamped);
    const status: TutorialStatus =
      clamped >= total - 1 && progressEntry?.status === 'completed'
        ? 'completed'
        : 'in_progress';
    markSeen(clamped, status);
  };

  const handleNext = () => {
    if (isLast) {
      markSeen(stepIndex, 'completed');
      onClose();
      return;
    }
    goTo(stepIndex + 1);
  };

  const handlePrev = () => {
    if (stepIndex > 0) goTo(stepIndex - 1);
  };

  const handleSkipStep = () => {
    if (isLast) {
      markSeen(stepIndex, 'completed');
      onClose();
      return;
    }
    goTo(stepIndex + 1);
  };

  const handleSkipTutorial = () => {
    markSeen(stepIndex, 'skipped');
    onClose();
  };

  const handleImageError = () => {
    if (imgCandidateIndex + 1 < imageCandidates.length) {
      setImgCandidateIndex((index) => index + 1);
      return;
    }
    setImgFailed(true);
  };

  if (!step) {
    return null;
  }

  const titleKey = `tutorials.${tutorial.slug}.steps.${step.id}.title`;
  const bodyKey = `tutorials.${tutorial.slug}.steps.${step.id}.body`;
  const altKey = `tutorials.${tutorial.slug}.steps.${step.id}.alt`;

  return (
    <article className="flex flex-col gap-4" data-testid={`tutorial-viewer-${tutorial.slug}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-500 dark:text-gray-400" aria-live="polite">
          {t('viewer.stepOf', { current: stepIndex + 1, total })}
        </p>
        {allowSkip && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSkipStep}
              className="text-sm text-gray-600 dark:text-gray-300 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
            >
              {t('viewer.skipStep')}
            </button>
            <button
              type="button"
              onClick={handleSkipTutorial}
              className="text-sm text-gray-600 dark:text-gray-300 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
            >
              {t('viewer.skipTutorial')}
            </button>
          </div>
        )}
      </div>

      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
        {t(titleKey)}
      </h2>

      <div className="grid gap-4 lg:grid-cols-5 lg:items-start">
        <div className="lg:col-span-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 overflow-hidden min-h-[240px] flex items-center justify-center">
          {imgFailed || !imageSrc ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 p-6 text-center">
              {t('viewer.imagePlaceholder')}
            </p>
          ) : (
            <img
              key={imageSrc}
              src={imageSrc}
              alt={t(altKey)}
              className="w-full h-auto object-contain max-h-[min(70vh,560px)]"
              onError={handleImageError}
            />
          )}
        </div>
        <div className="lg:col-span-2 prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 whitespace-pre-line">
          {t(bodyKey)}
        </div>
      </div>

      <div className="flex flex-wrap justify-between gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
        <button
          type="button"
          onClick={handlePrev}
          disabled={stepIndex === 0}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {t('viewer.previous')}
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {isLast ? t('viewer.finish') : t('viewer.next')}
        </button>
      </div>
    </article>
  );
};

export default TutorialViewer;
