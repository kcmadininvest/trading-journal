import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { dailyJournalService, DailyJournalEntry, DailyJournalGroupedEntry, DailyJournalGroupedYear } from '../services/dailyJournal';
import { DailyJournalEditor } from '../components/dailyJournal/DailyJournalEditor';
import { usePreferences } from '../hooks/usePreferences';
import { formatDateLong, LanguageType } from '../utils/dateFormat';
import { AccountSelector } from '../components/accounts/AccountSelector';
import { Tooltip } from '../components/ui';
import { useTradingAccount } from '../contexts/TradingAccountContext';
import { getMonthNames } from '../utils/dateFormat';
import { DateInput } from '../components/common/DateInput';

const DailyJournalPage: React.FC = () => {
  const { t, i18n } = useI18nTranslation();
  const { preferences } = usePreferences();
  const { selectedAccountId, setSelectedAccountId, loading: accountLoading } = useTradingAccount();
  const [groupedYears, setGroupedYears] = useState<DailyJournalGroupedYear[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchText, setSearchText] = useState('');
  const [editingEntry, setEditingEntry] = useState<DailyJournalEntry | null>(null);
  const [newEntryDate, setNewEntryDate] = useState('');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [isEntryLoading, setIsEntryLoading] = useState(false);
  const [isMobileEditorOpen, setIsMobileEditorOpen] = useState(true);
  const [hoveredEntry, setHoveredEntry] = useState<DailyJournalGroupedEntry | null>(null);
  const [hoveredEntryContent, setHoveredEntryContent] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await dailyJournalService.listGrouped({
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        trading_account: selectedAccountId ?? undefined,
        search: searchText || undefined,
      });
      const years = response.years || [];
      setGroupedYears(years);

      if (years.length === 0) {
        setSelectedYear(null);
        setSelectedMonth(null);
        return;
      }

      const yearFromSelection = selectedYear ? years.find((year) => year.year === selectedYear) : null;
      const nextYear = (yearFromSelection ?? years[0]).year;

      const monthFromSelection = selectedMonth && yearFromSelection
        ? yearFromSelection.months.find((month) => month.month === selectedMonth)
        : null;
      const nextMonth = monthFromSelection?.month ?? (yearFromSelection ?? years[0]).months[0]?.month ?? null;

      setSelectedYear(nextYear);
      setSelectedMonth(nextMonth ?? null);
    } catch (err: any) {
      setError(err?.message || t('dailyJournal.loadError', { defaultValue: 'Erreur lors du chargement du journal.' }));
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, searchText, selectedAccountId, t, selectedYear, selectedMonth]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    if (editingEntry && editorRef.current) {
      editorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [editingEntry]);

  const handleOpenEntry = async (entryId: number) => {
    setIsEntryLoading(true);
    setNewEntryDate('');
    setIsMobileEditorOpen(true);
    try {
      const entry = await dailyJournalService.getEntry(entryId);
      setEditingEntry(entry);
    } catch (err: any) {
      setError(err?.message || t('dailyJournal.loadError', { defaultValue: 'Erreur lors du chargement du journal.' }));
    } finally {
      setIsEntryLoading(false);
    }
  };

  const handleNewEntry = () => {
    if (!newEntryDate) return;
    setEditingEntry({
      id: 0,
      date: newEntryDate,
      trading_account: selectedAccountId ?? null,
      trading_account_name: null,
      content: '',
      images: [],
      created_at: '',
      updated_at: '',
    });
    setIsMobileEditorOpen(true);
    setNewEntryDate('');
  };

  const handleEntryHover = async (entry: DailyJournalGroupedEntry) => {
    setHoveredEntry(entry);
    try {
      const fullEntry = await dailyJournalService.getEntry(entry.id);
      setHoveredEntryContent(fullEntry.content);
    } catch (err) {
      setHoveredEntryContent(entry.content_preview);
    }
  };

  const handleEntryLeave = () => {
    setHoveredEntry(null);
    setHoveredEntryContent(null);
  };

  const resolvedLanguage = useMemo<LanguageType>(() => {
    const lang = i18n.language?.split('-')[0];
    const supported: LanguageType[] = ['fr', 'en', 'es', 'de', 'it', 'pt', 'ja', 'ko', 'zh'];
    if (lang && supported.includes(lang as LanguageType)) {
      return lang as LanguageType;
    }
    return preferences.language;
  }, [i18n.language, preferences.language]);

  const formatDate = (dateStr: string) => {
    return formatDateLong(dateStr, preferences.date_format, resolvedLanguage, preferences.timezone);
  };

  const monthNames = useMemo(() => getMonthNames(resolvedLanguage), [resolvedLanguage]);
  const hasActiveFilters = Boolean(searchText || startDate || endDate);

  const selectedYearData = useMemo(() => {
    const yearData = groupedYears.find((year) => year.year === selectedYear) || null;
    if (!yearData) return null;
    return {
      ...yearData,
      months: [...yearData.months].sort((a, b) => a.month - b.month)
    };
  }, [groupedYears, selectedYear]);
  const selectedMonthData = selectedYearData?.months.find((month) => month.month === selectedMonth) || null;
  const selectedEntries = useMemo(() => {
    const entries = selectedMonthData?.entries || [];
    return [...entries].sort((a, b) => a.date.localeCompare(b.date));
  }, [selectedMonthData]);

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-full">
      <div className="px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
          <div className="hidden md:block space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-end gap-4">
              <div className="flex-shrink-0 max-w-sm">
                <label className="text-xs text-gray-500">{t('dailyJournal.tradingAccount', { defaultValue: 'Compte de trading' })}</label>
                <div className="mt-1">
                  <AccountSelector
                    value={selectedAccountId}
                    onChange={setSelectedAccountId}
                    allowAllActive
                    hideLabel
                  />
                </div>
              </div>
              <div className="flex-1 min-w-[240px] max-w-[520px]">
                <label className="text-xs text-gray-500">{t('dailyJournal.searchText', { defaultValue: 'Rechercher' })}</label>
                <div className="mt-1">
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder={t('dailyJournal.searchPlaceholder', { defaultValue: 'Rechercher dans les entrées...' })}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 px-3 py-2 h-[42px] placeholder:text-gray-400"
                  />
                </div>
              </div>
              <div className="flex-shrink-0">
                <div className="mt-1 flex flex-wrap items-start gap-2">
                  <div className="w-[180px]">
                    <span className="text-xs text-gray-500">{t('dailyJournal.startDate', { defaultValue: 'Date debut' })}</span>
                    <DateInput
                      value={startDate}
                      onChange={setStartDate}
                      className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 px-3 py-2 pr-10 h-[42px]"
                      max={endDate || undefined}
                      size="sm"
                    />
                  </div>
                  <div className="w-[180px]">
                    <span className="text-xs text-gray-500">{t('dailyJournal.endDate', { defaultValue: 'Date fin' })}</span>
                    <DateInput
                      value={endDate}
                      onChange={setEndDate}
                      className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 px-3 py-2 pr-10 h-[42px]"
                      min={startDate || undefined}
                      size="sm"
                    />
                  </div>
                </div>
              </div>
              <div className="flex-shrink-0 ml-auto min-w-[280px]">
                <label className="text-xs text-gray-500">{t('dailyJournal.newEntry', { defaultValue: 'Nouvelle entree' })}</label>
                <div className="flex items-center gap-2 mt-1">
                  <DateInput
                    value={newEntryDate}
                    onChange={setNewEntryDate}
                    className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 h-[42px]"
                    size="sm"
                  />
                  <button
                    type="button"
                    onClick={handleNewEntry}
                    disabled={!newEntryDate || accountLoading}
                    className={`px-4 h-[42px] rounded-md text-sm w-36 ${
                      newEntryDate
                        ? 'bg-blue-600 dark:bg-blue-500 text-white'
                        : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {accountLoading ? t('dailyJournal.loading', { defaultValue: 'Chargement...' }) : t('dailyJournal.create', { defaultValue: 'Creer' })}
                  </button>
                  <Tooltip
                    content={t('dailyJournal.resetFilters', { defaultValue: 'Réinitialiser filtres' })}
                    position="top"
                    delay={100}
                    disabled={!hasActiveFilters}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSearchText('');
                        setStartDate('');
                        setEndDate('');
                      }}
                      disabled={!hasActiveFilters}
                      aria-label={t('dailyJournal.resetFilters', { defaultValue: 'Réinitialiser filtres' })}
                      className={`h-[42px] w-[42px] min-h-[42px] min-w-[42px] inline-flex items-center justify-center rounded-md border leading-none transition-colors ${
                        hasActiveFilters
                          ? 'text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-500/40 dark:text-blue-300 dark:hover:bg-blue-500/10'
                          : 'text-gray-400 border-gray-200 dark:border-gray-700 cursor-not-allowed'
                      }`}
                    >
                      <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6M20 20v-6h-6M5 19a9 9 0 0014-7M19 5a9 9 0 00-14 7" />
                      </svg>
                    </button>
                  </Tooltip>
                </div>
              </div>
            </div>

          </div>

          <div className="md:hidden space-y-3">
            <details open className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <summary className="px-3 py-2 cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300">
                {t('dailyJournal.tradingAccount', { defaultValue: 'Compte de trading' })}
              </summary>
              <div className="px-3 pb-3">
                <AccountSelector
                  value={selectedAccountId}
                  onChange={setSelectedAccountId}
                  allowAllActive
                  hideLabel
                />
              </div>
            </details>

            <details className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <summary className="px-3 py-2 cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300">
                {t('dailyJournal.searchText', { defaultValue: 'Rechercher' })}
              </summary>
              <div className="px-3 pb-3">
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder={t('dailyJournal.searchPlaceholder', { defaultValue: 'Rechercher dans les entrées...' })}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 px-3 py-2 h-[42px] placeholder:text-gray-400"
                />
              </div>
            </details>

            <details className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <summary className="px-3 py-2 cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300">
                {t('dailyJournal.dateRange', { defaultValue: 'Dates' })}
              </summary>
              <div className="px-3 pb-3 space-y-2">
                <DateInput
                  value={startDate}
                  onChange={setStartDate}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 px-3 py-2 pr-10 h-[42px]"
                  max={endDate || undefined}
                  size="sm"
                />
                <DateInput
                  value={endDate}
                  onChange={setEndDate}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 px-3 py-2 pr-10 h-[42px]"
                  min={startDate || undefined}
                  size="sm"
                />
              </div>
            </details>

            <details className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <summary className="px-3 py-2 cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300">
                {t('dailyJournal.newEntry', { defaultValue: 'Nouvelle entree' })}
              </summary>
              <div className="px-3 pb-3 space-y-2">
                <DateInput
                  value={newEntryDate}
                  onChange={setNewEntryDate}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 h-[42px]"
                  size="sm"
                />
                <button
                  type="button"
                  onClick={handleNewEntry}
                  disabled={!newEntryDate || accountLoading}
                  className={`w-full px-4 py-2 rounded-md text-sm ${
                    newEntryDate
                      ? 'bg-blue-600 dark:bg-blue-500 text-white'
                      : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {accountLoading ? t('dailyJournal.loading', { defaultValue: 'Chargement...' }) : t('dailyJournal.create', { defaultValue: 'Creer' })}
                </button>
              </div>
            </details>

            <button
              type="button"
              onClick={() => {
                setSearchText('');
                setStartDate('');
                setEndDate('');
              }}
              disabled={!hasActiveFilters}
              className={`w-full px-4 py-2 rounded-md text-sm border font-semibold transition-colors ${
                hasActiveFilters
                  ? 'text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-500/40 dark:text-blue-300 dark:hover:bg-blue-500/10'
                  : 'text-gray-400 border-gray-200 dark:border-gray-700 cursor-not-allowed'
              }`}
            >
              {t('dailyJournal.resetFilters', { defaultValue: 'Réinitialiser filtres' })}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 p-4 text-sm text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-10 text-gray-500">{t('dailyJournal.loading', { defaultValue: 'Chargement...' })}</div>
        ) : (
          <>
            {/* Desktop layout */}
            <div className="hidden md:block">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="grid grid-cols-12 gap-4 items-start">
                  <div className="col-span-3">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">{t('dailyJournal.years', { defaultValue: 'Annees' })}</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const currentIndex = groupedYears.findIndex(y => y.year === selectedYear);
                          if (currentIndex > 0) {
                            const newYear = groupedYears[currentIndex - 1];
                            setSelectedYear(newYear.year);
                            setSelectedMonth(newYear.months[0]?.month ?? null);
                          }
                        }}
                        disabled={!selectedYear || groupedYears.findIndex(y => y.year === selectedYear) === 0}
                        className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex gap-2">
                          {groupedYears.map((year) => (
                            <button
                              key={year.year}
                              onClick={() => {
                                setSelectedYear(year.year);
                                setSelectedMonth(year.months[0]?.month ?? null);
                              }}
                              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                                selectedYear === year.year
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                              }`}
                            >
                              {year.year}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const currentIndex = groupedYears.findIndex(y => y.year === selectedYear);
                          if (currentIndex < groupedYears.length - 1) {
                            const newYear = groupedYears[currentIndex + 1];
                            setSelectedYear(newYear.year);
                            setSelectedMonth(newYear.months[0]?.month ?? null);
                          }
                        }}
                        disabled={!selectedYear || groupedYears.findIndex(y => y.year === selectedYear) === groupedYears.length - 1}
                        className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="col-span-9">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">{t('dailyJournal.months', { defaultValue: 'Mois' })}</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (!selectedYearData) return;
                          const currentIndex = selectedYearData.months.findIndex(m => m.month === selectedMonth);
                          if (currentIndex > 0) {
                            setSelectedMonth(selectedYearData.months[currentIndex - 1].month);
                          }
                        }}
                        disabled={!selectedYearData || !selectedMonth || selectedYearData.months.findIndex(m => m.month === selectedMonth) === 0}
                        className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex gap-2">
                          {selectedYearData?.months.map((month) => (
                            <button
                              key={`${selectedYearData?.year}-${month.month}`}
                              onClick={() => setSelectedMonth(month.month)}
                              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                                selectedMonth === month.month
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                              }`}
                            >
                              {monthNames[month.month - 1]}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (!selectedYearData) return;
                          const currentIndex = selectedYearData.months.findIndex(m => m.month === selectedMonth);
                          if (currentIndex < selectedYearData.months.length - 1) {
                            setSelectedMonth(selectedYearData.months[currentIndex + 1].month);
                          }
                        }}
                        disabled={!selectedYearData || !selectedMonth || selectedYearData.months.findIndex(m => m.month === selectedMonth) === selectedYearData.months.length - 1}
                        className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('dailyJournal.entries', { defaultValue: 'Entrees' })}</h3>
                </div>
                {selectedEntries.length === 0 ? (
                  <div className="text-sm text-gray-500 py-8 text-center">{t('dailyJournal.noEntries', { defaultValue: 'Aucun journal' })}</div>
                ) : (
                  <div className="space-y-3">
                    {selectedEntries.map((entry: DailyJournalGroupedEntry) => (
                      <div
                        key={entry.id}
                        className="relative"
                        onMouseEnter={() => handleEntryHover(entry)}
                        onMouseLeave={handleEntryLeave}
                      >
                        <button
                          type="button"
                          onClick={() => handleOpenEntry(entry.id)}
                          className="w-full text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatDate(entry.date)}</p>
                              {entry.trading_account_name && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">{entry.trading_account_name}</p>
                              )}
                            </div>
                            <span className="text-xs text-gray-400">{entry.images_count} image(s)</span>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
                            {entry.content_preview || t('dailyJournal.previewEmpty', { defaultValue: 'Aucun contenu a previsualiser.' })}
                          </p>
                        </button>
                        
                        {hoveredEntry?.id === entry.id && hoveredEntryContent && (
                          <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl shadow-2xl p-4 max-h-96 overflow-y-auto">
                            <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                              {hoveredEntryContent}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Mobile layout */}
            <div className="md:hidden space-y-3">
              {groupedYears.map((year) => (
                <details key={year.year} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                  <summary className="px-4 py-3 cursor-pointer font-semibold text-gray-800 dark:text-gray-200">
                    {year.year}
                  </summary>
                  <div className="px-4 pb-4 space-y-3">
                    {year.months.map((month) => (
                      <details key={`${year.year}-${month.month}`} className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                        <summary className="px-3 py-2 cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300">
                          {monthNames[month.month - 1]} <span className="text-xs text-gray-400">({month.entries.length})</span>
                        </summary>
                        <div className="p-3 space-y-2">
                          {month.entries.length === 0 ? (
                            <div className="text-sm text-gray-500">{t('dailyJournal.noEntries', { defaultValue: 'Aucun journal' })}</div>
                          ) : (
                            month.entries.map((entry) => (
                              <button
                                key={entry.id}
                                type="button"
                                onClick={() => handleOpenEntry(entry.id)}
                                className="w-full text-left rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatDate(entry.date)}</p>
                                  <span className="text-xs text-gray-400">{entry.images_count} image(s)</span>
                                </div>
                                <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
                                  {entry.content_preview || t('dailyJournal.previewEmpty', { defaultValue: 'Aucun contenu a previsualiser.' })}
                                </p>
                              </button>
                            ))
                          )}
                        </div>
                      </details>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </>
        )}

        {editingEntry && (
          <div ref={editorRef}>
            <div className="md:hidden bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-3 gap-2">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {t('dailyJournal.editing', { defaultValue: 'Edition du journal' })} - {formatDate(editingEntry.date)}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsMobileEditorOpen((prev) => !prev)}
                    className="text-xs px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
                  >
                    {isMobileEditorOpen
                      ? t('dailyJournal.collapse', { defaultValue: 'Reduire' })
                      : t('dailyJournal.expand', { defaultValue: 'Ouvrir' })}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingEntry(null)}
                    className="text-xs px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
                  >
                    {t('dailyJournal.close', { defaultValue: 'Fermer' })}
                  </button>
                </div>
              </div>
              {isMobileEditorOpen && (
                <>
                  {isEntryLoading ? (
                    <div className="text-center py-6 text-gray-500">{t('dailyJournal.loading', { defaultValue: 'Chargement...' })}</div>
                  ) : (
                    <DailyJournalEditor
                      date={editingEntry.date}
                      entryId={editingEntry.id || undefined}
                      initialEntry={editingEntry.id ? editingEntry : null}
                      tradingAccountId={editingEntry.trading_account ?? selectedAccountId ?? undefined}
                      compact
                      onSaved={() => {
                        setEditingEntry(null);
                        loadEntries();
                      }}
                      onDeleted={() => {
                        setEditingEntry(null);
                        loadEntries();
                      }}
                    />
                  )}
                </>
              )}
            </div>

            <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {t('dailyJournal.editing', { defaultValue: 'Edition du journal' })} - {formatDate(editingEntry.date)}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingEntry(null)}
                  className="text-xs px-3 py-1 rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
                >
                  {t('dailyJournal.close', { defaultValue: 'Fermer' })}
                </button>
              </div>
              {isEntryLoading ? (
                <div className="text-center py-6 text-gray-500">{t('dailyJournal.loading', { defaultValue: 'Chargement...' })}</div>
              ) : (
                <DailyJournalEditor
                  date={editingEntry.date}
                  entryId={editingEntry.id || undefined}
                  initialEntry={editingEntry.id ? editingEntry : null}
                  tradingAccountId={editingEntry.trading_account ?? selectedAccountId ?? undefined}
                  compact
                  onSaved={() => {
                    setEditingEntry(null);
                    loadEntries();
                  }}
                  onDeleted={() => {
                    setEditingEntry(null);
                    loadEntries();
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyJournalPage;
