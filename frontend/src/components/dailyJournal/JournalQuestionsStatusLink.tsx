import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { journalQuestionsService } from '../../services/journalQuestions';
import { isQuestionVisible } from '../../utils/questionnaireVisibility';

interface JournalQuestionsStatusLinkProps {
  date: string;
  tradingAccountId?: number | null;
}

export const JournalQuestionsStatusLink: React.FC<JournalQuestionsStatusLinkProps> = ({
  date,
  tradingAccountId,
}) => {
  const { t } = useTranslation('journalQuestions');
  const [answered, setAnswered] = useState(0);
  const [total, setTotal] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!date || tradingAccountId == null) {
        setVisible(false);
        return;
      }
      try {
        const payload = await journalQuestionsService.getAnswers({
          scope: 'day',
          date,
          trading_account: tradingAccountId,
        });
        if (cancelled) return;

        const questionsById = Object.fromEntries(
          payload.questions.map((q) => [q.id, q])
        );
        const answersByQid: Record<number, unknown> = {};
        for (const a of payload.answers) {
          answersByQid[a.question_id] = a.value;
        }

        const activeVisible = payload.questions.filter(
          (q) => q.is_active && isQuestionVisible(q, answersByQid, questionsById)
        );
        const answeredCount = activeVisible.filter((q) => {
          const value = answersByQid[q.id];
          if (value === null || value === undefined || value === '') return false;
          if (Array.isArray(value) && value.length === 0) return false;
          return true;
        }).length;

        if (activeVisible.length === 0 && payload.answers.length === 0) {
          setVisible(false);
          return;
        }
        setTotal(activeVisible.length);
        setAnswered(answeredCount);
        setVisible(true);
      } catch {
        if (!cancelled) setVisible(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [date, tradingAccountId]);

  if (!visible) return null;

  const href =
    tradingAccountId != null
      ? `#journal-questions?date=${encodeURIComponent(date)}&account=${tradingAccountId}`
      : `#journal-questions?date=${encodeURIComponent(date)}`;

  return (
    <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 flex items-center justify-between gap-3">
      <p className="text-sm text-blue-900 dark:text-blue-200">
        {total > 0
          ? t('statusLink', { answered, total })
          : t('statusLinkEmpty')}
      </p>
      <a
        href={href}
        className="text-xs font-medium text-blue-700 dark:text-blue-300 hover:underline whitespace-nowrap"
      >
        {t('statusLinkCta')}
      </a>
    </div>
  );
};

export default JournalQuestionsStatusLink;
