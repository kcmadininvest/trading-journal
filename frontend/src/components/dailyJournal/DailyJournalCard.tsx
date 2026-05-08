import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown, { Components } from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { DailyJournalGroupedEntry, dailyJournalService } from '../../services/dailyJournal';

interface DailyJournalCardProps {
  entry: DailyJournalGroupedEntry;
  formatDate: (date: string) => string;
  onOpenEntry: (id: number) => void;
  viewMode: 'grid' | 'list';
  markdownComponents: Components;
  emptyText: string;
}

const PREVIEW_PANEL_WIDTH = 640;
const VIEWPORT_MARGIN = 12;

type PopoverLayout = { top: number; left: number; width: number; maxHeight: number };

function computePopoverLayout(anchor: DOMRect): PopoverLayout {
  const margin = VIEWPORT_MARGIN;
  const width = Math.min(PREVIEW_PANEL_WIDTH, window.innerWidth - 2 * margin);
  let left = anchor.left + anchor.width / 2 - width / 2;
  left = Math.min(Math.max(left, margin), window.innerWidth - width - margin);

  const preferredTop = anchor.bottom + 8;
  const availableBelow = window.innerHeight - preferredTop - margin;
  const availableAbove = anchor.top - 2 * margin;

  let top = preferredTop;
  let maxHeight = Math.min(520, Math.max(160, availableBelow));

  if (availableBelow < 180 && availableAbove > availableBelow) {
    maxHeight = Math.min(520, Math.max(160, availableAbove));
    top = Math.max(margin, anchor.top - maxHeight - margin);
  }

  maxHeight = Math.max(120, Math.min(maxHeight, window.innerHeight - top - margin));
  return { top, left, width, maxHeight };
}

export const DailyJournalCard: React.FC<DailyJournalCardProps> = ({
  entry,
  formatDate,
  onOpenEntry,
  viewMode,
  markdownComponents,
  emptyText,
}) => {
  const { t } = useI18nTranslation();
  const contentRef = useRef<HTMLDivElement>(null);
  const eyeButtonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [lineClamp, setLineClamp] = useState(4);

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewLoadError, setPreviewLoadError] = useState(false);
  const [fullPreviewLoaded, setFullPreviewLoaded] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [popoverLayout, setPopoverLayout] = useState<PopoverLayout | null>(null);

  const previewPanelId = `journal-card-preview-${entry.id}`;

  const updatePopoverLayout = useCallback(() => {
    if (!isPreviewOpen || !eyeButtonRef.current) return;
    setPopoverLayout(computePopoverLayout(eyeButtonRef.current.getBoundingClientRect()));
  }, [isPreviewOpen]);

  useLayoutEffect(() => {
    updatePopoverLayout();
  }, [isPreviewOpen, updatePopoverLayout, previewContent, isPreviewLoading]);

  useEffect(() => {
    if (!isPreviewOpen) return;
    const onResizeScroll = () => updatePopoverLayout();
    window.addEventListener('resize', onResizeScroll);
    window.addEventListener('scroll', onResizeScroll, true);
    return () => {
      window.removeEventListener('resize', onResizeScroll);
      window.removeEventListener('scroll', onResizeScroll, true);
    };
  }, [isPreviewOpen, updatePopoverLayout]);

  useEffect(() => {
    if (!isPreviewOpen) return;
    const onDocMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (eyeButtonRef.current?.contains(target)) return;
      setIsPreviewOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsPreviewOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isPreviewOpen]);

  useEffect(() => {
    setPreviewContent(null);
    setPreviewLoadError(false);
    setFullPreviewLoaded(false);
    setIsPreviewOpen(false);
  }, [entry.id]);

  useEffect(() => {
    if (viewMode !== 'grid' || !contentRef.current) {
      return;
    }

    const calculateLineClamp = () => {
      const container = contentRef.current;
      if (!container) return;

      const availableHeight = container.clientHeight;
      const computedStyle = window.getComputedStyle(container);
      const lineHeight = parseFloat(computedStyle.lineHeight);
      const maxLines = Math.floor(availableHeight / lineHeight);
      setLineClamp(Math.max(3, Math.min(10, maxLines)));
    };

    calculateLineClamp();
    const resizeObserver = new ResizeObserver(calculateLineClamp);
    resizeObserver.observe(contentRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [viewMode]);

  const togglePreview = async () => {
    if (isPreviewOpen) {
      setIsPreviewOpen(false);
      return;
    }
    setIsPreviewOpen(true);
    setPreviewLoadError(false);
    if (fullPreviewLoaded) return;

    setIsPreviewLoading(true);
    try {
      const full = await dailyJournalService.getEntry(entry.id);
      setPreviewContent(full.content || '');
      setFullPreviewLoaded(true);
      setPreviewLoadError(false);
    } catch {
      setPreviewLoadError(true);
      setPreviewContent(entry.content_preview || '');
      setFullPreviewLoaded(false);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const cardShellClass = `rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all flex overflow-hidden ${
    viewMode === 'grid' ? 'h-40' : ''
  }`;

  const popoverNode =
    isPreviewOpen &&
    popoverLayout &&
    createPortal(
      <div
        ref={popoverRef}
        id={previewPanelId}
        role="dialog"
        aria-label={t('dailyJournal.cardPreviewTitle', { defaultValue: 'Aperçu du journal' })}
        className="fixed z-[60] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl flex flex-col"
        style={{
          top: popoverLayout.top,
          left: popoverLayout.left,
          width: popoverLayout.width,
          maxHeight: popoverLayout.maxHeight,
        }}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate">
            {t('dailyJournal.cardPreviewTitle', { defaultValue: 'Aperçu' })}
          </span>
          <button
            type="button"
            onClick={() => setIsPreviewOpen(false)}
            className="text-xs text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 px-2 py-1 rounded-md border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
          >
            {t('dailyJournal.cardPreviewClose', { defaultValue: 'Fermer' })}
          </button>
        </div>
        <div className="p-3 overflow-y-auto min-h-0 text-sm text-gray-700 dark:text-gray-300">
          {isPreviewLoading ? (
            <p className="text-gray-500 dark:text-gray-400">{t('dailyJournal.cardPreviewLoading', { defaultValue: 'Chargement…' })}</p>
          ) : previewLoadError && !previewContent?.trim() ? (
            <p className="text-gray-500 dark:text-gray-400">{t('dailyJournal.cardPreviewLoadError', { defaultValue: "Impossible de charger l'aperçu." })}</p>
          ) : previewContent?.trim() ? (
            <>
              {previewLoadError && (
                <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                  {t('dailyJournal.cardPreviewFallback', { defaultValue: 'Aperçu partiel (extrait).' })}
                </p>
              )}
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={markdownComponents}>
                {previewContent}
              </ReactMarkdown>
            </>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">{emptyText}</p>
          )}
        </div>
      </div>,
      document.body
    );

  return (
    <div className="relative">
      <div className={cardShellClass}>
        <button
          type="button"
          onClick={() => onOpenEntry(entry.id)}
          className={`flex-1 min-w-0 text-left flex flex-col ${
            viewMode === 'grid' ? 'p-3 min-h-0' : 'p-4 hover:shadow-md'
          }`}
        >
          <div className={`flex items-center justify-between flex-shrink-0 ${viewMode === 'grid' ? 'mb-1.5' : 'mb-2'}`}>
            <div className="flex-1 min-w-0 pr-1">
              <p className={`font-semibold text-gray-900 dark:text-gray-100 truncate ${viewMode === 'grid' ? 'text-xs' : 'text-sm'}`}>
                {formatDate(entry.date)}
              </p>
              {entry.trading_account_name && (
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {entry.trading_account_name}
                </p>
              )}
            </div>
            {entry.images_count > 0 && (
              <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 ml-2 flex-shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{entry.images_count}</span>
              </div>
            )}
          </div>
          {entry.content_preview ? (
            <div className="flex-1 overflow-hidden relative min-h-0">
              <div
                ref={contentRef}
                className={`text-sm text-gray-700 dark:text-gray-300 ${viewMode === 'list' ? 'line-clamp-3' : ''}`}
                style={
                  viewMode === 'grid'
                    ? {
                        display: '-webkit-box',
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: lineClamp,
                        overflow: 'hidden',
                      }
                    : undefined
                }
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={markdownComponents}>
                  {entry.content_preview}
                </ReactMarkdown>
              </div>
              <div className="absolute bottom-0 right-0 bg-gradient-to-l from-gray-50 dark:from-gray-900 via-gray-50 dark:via-gray-900 to-transparent pl-8 pr-1">
                <span className="text-sm text-gray-500 dark:text-gray-400">...</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">{emptyText}</p>
          )}
        </button>
        <div
          className={`flex flex-col items-center justify-center shrink-0 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 ${
            viewMode === 'grid' ? 'w-10' : 'w-11'
          }`}
        >
          <button
            ref={eyeButtonRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void togglePreview();
            }}
            aria-expanded={isPreviewOpen}
            aria-controls={previewPanelId}
            aria-label={t('dailyJournal.cardPreviewToggle', { defaultValue: 'Afficher ou masquer l’aperçu du journal' })}
            className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
        </div>
      </div>
      {popoverNode}
    </div>
  );
};
