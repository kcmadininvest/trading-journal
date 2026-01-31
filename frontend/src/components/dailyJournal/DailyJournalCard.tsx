import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { DailyJournalGroupedEntry } from '../../services/dailyJournal';

interface DailyJournalCardProps {
  entry: DailyJournalGroupedEntry;
  formatDate: (date: string) => string;
  onOpenEntry: (id: number) => void;
  onHover: (entry: DailyJournalGroupedEntry) => void;
  onLeave: () => void;
  viewMode: 'grid' | 'list';
  markdownComponents: Components;
  emptyText: string;
}

export const DailyJournalCard: React.FC<DailyJournalCardProps> = ({
  entry,
  formatDate,
  onOpenEntry,
  onHover,
  onLeave,
  viewMode,
  markdownComponents,
  emptyText,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [lineClamp, setLineClamp] = useState(4);

  useEffect(() => {
    if (viewMode !== 'grid' || !contentRef.current) {
      return;
    }

    const calculateLineClamp = () => {
      const container = contentRef.current;
      if (!container) return;

      // Obtenir la hauteur disponible pour le contenu
      const availableHeight = container.clientHeight;
      
      // Calculer la hauteur d'une ligne (line-height * font-size)
      const computedStyle = window.getComputedStyle(container);
      const lineHeight = parseFloat(computedStyle.lineHeight);
      
      // Calculer le nombre maximum de lignes
      const maxLines = Math.floor(availableHeight / lineHeight);
      
      // Minimum 3 lignes, maximum 10 lignes
      setLineClamp(Math.max(3, Math.min(10, maxLines)));
    };

    // Calculer au montage
    calculateLineClamp();

    // Recalculer si la taille change
    const resizeObserver = new ResizeObserver(calculateLineClamp);
    resizeObserver.observe(contentRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [viewMode]);

  return (
    <div
      className="relative"
      onMouseEnter={() => onHover(entry)}
      onMouseLeave={onLeave}
    >
      <button
        type="button"
        onClick={() => onOpenEntry(entry.id)}
        className={`w-full text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all ${
          viewMode === 'grid' ? 'h-40 flex flex-col p-3' : 'p-4 hover:shadow-md'
        }`}
      >
        <div className={`flex items-center justify-between flex-shrink-0 ${viewMode === 'grid' ? 'mb-1.5' : 'mb-2'}`}>
          <div className="flex-1 min-w-0">
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
          <div className="flex-1 overflow-hidden relative">
            <div 
              ref={contentRef}
              className={`text-sm text-gray-700 dark:text-gray-300 ${viewMode === 'list' ? 'line-clamp-3' : ''}`}
              style={viewMode === 'grid' ? {
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: lineClamp,
                overflow: 'hidden'
              } : undefined}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={markdownComponents}
              >
                {entry.content_preview}
              </ReactMarkdown>
            </div>
            {/* Indicateur visuel ... pour le texte tronqué */}
            <div className="absolute bottom-0 right-0 bg-gradient-to-l from-gray-50 dark:from-gray-900 via-gray-50 dark:via-gray-900 to-transparent pl-8 pr-1">
              <span className="text-sm text-gray-500 dark:text-gray-400">...</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {emptyText}
          </p>
        )}
      </button>
    </div>
  );
};
