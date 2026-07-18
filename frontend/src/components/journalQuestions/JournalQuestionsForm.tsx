import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomSelect } from '../common/CustomSelect';
import { CustomMultiSelect } from '../common/CustomMultiSelect';
import { DateInput } from '../common/DateInput';
import { usePreferences } from '../../hooks/usePreferences';
import { formatNumber } from '../../utils/numberFormat';
import {
  AnswersFormPayload,
  AnswerType,
  QuestionnaireQuestion,
  QuestionnaireScope,
  journalQuestionsService,
} from '../../services/journalQuestions';

interface JournalQuestionsFormProps {
  scope: QuestionnaireScope;
  date?: string;
  tradingAccountId?: number | null;
  tradeId?: number;
  compact?: boolean;
  title?: string;
  onSaved?: () => void;
}

const CHOICE_TYPES: AnswerType[] = ['single_choice', 'multiple_choice'];

export const JournalQuestionsForm: React.FC<JournalQuestionsFormProps> = ({
  scope,
  date,
  tradingAccountId,
  tradeId,
  compact = false,
  title,
  onSaved,
}) => {
  const { t } = useTranslation('journalQuestions');
  const { preferences } = usePreferences();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionnaireQuestion[]>([]);
  const [values, setValues] = useState<Record<number, unknown>>({});
  const valuesRef = useRef(values);
  valuesRef.current = values;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload: AnswersFormPayload = await journalQuestionsService.getAnswers({
          scope,
          date,
          trading_account: tradingAccountId,
          trade: tradeId,
        });
        if (cancelled) return;
        setQuestions(payload.questions);
        const next: Record<number, unknown> = {};
        for (const q of payload.questions) {
          const existing = payload.answers.find((a) => a.question_id === q.id);
          next[q.id] = existing ? existing.value : defaultValueFor(q);
        }
        setValues(next);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || t('loadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t volontairement hors deps
  }, [scope, date, tradingAccountId, tradeId]);

  const setValue = (questionId: number, value: unknown) => {
    setValues((prev) => {
      const next = { ...prev, [questionId]: value };
      valuesRef.current = next;
      return next;
    });
    setSuccess(null);
  };

  const handleSave = async () => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const currentValues = valuesRef.current;
      const answersPayload = questions
        .map((q) => ({ question_id: q.id, value: currentValues[q.id] ?? null }))
        .filter((a) => {
          if (a.value === null || a.value === '') return false;
          if (Array.isArray(a.value) && a.value.length === 0) return false;
          return true;
        });

      await journalQuestionsService.bulkSaveAnswers({
        scope,
        date: scope === 'day' ? date : null,
        trading_account: scope === 'day' ? tradingAccountId ?? null : null,
        trade: scope === 'position' ? tradeId : null,
        answers: answersPayload,
      });

      const payload = await journalQuestionsService.getAnswers({
        scope,
        date,
        trading_account: tradingAccountId,
        trade: tradeId,
      });
      setQuestions(payload.questions);
      const next: Record<number, unknown> = {};
      for (const q of payload.questions) {
        const existing = payload.answers.find((a) => a.question_id === q.id);
        next[q.id] = existing ? existing.value : defaultValueFor(q);
      }
      setValues(next);
      valuesRef.current = next;
      setSuccess(t('saved'));
      onSaved?.();
    } catch (err: any) {
      setError(err?.message || t('saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={`text-sm text-gray-500 dark:text-gray-400 ${compact ? 'py-2' : 'py-4'}`}>
        {t('loading')}
      </div>
    );
  }

  if (questions.length === 0) {
    if (compact) return null;
    return (
      <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 px-3 py-4 text-sm text-gray-600 dark:text-gray-300">
        {t('emptyQuestions')}
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${compact ? 'mt-4 pt-4 border-t border-gray-200 dark:border-gray-700' : ''}`}>
      {title && (
        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          {title}
        </h4>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-3 py-2 text-sm text-green-700 dark:text-green-300">
          {success}
        </div>
      )}

      {questions.map((q) => (
        <div key={q.id} className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-800 dark:text-gray-200">
            {q.label}
            {q.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {q.help_text && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{q.help_text}</p>
          )}
          <QuestionField
            question={q}
            value={values[q.id]}
            onChange={(v) => setValue(q.id, v)}
            numberFormat={preferences.number_format}
            disabled={saving}
          />
        </div>
      ))}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50"
        >
          {saving ? t('saving') : t('saveAnswers')}
        </button>
      </div>
    </div>
  );
};

function defaultValueFor(q: QuestionnaireQuestion): unknown {
  if (q.answer_type === 'boolean') return null;
  if (q.answer_type === 'multiple_choice') return [];
  if (q.answer_type === 'text') return '';
  return null;
}

interface QuestionFieldProps {
  question: QuestionnaireQuestion;
  value: unknown;
  onChange: (value: unknown) => void;
  numberFormat: string;
  disabled?: boolean;
}

const QuestionField: React.FC<QuestionFieldProps> = ({
  question,
  value,
  onChange,
  numberFormat,
  disabled,
}) => {
  const { t } = useTranslation('journalQuestions');
  const config = (question.config || {}) as Record<string, number | string | undefined>;
  const inputClass =
    'w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500';

  if (question.answer_type === 'boolean') {
    const selected =
      value === true || value === false ? value : value === 'true' ? true : value === 'false' ? false : null;
    return (
      <div className="flex gap-2">
        {[
          { v: true, label: t('yes') },
          { v: false, label: t('no') },
        ].map((opt) => (
          <button
            key={String(opt.v)}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.v)}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              selected === opt.v
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  if (question.answer_type === 'text') {
    return (
      <textarea
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        maxLength={typeof config.max_length === 'number' ? config.max_length : undefined}
        className={`${inputClass} min-h-[80px]`}
      />
    );
  }

  if (question.answer_type === 'number' || question.answer_type === 'scale') {
    const min = config.min != null ? Number(config.min) : question.answer_type === 'scale' ? 1 : undefined;
    const max = config.max != null ? Number(config.max) : question.answer_type === 'scale' ? 5 : undefined;
    const step = config.step != null ? Number(config.step) : 1;
    return (
      <div className="flex items-center gap-3">
        <input
          type="number"
          value={value == null || value === '' ? '' : Number(value)}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(e) => {
            const raw = e.target.value;
            onChange(raw === '' ? null : Number(raw));
          }}
          className={`${inputClass} max-w-[160px]`}
        />
        {value != null && value !== '' && (
          <span className="text-xs text-gray-500">
            {formatNumber(Number(value), 0, (numberFormat as 'point' | 'comma') || 'comma')}
            {min != null && max != null ? ` (${min}–${max})` : ''}
          </span>
        )}
      </div>
    );
  }

  if (question.answer_type === 'date') {
    return (
      <div
        className={`w-full max-w-[200px] ${
          disabled ? 'pointer-events-none opacity-50' : ''
        }`}
      >
        <DateInput
          value={
            typeof value === 'string'
              ? value
              : value != null
                ? String(value)
                : ''
          }
          onChange={(v) => onChange(v || null)}
          size="sm"
          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 px-3 py-2 pr-10 h-10"
        />
      </div>
    );
  }

  if (question.answer_type === 'single_choice') {
    const choiceId =
      value == null || value === ''
        ? null
        : typeof value === 'number'
          ? value
          : Number(value);
    return (
      <CustomSelect
        value={Number.isFinite(choiceId as number) ? (choiceId as number) : null}
        disabled={disabled}
        onChange={(v) => onChange(v)}
        options={question.choices.map((c) => ({ value: c.id!, label: c.label }))}
        placeholder={t('selectOption')}
      />
    );
  }

  if (CHOICE_TYPES.includes(question.answer_type) && question.answer_type === 'multiple_choice') {
    const selectedNums = Array.isArray(value) ? (value as number[]) : [];
    const selected = selectedNums.map(String);
    return (
      <CustomMultiSelect
        value={selected}
        disabled={disabled}
        onChange={(v) => onChange(v.map((x) => Number(x)))}
        options={question.choices.map((c) => ({ value: String(c.id), label: c.label }))}
        placeholder={t('selectOptions')}
      />
    );
  }

  return null;
};

export default JournalQuestionsForm;
