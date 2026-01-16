import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { dailyJournalService, DailyJournalEntry, DailyJournalImage } from '../../services/dailyJournal';
import { getFullMediaUrl } from '../../utils/mediaUrl';
import { DeleteConfirmModal } from '../ui';
import { ImageUploader } from './ImageUploader';
import { JournalEditorToolbar } from './JournalEditorToolbar';

interface DailyJournalEditorProps {
  date: string;
  tradingAccountId?: number;
  entryId?: number | null;
  initialEntry?: DailyJournalEntry | null;
  onSaved?: (entry: DailyJournalEntry) => void;
  onDeleted?: () => void;
  compact?: boolean;
}

export const DailyJournalEditor: React.FC<DailyJournalEditorProps> = ({
  date,
  tradingAccountId,
  entryId,
  initialEntry = null,
  onSaved,
  onDeleted,
  compact = false,
}) => {
  const { t } = useI18nTranslation();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [entry, setEntry] = useState<DailyJournalEntry | null>(initialEntry);
  const [content, setContent] = useState(initialEntry?.content || '');
  const [images, setImages] = useState<DailyJournalImage[]>(initialEntry?.images || []);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [draftRestored, setDraftRestored] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [textColor, setTextColor] = useState('#2563eb');
  const [highlightColor, setHighlightColor] = useState('#fde68a');

  const textColorInputRef = useRef<HTMLInputElement | null>(null);
  const highlightInputRef = useRef<HTMLInputElement | null>(null);

  const draftKey = useMemo(() => `dailyJournalDraft:${date}:${tradingAccountId ?? 'all'}`, [date, tradingAccountId]);

  const loadEntry = useCallback(async () => {
    if (entryId) {
      const loaded = await dailyJournalService.getEntry(entryId);
      return loaded;
    }
    return dailyJournalService.getEntryByDate(date, tradingAccountId);
  }, [date, entryId, tradingAccountId]);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setMessage(null);
    loadEntry()
      .then((loaded) => {
        if (!isMounted) return;
        setEntry(loaded);
        const draft = localStorage.getItem(draftKey);
        if (draft && (!loaded || !loaded.content)) {
          setContent(draft);
          setDraftRestored(true);
        } else {
          setContent(loaded?.content || '');
          setDraftRestored(false);
        }
        setImages(loaded?.images || []);
      })
      .catch(() => {
        if (!isMounted) return;
      setMessage(t('dailyJournal.loadError', { defaultValue: 'Erreur lors du chargement du journal.' }));
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [loadEntry, draftKey, t]);

  useEffect(() => {
    const handler = window.setTimeout(() => {
      if (content.trim()) {
        localStorage.setItem(draftKey, content);
      } else {
        localStorage.removeItem(draftKey);
      }
    }, 600);
    return () => window.clearTimeout(handler);
  }, [content, draftKey]);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      let saved: DailyJournalEntry;
      if (!entry) {
        saved = await dailyJournalService.createEntry({
          date,
          content,
          trading_account: tradingAccountId ?? null,
        });
      } else {
        saved = await dailyJournalService.updateEntry(entry.id, { content });
      }
      setEntry(saved);
      setImages(saved.images || images);
      localStorage.removeItem(draftKey);
      setDraftRestored(false);
      setMessage(t('dailyJournal.saved', { defaultValue: 'Journal enregistre.' }));
      onSaved?.(saved);
    } catch (err: any) {
      setMessage(err?.message || t('dailyJournal.saveError', { defaultValue: "Impossible d'enregistrer le journal." }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!entry) return;
    setIsDeleting(true);
    setMessage(null);
    try {
      await dailyJournalService.deleteEntry(entry.id);
      setEntry(null);
      setContent('');
      setImages([]);
      localStorage.removeItem(draftKey);
      setDraftRestored(false);
      setMessage(t('dailyJournal.deleted', { defaultValue: 'Journal supprime.' }));
      onDeleted?.();
      setIsDeleteOpen(false);
    } catch (err: any) {
      setMessage(err?.message || t('dailyJournal.deleteError', { defaultValue: 'Erreur lors de la suppression du journal.' }));
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleWrap = (before: string, after = before) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end);
    const hasWrap =
      start >= before.length &&
      content.slice(start - before.length, start) === before &&
      content.slice(end, end + after.length) === after;

    if (hasWrap) {
      const next = `${content.slice(0, start - before.length)}${selected}${content.slice(end + after.length)}`;
      setContent(next);
      window.requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(start - before.length, end - before.length);
      });
      return;
    }

    if (!selected) {
      const next = `${content.slice(0, start)}${before}${after}${content.slice(end)}`;
      setContent(next);
      window.requestAnimationFrame(() => {
        textarea.focus();
        const cursor = start + before.length;
        textarea.setSelectionRange(cursor, cursor);
      });
      return;
    }

    const next = `${content.slice(0, start)}${before}${selected}${after}${content.slice(end)}`;
    setContent(next);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    });
  };

  const toggleLinePrefix = (prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    let start = textarea.selectionStart;
    let end = textarea.selectionEnd;

    // Si aucune sélection, appliquer au niveau de la ligne courante
    if (start === end) {
      const before = content.slice(0, start);
      const lineStart = before.lastIndexOf('\n') + 1;
      const after = content.slice(start);
      const lineEndOffset = after.indexOf('\n');
      const lineEnd = lineEndOffset === -1 ? content.length : start + lineEndOffset;
      start = lineStart;
      end = lineEnd;
    }
    const selection = content.slice(start, end);
    const lines = selection.split('\n');
    const updatedLines = lines.map((line) => {
      if (!line.trim().length) {
        return line;
      }
      if (line.startsWith(prefix)) {
        return line.slice(prefix.length);
      }
      const headingMatch = line.match(/^#{1,6}\s+/);
      if (headingMatch) {
        return `${prefix}${line.slice(headingMatch[0].length)}`;
      }
      return `${prefix}${line}`;
    });
    const next = `${content.slice(0, start)}${updatedLines.join('\n')}${content.slice(end)}`;
    setContent(next);
    window.requestAnimationFrame(() => {
      textarea.focus();
      const newEnd = start + updatedLines.join('\n').length;
      textarea.setSelectionRange(start, newEnd);
    });
  };

  const handleToolbarAction = (action: 'bold' | 'italic' | 'underline' | 'strike' | 'code' | 'heading1' | 'heading2' | 'heading3' | 'bullet' | 'numbered' | 'link' | 'quote' | 'textColor' | 'highlight') => {
    switch (action) {
      case 'bold':
        toggleWrap('**');
        break;
      case 'italic':
        toggleWrap('*');
        break;
      case 'underline':
        toggleWrap('<u>', '</u>');
        break;
      case 'strike':
        toggleWrap('~~');
        break;
      case 'code':
        toggleWrap('`');
        break;
      case 'heading1':
        toggleLinePrefix('# ');
        break;
      case 'heading2':
        toggleLinePrefix('## ');
        break;
      case 'heading3':
        toggleLinePrefix('### ');
        break;
      case 'bullet':
        toggleLinePrefix('- ');
        break;
      case 'numbered':
        toggleLinePrefix('1. ');
        break;
      case 'quote':
        toggleLinePrefix('> ');
        break;
      case 'link':
        {
          const textarea = textareaRef.current;
          if (!textarea) break;
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const selected = content.slice(start, end) || 'texte';
          const linkMarkup = `[${selected}](url)`;
          const next = `${content.slice(0, start)}${linkMarkup}${content.slice(end)}`;
          setContent(next);
          window.requestAnimationFrame(() => {
            textarea.focus();
            const urlStart = start + linkMarkup.indexOf('url');
            textarea.setSelectionRange(urlStart, urlStart + 3);
          });
        }
        break;
      case 'textColor':
        textColorInputRef.current?.click();
        break;
      case 'highlight':
        highlightInputRef.current?.click();
        break;
      default:
        break;
    }
  };

  const applySpanStyle = (style: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end) || 'texte';
    const markup = `<span style="${style}">${selected}</span>`;
    const next = `${content.slice(0, start)}${markup}${content.slice(end)}`;
    setContent(next);
    window.requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + markup.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const handleUploadFiles = async (files: File[]) => {
    setIsUploading(true);
    setMessage(null);
    try {
      let currentEntry = entry;
      if (!currentEntry) {
        currentEntry = await dailyJournalService.createEntry({
          date,
          content,
          trading_account: tradingAccountId ?? null,
        });
        setEntry(currentEntry);
      }
      const uploaded: DailyJournalImage[] = [];
      for (const file of files) {
        // eslint-disable-next-line no-await-in-loop
        const image = await dailyJournalService.uploadImage(currentEntry.id, file);
        uploaded.push(image);
      }
      setImages((prev) => [...prev, ...uploaded].sort((a, b) => a.order - b.order));
    } catch (err: any) {
      setMessage(err?.message || t('dailyJournal.uploadError', { defaultValue: "Erreur lors de l'upload des images." }));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteImage = async (imageId: number) => {
    if (!entry) return;
    try {
      await dailyJournalService.deleteImage(entry.id, imageId);
      setImages((prev) => prev.filter((img) => img.id !== imageId));
    } catch (err: any) {
      setMessage(err?.message || t('dailyJournal.deleteImageError', { defaultValue: "Erreur lors de la suppression de l'image." }));
    }
  };

  const handleMoveImage = async (imageId: number, direction: 'up' | 'down') => {
    if (!entry) return;
    const currentIndex = images.findIndex((img) => img.id === imageId);
    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= images.length) return;

    const updated = [...images];
    const current = updated[currentIndex];
    const target = updated[nextIndex];
    const tempOrder = current.order;
    current.order = target.order;
    target.order = tempOrder;
    updated[currentIndex] = current;
    updated[nextIndex] = target;
    setImages([...updated].sort((a, b) => a.order - b.order));

    try {
      await Promise.all([
        dailyJournalService.updateImage(entry.id, current.id, { order: current.order }),
        dailyJournalService.updateImage(entry.id, target.id, { order: target.order }),
      ]);
    } catch (err: any) {
      setMessage(err?.message || t('dailyJournal.reorderError', { defaultValue: 'Erreur lors du reordonnancement des images.' }));
    }
  };

  const handleCaptionBlur = async (imageId: number, caption: string) => {
    if (!entry) return;
    try {
      const updated = await dailyJournalService.updateImage(entry.id, imageId, { caption });
      setImages((prev) => prev.map((img) => (img.id === imageId ? { ...img, caption: updated.caption } : img)));
    } catch (err: any) {
      setMessage(err?.message || t('dailyJournal.captionError', { defaultValue: 'Erreur lors de la mise a jour de la legende.' }));
    }
  };

  const sortedImages = [...images].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4">
      {draftRestored && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2 text-sm text-yellow-800 dark:text-yellow-200">
          {t('dailyJournal.draftRestored', { defaultValue: 'Brouillon restaure automatiquement.' })}
        </div>
      )}

      {message && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
          {message}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <JournalEditorToolbar onAction={handleToolbarAction} disabled={isLoading || isSaving} />
        <button
          type="button"
          onClick={() => setShowPreview((prev) => !prev)}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          {showPreview ? t('dailyJournal.hidePreview', { defaultValue: 'Masquer la preview' }) : t('dailyJournal.showPreview', { defaultValue: 'Afficher la preview' })}
        </button>
      </div>

      <input
        ref={textColorInputRef}
        type="color"
        value={textColor}
        onChange={(event) => setTextColor(event.target.value)}
        onInput={(event) => {
          const value = (event.target as HTMLInputElement).value;
          setTextColor(value);
          applySpanStyle(`color: ${value}`);
        }}
        className="hidden"
      />
      <input
        ref={highlightInputRef}
        type="color"
        value={highlightColor}
        onChange={(event) => setHighlightColor(event.target.value)}
        onInput={(event) => {
          const value = (event.target as HTMLInputElement).value;
          setHighlightColor(value);
          applySpanStyle(`background-color: ${value}`);
        }}
        className="hidden"
      />

      <textarea
        ref={textareaRef}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder={t('dailyJournal.placeholder', { defaultValue: 'Ecrivez votre journal...' })}
        className={`w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${compact ? 'min-h-[120px]' : 'min-h-[200px]'}`}
        disabled={isLoading || isSaving}
      />

      {showPreview && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-200">
          {content.trim() ? (
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
              {content}
            </ReactMarkdown>
          ) : (
            <p className="text-gray-400 dark:text-gray-500">{t('dailyJournal.previewEmpty', { defaultValue: 'Aucun contenu a previsualiser.' })}</p>
          )}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('dailyJournal.images', { defaultValue: 'Images' })}</h4>
          {isUploading && (
            <span className="text-xs text-gray-500">{t('dailyJournal.uploading', { defaultValue: 'Upload en cours...' })}</span>
          )}
        </div>
        <ImageUploader onFilesSelected={handleUploadFiles} disabled={isUploading} />
        {sortedImages.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sortedImages.map((image, index) => (
              <div key={image.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-white dark:bg-gray-900">
                <div className="relative">
                  <img
                    src={getFullMediaUrl(image.image_url || image.image)}
                    alt={image.caption || 'Journal'}
                    className="w-full h-40 object-cover rounded-md"
                    loading="lazy"
                  />
                  <div className="absolute top-2 right-2 flex gap-1">
                    <button
                      type="button"
                      onClick={() => handleMoveImage(image.id, 'up')}
                      className="bg-white/80 dark:bg-gray-800/80 text-xs px-2 py-1 rounded"
                      disabled={index === 0}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveImage(image.id, 'down')}
                      className="bg-white/80 dark:bg-gray-800/80 text-xs px-2 py-1 rounded"
                      disabled={index === sortedImages.length - 1}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(image.id)}
                      className="bg-white/80 dark:bg-gray-800/80 text-xs px-2 py-1 rounded text-red-600"
                    >
                      {t('dailyJournal.delete', { defaultValue: 'Supprimer' })}
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  defaultValue={image.caption}
                  onBlur={(event) => handleCaptionBlur(image.id, event.target.value)}
                  placeholder={t('dailyJournal.caption', { defaultValue: 'Legende (optionnelle)' })}
                  className="mt-2 w-full rounded border border-gray-200 dark:border-gray-700 bg-transparent px-2 py-1 text-xs text-gray-700 dark:text-gray-200"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-3">
        {entry && (
          <button
            type="button"
            onClick={() => setIsDeleteOpen(true)}
            disabled={isSaving || isDeleting}
            className="px-4 py-2 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm"
          >
            {t('dailyJournal.delete', { defaultValue: 'Supprimer' })}
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-sm"
        >
          {isSaving ? t('dailyJournal.saving', { defaultValue: 'Enregistrement...' }) : t('dailyJournal.save', { defaultValue: 'Enregistrer' })}
        </button>
      </div>

      <DeleteConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title={t('dailyJournal.deleteTitle', { defaultValue: 'Supprimer le journal' })}
        message={t('dailyJournal.deleteConfirm', { defaultValue: 'Supprimer ce journal ? Cette action est irreversible.' })}
      />
    </div>
  );
};
