import React from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { Tooltip } from '../ui';

interface JournalEditorToolbarProps {
  onAction: (action: 'bold' | 'italic' | 'underline' | 'strike' | 'code' | 'heading1' | 'heading2' | 'heading3' | 'bullet' | 'numbered' | 'link' | 'quote' | 'textColor' | 'highlight') => void;
  disabled?: boolean;
}

export const JournalEditorToolbar: React.FC<JournalEditorToolbarProps> = ({ onAction, disabled = false }) => {
  const { t } = useI18nTranslation();
  const buttonClass = 'px-2 py-1 text-sm border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors';

  return (
    <div className="flex flex-wrap gap-2">
      <Tooltip content={t('dailyJournal.tooltip.bold', { defaultValue: 'Gras' })} position="bottom">
        <button type="button" onClick={() => onAction('bold')} disabled={disabled} className={buttonClass}>
          <strong>G</strong>
        </button>
      </Tooltip>
      <Tooltip content={t('dailyJournal.tooltip.italic', { defaultValue: 'Italique' })} position="bottom">
        <button type="button" onClick={() => onAction('italic')} disabled={disabled} className={buttonClass}>
          <em>I</em>
        </button>
      </Tooltip>
      <Tooltip content={t('dailyJournal.tooltip.underline', { defaultValue: 'Surligner' })} position="bottom">
        <button type="button" onClick={() => onAction('underline')} disabled={disabled} className={buttonClass}>
          U
        </button>
      </Tooltip>
      <Tooltip content={t('dailyJournal.tooltip.strike', { defaultValue: 'Barre' })} position="bottom">
        <button type="button" onClick={() => onAction('strike')} disabled={disabled} className={buttonClass}>
          S
        </button>
      </Tooltip>
      <Tooltip content={t('dailyJournal.tooltip.textColor', { defaultValue: 'Couleur du texte' })} position="bottom">
        <button type="button" onClick={() => onAction('textColor')} disabled={disabled} className={buttonClass} aria-label={t('dailyJournal.tooltip.textColor', { defaultValue: 'Couleur du texte' })}>
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
            <path d="M5 20h14" strokeLinecap="round" />
            <path d="M8 16l4-10 4 10" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 12h4" strokeLinecap="round" />
          </svg>
        </button>
      </Tooltip>
      <Tooltip content={t('dailyJournal.tooltip.highlight', { defaultValue: 'Surligner le fond' })} position="bottom">
        <button type="button" onClick={() => onAction('highlight')} disabled={disabled} className={buttonClass} aria-label={t('dailyJournal.tooltip.highlight', { defaultValue: 'Surligner le fond' })}>
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
            <path d="M9 3l8 8-4 4-8-8z" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="3" y="17" width="10" height="4" rx="1" fill="currentColor" opacity="0.35" stroke="none" />
          </svg>
        </button>
      </Tooltip>
      <Tooltip content={t('dailyJournal.tooltip.code', { defaultValue: 'Code' })} position="bottom">
        <button type="button" onClick={() => onAction('code')} disabled={disabled} className={buttonClass}>
          {"</>"}
        </button>
      </Tooltip>
      <Tooltip content={t('dailyJournal.tooltip.h1', { defaultValue: 'Titre 1' })} position="bottom">
        <button type="button" onClick={() => onAction('heading1')} disabled={disabled} className={buttonClass}>
          H1
        </button>
      </Tooltip>
      <Tooltip content={t('dailyJournal.tooltip.h2', { defaultValue: 'Titre 2' })} position="bottom">
        <button type="button" onClick={() => onAction('heading2')} disabled={disabled} className={buttonClass}>
          H2
        </button>
      </Tooltip>
      <Tooltip content={t('dailyJournal.tooltip.h3', { defaultValue: 'Titre 3' })} position="bottom">
        <button type="button" onClick={() => onAction('heading3')} disabled={disabled} className={buttonClass}>
          H3
        </button>
      </Tooltip>
      <Tooltip content={t('dailyJournal.tooltip.bullet', { defaultValue: 'Liste a puces' })} position="bottom">
        <button type="button" onClick={() => onAction('bullet')} disabled={disabled} className={buttonClass}>
          • Liste
        </button>
      </Tooltip>
      <Tooltip content={t('dailyJournal.tooltip.numbered', { defaultValue: 'Liste numerotee' })} position="bottom">
        <button type="button" onClick={() => onAction('numbered')} disabled={disabled} className={buttonClass}>
          1. Liste
        </button>
      </Tooltip>
      <Tooltip content={t('dailyJournal.tooltip.quote', { defaultValue: 'Citation' })} position="bottom">
        <button type="button" onClick={() => onAction('quote')} disabled={disabled} className={buttonClass}>
          &gt; Citation
        </button>
      </Tooltip>
      <Tooltip content={t('dailyJournal.tooltip.link', { defaultValue: 'Lien' })} position="bottom">
        <button type="button" onClick={() => onAction('link')} disabled={disabled} className={buttonClass}>
          Lien
        </button>
      </Tooltip>
    </div>
  );
};
