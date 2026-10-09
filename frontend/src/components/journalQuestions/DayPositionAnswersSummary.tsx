import React, { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { replaySecondaryButtonClass } from '../replay/replayStyles';
import { usePreferences } from '../../hooks/usePreferences';
import { userService } from '../../services/userService';
import { formatDate, formatTime, type LanguageType } from '../../utils/dateFormat';
import { formatNumber, type NumberFormatType } from '../../utils/numberFormat';
import {
  isAnswered,
  isQuestionVisible,
  sortQuestionsForDisplay,
} from '../../utils/questionnaireVisibility';
import type {
  DayPositionTrade,
  QuestionnaireAnswer,
  QuestionnaireQuestion,
} from '../../services/journalQuestions';

interface DayPositionAnswersSummaryProps {
  questions: QuestionnaireQuestion[];
  answers: QuestionnaireAnswer[];
  trades: DayPositionTrade[];
  onEdit: () => void;
}

function formatAnswerValue(
  question: QuestionnaireQuestion,
  value: unknown,
  t: (key: string) => string,
  numberFormat: NumberFormatType,
  dateFormat: 'US' | 'EU'
): string {
  if (question.answer_type === 'boolean') {
    const yes = value === true || value === 'true';
    return yes ? t('yes') : t('no');
  }
  if (question.answer_type === 'text') {
    return String(value);
  }
  if (question.answer_type === 'number') {
    const decimal = question.config?.decimal !== false;
    return formatNumber(value as string | number, decimal ? 2 : 0, numberFormat);
  }
  if (question.answer_type === 'scale') {
    const numeric = Number(value);
    const digits = Number.isInteger(numeric) ? 0 : 2;
    return formatNumber(numeric, digits, numberFormat);
  }
  if (question.answer_type === 'date') {
    return formatDate(String(value), dateFormat);
  }
  if (question.answer_type === 'single_choice') {
    const id = Number(value);
    return question.choices.find((choice) => choice.id === id)?.label ?? String(value);
  }
  if (question.answer_type === 'multiple_choice') {
    const ids = Array.isArray(value) ? value : [];
    return ids
      .map((id) => question.choices.find((choice) => choice.id === Number(id))?.label ?? String(id))
      .join(', ');
  }
  return String(value);
}

export const DayPositionAnswersSummary: React.FC<DayPositionAnswersSummaryProps> = ({
  questions,
  answers,
  trades,
  onEdit,
}) => {
  const { t } = useTranslation('journalQuestions');
  const { preferences, mergePreferences } = usePreferences();
  const numberFormat = (preferences.number_format as NumberFormatType) || 'comma';
  const dateFormat = preferences.date_format === 'US' ? 'US' : 'EU';
  const language = (preferences.language || 'fr') as LanguageType;

  const orderedQuestions = useMemo(
    () => sortQuestionsForDisplay(questions),
    [questions]
  );
  const questionsById = useMemo(
    () => Object.fromEntries(questions.map((question) => [question.id, question])),
    [questions]
  );

  const storedCollapsed = preferences.journal_questions_positions_collapsed === true;
  const [collapsed, setCollapsed] = useState(storedCollapsed);
  const panelId = useId();

  useEffect(() => {
    setCollapsed(storedCollapsed);
  }, [storedCollapsed]);

  const hasActiveQuestion = questions.some((question) => question.is_active);
  if (!hasActiveQuestion || trades.length === 0) {
    return null;
  }

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    mergePreferences({ journal_questions_positions_collapsed: next });
    userService.updatePreferences({ journal_questions_positions_collapsed: next }).catch(() => {
      setCollapsed(!next);
      mergePreferences({ journal_questions_positions_collapsed: !next });
    });
  };

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-controls={panelId}
          className="-ml-1 flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <svg
            className={`h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400 transition-transform ${collapsed ? '' : 'rotate-90'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {t('positionDayTitle')}
          </h2>
        </button>
        <button type="button" onClick={onEdit} className={replaySecondaryButtonClass}>
          {t('edit')}
        </button>
      </div>

      <div id={panelId} hidden={collapsed} className="space-y-4">
      {trades.map((trade) => {
        const answersByQid: Record<number, unknown> = {};
        for (const answer of answers) {
          if (answer.trade === trade.id) {
            answersByQid[answer.question_id] = answer.value;
          }
        }
        const rows = orderedQuestions
          .filter((question) => isQuestionVisible(question, answersByQid, questionsById))
          .filter((question) => isAnswered(answersByQid[question.id]))
          .map((question) => ({
            id: question.id,
            label: question.label,
            value: formatAnswerValue(
              question,
              answersByQid[question.id],
              t,
              numberFormat,
              dateFormat
            ),
          }));

        return (
          <article
            key={trade.id}
            className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {trade.contract_name}
              </span>
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${
                  trade.trade_type === 'Long'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                }`}
              >
                {trade.trade_type}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {formatTime(trade.entered_at, preferences.timezone, language)}
              </span>
            </div>
            {rows.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('notAnsweredYet')}</p>
            ) : (
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {rows.map((row) => (
                  <div key={row.id} className="min-w-0">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">{row.label}</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </article>
        );
      })}
      </div>
    </section>
  );
};

export default DayPositionAnswersSummary;
