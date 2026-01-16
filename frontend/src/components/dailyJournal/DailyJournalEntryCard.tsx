import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { DailyJournalEntry } from '../../services/dailyJournal';

interface DailyJournalEntryCardProps {
  entry: DailyJournalEntry;
  formattedDate: string;
  onOpen: (entry: DailyJournalEntry) => void;
}

export const DailyJournalEntryCard: React.FC<DailyJournalEntryCardProps> = ({ entry, formattedDate, onOpen }) => {
  const { t } = useI18nTranslation();
  const hasContent = entry.content.trim().length > 0;

  return (
    <button
      type="button"
      onClick={() => onOpen(entry)}
      className="w-full text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formattedDate}</p>
          {entry.trading_account_name && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{entry.trading_account_name}</p>
          )}
        </div>
        <span className="text-xs text-gray-400">{entry.images?.length || 0} image(s)</span>
      </div>
      {hasContent ? (
        <div className="text-gray-700 dark:text-gray-300 line-clamp-3">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={{
              h1: ({ children }) => <h1 className="text-lg font-bold mt-1 mb-1">{children}</h1>,
              h2: ({ children }) => <h2 className="text-base font-semibold mt-1 mb-1">{children}</h2>,
              h3: ({ children }) => <h3 className="text-sm font-semibold mt-1 mb-1">{children}</h3>,
              ul: ({ children }) => <ul className="list-disc pl-4 my-1 space-y-0.5">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-4 my-1 space-y-0.5">{children}</ol>,
              li: ({ children }) => <li className="text-gray-700 dark:text-gray-300">{children}</li>,
              a: ({ href, children }) => {
                const normalizedHref = href && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)
                  ? `https://${href}`
                  : href;
                return (
                <a
                  href={normalizedHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 underline"
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  {children}
                </a>
                );
              },
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-gray-300 dark:border-gray-600 pl-3 italic text-gray-600 dark:text-gray-300 my-1">
                  {children}
                </blockquote>
              ),
            }}
          >
            {entry.content}
          </ReactMarkdown>
        </div>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('dailyJournal.previewEmpty', { defaultValue: 'Aucun contenu a previsualiser.' })}
        </p>
      )}
    </button>
  );
};
