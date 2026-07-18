import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageShell } from '../components/layout';
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
    <PageShell className="mx-auto w-full max-w-3xl xl:max-w-5xl 2xl:max-w-6xl">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {t('pageTitle')}
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {t('pageSubtitle')}
          </p>
        </div>

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
          <div className="w-[180px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('types.date')}
            </label>
            <DateInput
              value={date}
              onChange={setDate}
              size="sm"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 px-3 py-2 pr-10 h-10"
            />
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-6">
          {selectedAccountId == null ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('emptyQuestions')}</p>
          ) : (
            <JournalQuestionsForm
              scope="day"
              date={date}
              tradingAccountId={selectedAccountId}
            />
          )}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              onClick={() => {
                window.location.hash = 'daily-journal';
              }}
            >
              {t('goToJournal')}
            </button>
            <button
              type="button"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              onClick={() => {
                window.location.hash = 'settings';
              }}
            >
              {t('goToSettings')}
            </button>
          </div>
        </div>
      </div>
    </PageShell>
  );
};

export default JournalQuestionsPage;
