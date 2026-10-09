import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageShell } from '../components/layout';
import { addCalendarDays } from '../components/replay/replayDateNav';
import { replayDateInputClass, replaySecondaryButtonClass } from '../components/replay/replayStyles';
import { AccountSelector } from '../components/accounts/AccountSelector';
import { DateInput } from '../components/common/DateInput';
import { useTradingAccount } from '../contexts/useTradingAccount';
import { useAccountNumberVisibility } from '../hooks/useAccountNumberVisibility';
import { JournalQuestionsForm } from '../components/journalQuestions/JournalQuestionsForm';

function parseHashQuery(): { date?: string; account?: string } {
  const raw = window.location.hash.replace(/^#/, '');
  const qIndex = raw.indexOf('?');
  if (qIndex < 0) return {};
  const params = new URLSearchParams(raw.slice(qIndex + 1));
  return {
    date: params.get('date') || undefined,
    account: params.get('account') || undefined,
  };
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const JournalQuestionsPage: React.FC = () => {
  const { t } = useTranslation(['journalQuestions', 'common']);
  const { selectedAccountId, setSelectedAccountId } = useTradingAccount();
  const hideAccountNumber = useAccountNumberVisibility();
  const initial = useMemo(() => parseHashQuery(), []);
  const [date, setDate] = useState(initial.date || todayISO());

  useEffect(() => {
    if (initial.account) {
      const id = Number(initial.account);
      if (!Number.isNaN(id)) setSelectedAccountId(id);
    }
  }, [initial.account, setSelectedAccountId]);

  return (
    <PageShell className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-shrink-0 min-w-[200px] max-w-sm">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('common:tradingAccount')}
            </label>
            <AccountSelector
              value={selectedAccountId}
              onChange={setSelectedAccountId}
              hideLabel
              hideAccountNumber={hideAccountNumber}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('types.date')}
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setDate((current) => addCalendarDays(current, -1))}
                title={t('previousDay')}
                aria-label={t('previousDay')}
                className={`${replaySecondaryButtonClass} !min-w-[2.25rem] !px-2.5 shrink-0 text-lg leading-none`}
              >
                ‹
              </button>
              <div className="w-[11.5rem] min-w-0 sm:w-[180px]">
                <DateInput
                  value={date}
                  onChange={setDate}
                  className={replayDateInputClass}
                />
              </div>
              <button
                type="button"
                onClick={() => setDate((current) => addCalendarDays(current, 1))}
                title={t('nextDay')}
                aria-label={t('nextDay')}
                className={`${replaySecondaryButtonClass} !min-w-[2.25rem] !px-2.5 shrink-0 text-lg leading-none`}
              >
                ›
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <a href="#daily-journal" className={`${replaySecondaryButtonClass} box-border`}>
              {t('goToJournal')}
            </a>
            <a href="#settings?tab=questions&section=day" className={`${replaySecondaryButtonClass} box-border`}>
              {t('goToSettings')}
            </a>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        {selectedAccountId == null ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('emptyQuestions')}</p>
        ) : (
          <JournalQuestionsForm
            scope="day"
            date={date}
            tradingAccountId={selectedAccountId}
          />
        )}
      </div>
    </PageShell>
  );
};

export default JournalQuestionsPage;
