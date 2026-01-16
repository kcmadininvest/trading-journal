import React, { useEffect, useState } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { DailyJournalEditor } from './DailyJournalEditor';
import { dailyJournalService, DailyJournalEntry } from '../../services/dailyJournal';
import { usePreferences } from '../../hooks/usePreferences';
import { formatDateLong } from '../../utils/dateFormat';
import { getFullMediaUrl } from '../../utils/mediaUrl';

interface DailyJournalModalProps {
  open: boolean;
  date: string;
  tradingAccountId?: number;
  onClose: () => void;
}

export const DailyJournalModal: React.FC<DailyJournalModalProps> = ({
  open,
  date,
  tradingAccountId,
  onClose,
}) => {
  const { t } = useI18nTranslation();
  const { preferences } = usePreferences();
  const formattedDate = formatDateLong(date, preferences.date_format, preferences.language, preferences.timezone);
  const [entry, setEntry] = useState<DailyJournalEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!open) {
      setEntry(null);
      setIsEditing(false);
      setIsLoading(false);
      return;
    }
    let isMounted = true;
    setIsEditing(false);
    setIsLoading(true);
    dailyJournalService.getEntryByDate(date, tradingAccountId)
      .then((result) => {
        if (!isMounted) return;
        setEntry(result);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [date, tradingAccountId, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white dark:bg-gray-800 w-full max-w-4xl rounded-xl shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-t-xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 dark:bg-blue-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('dailyJournal.title', { defaultValue: 'Journal' })}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">{formattedDate}</p>
            </div>
          </div>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-sm font-medium"
            >
              {t('dailyJournal.editAction', { defaultValue: 'Modifier' })}
            </button>
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isEditing ? (
            <DailyJournalEditor
              date={date}
              tradingAccountId={tradingAccountId}
              entryId={entry?.id}
              initialEntry={entry}
              onSaved={(saved) => {
                setEntry(saved);
                setIsEditing(false);
              }}
              onDeleted={() => {
                setEntry(null);
                setIsEditing(false);
              }}
            />
          ) : (
            <div className="space-y-4">
              {isLoading ? (
                <div className="text-center py-10 text-gray-500">
                  {t('dailyJournal.loading', { defaultValue: 'Chargement...' })}
                </div>
              ) : entry ? (
                <>
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-800 dark:text-gray-200">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                      components={{
                        h1: ({ children }) => <h1 className="text-2xl font-bold mt-2 mb-2">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-xl font-semibold mt-2 mb-2">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-lg font-semibold mt-2 mb-2">{children}</h3>,
                        ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>,
                        li: ({ children }) => <li className="text-gray-800 dark:text-gray-200">{children}</li>,
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
                            >
                              {children}
                            </a>
                          );
                        },
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-600 dark:text-gray-300 my-2">
                            {children}
                          </blockquote>
                        ),
                      }}
                    >
                      {entry.content || ''}
                    </ReactMarkdown>
                  </div>
                  {entry.images.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {entry.images.map((image) => (
                        <div key={image.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-white dark:bg-gray-900">
                          <img
                            src={getFullMediaUrl(image.image_url || image.image)}
                            alt={image.caption || 'Journal'}
                            className="w-full h-40 object-cover rounded-md"
                            loading="lazy"
                          />
                          {image.caption && (
                            <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">{image.caption}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-10 text-gray-500 space-y-3">
                  <p>{t('dailyJournal.empty', { defaultValue: 'Aucun journal pour cette date.' })}</p>
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-sm"
                  >
                    {t('dailyJournal.create', { defaultValue: 'Creer' })}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
