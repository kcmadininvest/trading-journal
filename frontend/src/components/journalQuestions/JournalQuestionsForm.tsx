import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { replayPrimaryButtonClass } from '../replay/replayStyles';
import { CustomSelect } from '../common/CustomSelect';
import { CustomMultiSelect } from '../common/CustomMultiSelect';
import { DateInput } from '../common/DateInput';
import { NumberInput } from '../common/NumberInput';
import { usePreferences } from '../../hooks/usePreferences';
import { formatNumber, NumberFormatType } from '../../utils/numberFormat';
import {
  AnswersFormPayload,
  AnswerType,
  QuestionnaireQuestion,
  QuestionnaireScope,
  journalQuestionsService,
} from '../../services/journalQuestions';
import {
  isAnswered,
  isQuestionVisible,
  normalizeShowIf,
  sortQuestionsForDisplay,
} from '../../utils/questionnaireVisibility';

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
const MAX_SCALE_SEGMENT_VALUES = 11;

const FIELD_INPUT_CLASS =
  'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

const SEGMENT_SHELL_CLASS =
  'inline-flex rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-0.5';

function defaultValueFor(q: QuestionnaireQuestion): unknown {
  if (q.answer_type === 'boolean') return null;
  if (q.answer_type === 'multiple_choice') return [];
  if (q.answer_type === 'text') return '';
  return null;
}

function visibleValuesSnapshot(
  questions: QuestionnaireQuestion[],
  values: Record<number, unknown>
): string {
  const byId = Object.fromEntries(questions.map((q) => [q.id, q]));
  const snapshot: Record<number, unknown> = {};
  for (const q of questions) {
    if (!isQuestionVisible(q, values, byId)) continue;
    snapshot[q.id] = values[q.id] ?? null;
  }
  return JSON.stringify(snapshot);
}

function formatShowIfBadge(
  question: QuestionnaireQuestion,
  allQuestions: QuestionnaireQuestion[],
  t: (key: string, options?: Record<string, unknown>) => string
): string | null {
  const rule = normalizeShowIf(question.show_if);
  if (!rule) return null;
  if (rule.conditions.length > 1) {
    return t('badgeIfMulti', {
      logic: rule.logic === 'or' ? t('logicOrBadge') : t('logicAndBadge'),
      count: rule.conditions.length,
    });
  }
  const cond = rule.conditions[0];
  const source = allQuestions.find((q) => q.id === cond.question_id);
  let label = '?';
  if (source?.answer_type === 'boolean') {
    label = cond.value === true ? t('yes') : t('no');
  } else if (source) {
    const choice = source.choices.find((c) => c.id === cond.value);
    label = choice?.label || String(cond.value);
  }
  return cond.operator === 'neq' ? t('badgeIfNeq', { label }) : t('badgeIf', { label });
}

function scaleValues(min: number, max: number, step: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(step) || step <= 0) {
    return [];
  }
  const values: number[] = [];
  const decimals = String(step).includes('.') ? String(step).split('.')[1].length : 0;
  for (let v = min; v <= max + step / 1000; v += step) {
    const rounded = Number(v.toFixed(decimals));
    if (rounded > max + step / 1000) break;
    values.push(rounded);
    if (values.length > MAX_SCALE_SEGMENT_VALUES) return values;
  }
  return values;
}

interface SegmentedOption<T extends string | number | boolean> {
  value: T;
  label: string;
}

function SegmentedControl<T extends string | number | boolean>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: SegmentedOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className={SEGMENT_SHELL_CLASS} role="group">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            aria-pressed={selected}
            className={`inline-flex h-9 items-center justify-center px-4 rounded-[0.3rem] text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              selected
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

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
  const numberFormat = (preferences.number_format as NumberFormatType) || 'comma';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionnaireQuestion[]>([]);
  const [values, setValues] = useState<Record<number, unknown>>({});
  const [baselineSnapshot, setBaselineSnapshot] = useState('');
  const valuesRef = useRef(values);
  valuesRef.current = values;

  useEffect(() => {
    if (!success) return undefined;
    const timerId = window.setTimeout(() => setSuccess(null), 3000);
    return () => window.clearTimeout(timerId);
  }, [success]);

  const questionsById = useMemo(
    () => Object.fromEntries(questions.map((q) => [q.id, q])),
    [questions]
  );

  const orderedQuestions = useMemo(
    () => sortQuestionsForDisplay(questions),
    [questions]
  );

  const visibleQuestions = useMemo(
    () => orderedQuestions.filter((q) => isQuestionVisible(q, values, questionsById)),
    [orderedQuestions, values, questionsById]
  );

  const answeredCount = useMemo(
    () => visibleQuestions.filter((q) => isAnswered(values[q.id])).length,
    [visibleQuestions, values]
  );

  const isDirty = useMemo(
    () => visibleValuesSnapshot(questions, values) !== baselineSnapshot,
    [questions, values, baselineSnapshot]
  );

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
        valuesRef.current = next;
        setBaselineSnapshot(visibleValuesSnapshot(payload.questions, next));
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
      const byId = Object.fromEntries(questions.map((q) => [q.id, q]));
      const visibleIds = new Set(
        questions
          .filter((q) => isQuestionVisible(q, currentValues, byId))
          .map((q) => q.id)
      );

      const answersPayload = questions
        .map((q) => {
          if (!visibleIds.has(q.id)) {
            return { question_id: q.id, value: null };
          }
          return { question_id: q.id, value: currentValues[q.id] ?? null };
        })
        .filter((a) => {
          if (!visibleIds.has(a.question_id)) return true;
          return isAnswered(a.value);
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
      setBaselineSnapshot(visibleValuesSnapshot(payload.questions, next));
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

  const saveButton = (
    <button
      type="button"
      onClick={handleSave}
      disabled={saving || !isDirty}
      className={replayPrimaryButtonClass}
    >
      {saving ? t('saving') : t('saveAnswers')}
    </button>
  );

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

      {compact ? (
        <div className="space-y-3">
          {visibleQuestions.map((q) => (
            <QuestionBlock
              key={q.id}
              question={q}
              allQuestions={questions}
              value={values[q.id]}
              onChange={(v) => setValue(q.id, v)}
              numberFormat={numberFormat}
              disabled={saving}
              variant="compact"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {visibleQuestions.map((q) => (
            <QuestionBlock
              key={q.id}
              question={q}
              allQuestions={questions}
              value={values[q.id]}
              onChange={(v) => setValue(q.id, v)}
              numberFormat={numberFormat}
              disabled={saving}
              variant="card"
            />
          ))}
        </div>
      )}

      {compact ? (
        <div className="flex justify-end">{saveButton}</div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('statusLink', {
              answered: formatNumber(answeredCount, 0, numberFormat),
              total: formatNumber(visibleQuestions.length, 0, numberFormat),
            })}
          </p>
          {saveButton}
        </div>
      )}
    </div>
  );
};

interface QuestionBlockProps {
  question: QuestionnaireQuestion;
  allQuestions: QuestionnaireQuestion[];
  value: unknown;
  onChange: (value: unknown) => void;
  numberFormat: NumberFormatType;
  disabled?: boolean;
  variant: 'card' | 'compact';
}

const QuestionBlock: React.FC<QuestionBlockProps> = ({
  question,
  allQuestions,
  value,
  onChange,
  numberFormat,
  disabled,
  variant,
}) => {
  const { t } = useTranslation('journalQuestions');
  const badge = formatShowIfBadge(question, allQuestions, t);
  const spanFull = variant === 'card' && question.answer_type === 'text';

  const header = (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {question.label}
          {question.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {badge && (
          <span className="inline-flex items-center rounded-md bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
            {badge}
          </span>
        )}
      </div>
      {question.help_text && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{question.help_text}</p>
      )}
    </div>
  );

  const field = (
    <QuestionField
      question={question}
      value={value}
      onChange={onChange}
      numberFormat={numberFormat}
      disabled={disabled}
    />
  );

  if (variant === 'card') {
    return (
      <div
        className={`rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 p-4 space-y-3 ${
          spanFull ? 'xl:col-span-2' : ''
        }`}
      >
        {header}
        {field}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {header}
      {field}
    </div>
  );
};

interface QuestionFieldProps {
  question: QuestionnaireQuestion;
  value: unknown;
  onChange: (value: unknown) => void;
  numberFormat: NumberFormatType;
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
  const config = (question.config || {}) as Record<string, number | string | boolean | undefined>;

  if (question.answer_type === 'boolean') {
    const selected =
      value === true || value === false
        ? value
        : value === 'true'
          ? true
          : value === 'false'
            ? false
            : null;
    return (
      <SegmentedControl
        value={selected}
        disabled={disabled}
        onChange={onChange}
        options={[
          { value: true, label: t('yes') },
          { value: false, label: t('no') },
        ]}
      />
    );
  }

  if (question.answer_type === 'text') {
    return (
      <textarea
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        maxLength={typeof config.max_length === 'number' ? config.max_length : undefined}
        className={`${FIELD_INPUT_CLASS} min-h-[80px] resize-y`}
      />
    );
  }

  if (question.answer_type === 'number') {
    const decimal = config.decimal !== false;
    return (
      <NumberInput
        value={value == null || value === '' ? '' : (value as string | number)}
        digits={decimal ? 2 : 0}
        step={decimal ? 'any' : 1}
        disabled={disabled}
        commitOnChange
        onChange={(raw) => {
          if (raw === '') {
            onChange(null);
            return;
          }
          const num = Number(raw);
          if (!Number.isFinite(num)) {
            onChange(null);
            return;
          }
          onChange(decimal ? num : Math.round(num));
        }}
        className={`${FIELD_INPUT_CLASS} max-w-[160px] h-10`}
      />
    );
  }

  if (question.answer_type === 'scale') {
    const min = config.min != null ? Number(config.min) : 1;
    const max = config.max != null ? Number(config.max) : 5;
    const step = config.step != null ? Number(config.step) : 1;

    if (Number.isFinite(min) && Number.isFinite(max)) {
      const options = scaleValues(min, max, step);
      if (options.length > 0 && options.length <= MAX_SCALE_SEGMENT_VALUES) {
        const selected =
          value == null || value === '' ? null : Number(value);
        return (
          <SegmentedControl
            value={Number.isFinite(selected as number) ? (selected as number) : null}
            disabled={disabled}
            onChange={onChange}
            options={options.map((v) => ({
              value: v,
              label: formatNumber(v, 0, numberFormat),
            }))}
          />
        );
      }
    }

    return (
      <div className="flex flex-wrap items-center gap-3">
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
          className={`${FIELD_INPUT_CLASS} max-w-[160px] h-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
        />
        {min != null && max != null && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formatNumber(min, 0, numberFormat)}–{formatNumber(max, 0, numberFormat)}
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
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 shadow-sm px-3 py-2 pr-10 h-10"
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
