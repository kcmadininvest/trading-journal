import React, { useState, useMemo } from 'react';
import { DailyCalendarData, WeeklyCalendarData, AdjacentDayCalendarData } from '../../services/calendar';
import { Tooltip } from '../ui';
import { DayTradesModal } from '../trades/DayTradesModal';
import { StrategyComplianceModal } from '../trades/StrategyComplianceModal';
import { DailyJournalModal } from '../dailyJournal/DailyJournalModal';
import { usePreferences } from '../../hooks/usePreferences';
import { formatCurrencyWithSign } from '../../utils/numberFormat';
import { getMonthNames, getDayNames, LanguageType } from '../../utils/dateFormat';
import { buildCalendarWeeks, AdjacentCell } from './calendarGrid';
import { useTranslation as useI18nTranslation } from 'react-i18next';

// Référence stable pour ne pas invalider le useMemo des semaines à chaque rendu
const NO_ADJACENT_DAYS: AdjacentDayCalendarData[] = [];

interface DailyViewProps {
  year: number;
  month: number;
  dailyData: DailyCalendarData[];
  weeklyData: WeeklyCalendarData[];
  adjacentDays?: AdjacentDayCalendarData[];
  monthlyTotal: number;
  onMonthChange: (year: number, month: number) => void;
  viewType?: 'daily' | 'monthly';
  onViewTypeChange?: (viewType: 'daily' | 'monthly') => void;
  tradingAccount?: number;
  onDataRefresh?: () => void;
  currencySymbol?: string;
}

const DailyView: React.FC<DailyViewProps> = ({
  year,
  month,
  dailyData,
  weeklyData,
  adjacentDays = NO_ADJACENT_DAYS,
  monthlyTotal,
  onMonthChange,
  viewType,
  onViewTypeChange,
  tradingAccount,
  onDataRefresh,
  currencySymbol = '',
}) => {
  const { preferences } = usePreferences();
  const { t, i18n } = useI18nTranslation();
  const [selectedDateForTrades, setSelectedDateForTrades] = useState<string | null>(null);
  const [selectedDateForStrategy, setSelectedDateForStrategy] = useState<string | null>(null);
  const [selectedDateForJournal, setSelectedDateForJournal] = useState<string | null>(null);

  // Aligner mois/jours sur la langue UI (i18n), comme les clés t('calendar:…')
  const resolvedLanguage = useMemo<LanguageType>(() => {
    const lang = i18n.language?.split('-')[0];
    const supported: LanguageType[] = ['fr', 'en', 'es', 'de', 'it', 'pt', 'ja', 'ko', 'zh'];
    if (lang && supported.includes(lang as LanguageType)) {
      return lang as LanguageType;
    }
    return preferences.language;
  }, [i18n.language, preferences.language]);

  const monthNames = useMemo(() => getMonthNames(resolvedLanguage), [resolvedLanguage]);
  const dayNames = useMemo(() => getDayNames(resolvedLanguage), [resolvedLanguage]);

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const currentDay = currentDate.getDate();

  // Semaines construites à partir des données du mois et des jours adjacents
  const weeks = useMemo(
    () => buildCalendarWeeks({ year, month, dailyData, adjacentDays }),
    [year, month, dailyData, adjacentDays]
  );

  // Nombre de trades du mois affiché (hors jours adjacents)
  const monthlyTradeCount = useMemo(
    () => dailyData.reduce((acc, day) => acc + (day.trade_count || 0), 0),
    [dailyData]
  );

  const formatPnl = (pnl: number): string => {
    if (pnl === 0) return '';
    const formatted = formatCurrencyWithSign(pnl, currencySymbol, preferences.number_format, 2);
    return formatted === '-' ? '' : formatted;
  };

  const getPnlColor = (pnl: number): string => {
    if (pnl > 0) return 'text-green-600 dark:text-green-400';
    if (pnl < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-400 dark:text-gray-500';
  };

  const getTransactionFlags = (dayData?: DailyCalendarData) => {
    const hasDeposit = !!dayData?.has_deposit;
    const hasWithdrawal = !!dayData?.has_withdrawal;
    return { hasDeposit, hasWithdrawal, hasBoth: hasDeposit && hasWithdrawal };
  };

  const getDayBgColor = (day: number, pnl: number, dayData?: DailyCalendarData): string => {
    const { hasDeposit, hasWithdrawal } = getTransactionFlags(dayData);
    const isToday = year === currentYear && month === currentMonth && day === currentDay;
    if (isToday) {
      return pnl > 0 ? 'bg-green-100 dark:bg-green-900/30 border-2 border-blue-500 dark:border-blue-400' :
             pnl < 0 ? 'bg-red-100 dark:bg-red-900/30 border-2 border-blue-500 dark:border-blue-400' :
             'bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-500 dark:border-blue-400';
    }
    if (pnl > 0) return 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30';
    if (pnl < 0) return 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30';
    if (hasWithdrawal && !hasDeposit) {
      return 'bg-amber-50 dark:bg-amber-900/25 hover:bg-amber-100 dark:hover:bg-amber-900/35';
    }
    if (hasDeposit && !hasWithdrawal) {
      return 'bg-indigo-50 dark:bg-indigo-900/25 hover:bg-indigo-100 dark:hover:bg-indigo-900/35';
    }
    return 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700';
  };

  const getMobileDayClasses = (
    dayData: DailyCalendarData | undefined,
    pnl: number,
    isToday: boolean
  ): string => {
    const { hasDeposit, hasWithdrawal } = getTransactionFlags(dayData);
    const classes: string[] = [];

    if (isToday) {
      classes.push('bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-500 dark:border-blue-400');
    } else if (pnl === 0) {
      if (hasWithdrawal && !hasDeposit) {
        classes.push('bg-amber-50 dark:bg-amber-900/25 hover:bg-amber-100 dark:hover:bg-amber-900/35');
      } else if (hasDeposit && !hasWithdrawal) {
        classes.push('bg-indigo-50 dark:bg-indigo-900/25 hover:bg-indigo-100 dark:hover:bg-indigo-900/35');
      } else {
        classes.push('bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700');
      }
    } else {
      classes.push('bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700');
    }

    if (pnl > 0) {
      classes.push('border-l-4 border-green-500');
    } else if (pnl < 0) {
      classes.push('border-l-4 border-red-500');
    }

    return classes.join(' ');
  };

  const getStrategyStatusColor = (status?: 'compliant' | 'non_compliant' | 'partial' | 'unknown'): string => {
    switch (status) {
      case 'compliant':
        return 'bg-green-500';
      case 'non_compliant':
        return 'bg-red-500';
      case 'partial':
        return 'bg-orange-500';
      default:
        return 'bg-gray-400';
    }
  };

  const formatDateForApi = (day: number): string => {
    // Formater la date sans passer par toISOString pour éviter les problèmes de timezone
    const monthStr = String(month).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    return `${year}-${monthStr}-${dayStr}`;
  };

  const handleTradesClick = (day: number) => {
    setSelectedDateForTrades(formatDateForApi(day));
  };

  const handleStrategyClick = (day: number) => {
    setSelectedDateForStrategy(formatDateForApi(day));
  };

  const handleJournalClick = (day: number) => {
    setSelectedDateForJournal(formatDateForApi(day));
  };

  const formatTransactionAmount = (raw: string | undefined, sign: '+' | '-'): string => {
    const n = parseFloat(raw ?? '0');
    const signed = sign === '-' ? -Math.abs(n) : Math.abs(n);
    return formatCurrencyWithSign(signed, currencySymbol, preferences.number_format, 2);
  };

  const getDepositTooltip = (dayData: DailyCalendarData): string => {
    const count = dayData.deposit_count ?? 0;
    const amount = formatTransactionAmount(dayData.deposit_total, '+');
    if (count <= 1) {
      return t('calendar:depositOnDay', { amount });
    }
    return t('calendar:depositsOnDay', { count, amount });
  };

  const getWithdrawalTooltip = (dayData: DailyCalendarData): string => {
    const count = dayData.withdrawal_count ?? 0;
    const amount = formatTransactionAmount(dayData.withdrawal_total, '-');
    if (count <= 1) {
      return t('calendar:withdrawalOnDay', { amount });
    }
    return t('calendar:withdrawalsOnDay', { count, amount });
  };

  const depositTransactionIconClassName =
    'p-0.5 sm:p-1 rounded-md bg-indigo-100 dark:bg-indigo-900/40 ring-1 ring-indigo-300/80 dark:ring-indigo-600/40 text-indigo-600 dark:text-indigo-400 flex-shrink-0 animate-pulse motion-reduce:animate-none';
  const withdrawalTransactionIconClassName =
    'p-0.5 sm:p-1 rounded-md bg-amber-100 dark:bg-amber-900/40 ring-1 ring-amber-300/80 dark:ring-amber-600/40 text-amber-700 dark:text-amber-400 flex-shrink-0 animate-pulse motion-reduce:animate-none';
  const transactionIconSvgClassName = 'w-4 h-4 sm:w-5 sm:h-5';

  const renderDepositTransactionIcon = (ariaLabel?: string) => (
    <span className={depositTransactionIconClassName} aria-label={ariaLabel} aria-hidden={ariaLabel ? undefined : true}>
      <svg className={transactionIconSvgClassName} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M7.5 12L12 16.5 16.5 12M12 7.5v9"
        />
      </svg>
    </span>
  );

  const renderWithdrawalTransactionIcon = (ariaLabel?: string) => (
    <span className={withdrawalTransactionIconClassName} aria-label={ariaLabel} aria-hidden={ariaLabel ? undefined : true}>
      <svg className={transactionIconSvgClassName} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 7.5 7.5 12M12 7.5v9"
        />
      </svg>
    </span>
  );

  const renderDayTransactionIcons = (dayData: DailyCalendarData | undefined) => {
    if (!dayData) return null;
    return (
      <>
        {dayData.has_deposit ? (
          <Tooltip content={getDepositTooltip(dayData)} position="top">
            {renderDepositTransactionIcon(t('calendar:depositIconLabel'))}
          </Tooltip>
        ) : null}
        {dayData.has_withdrawal ? (
          <Tooltip content={getWithdrawalTooltip(dayData)} position="top">
            {renderWithdrawalTransactionIcon(t('calendar:withdrawalIconLabel'))}
          </Tooltip>
        ) : null}
      </>
    );
  };

  const handleCloseTradesModal = () => {
    setSelectedDateForTrades(null);
  };

  const handleCloseStrategyModal = (saved?: boolean) => {
    setSelectedDateForStrategy(null);
    if (saved && onDataRefresh) {
      onDataRefresh();
    }
  };

  const handleCloseJournalModal = () => {
    setSelectedDateForJournal(null);
    if (onDataRefresh) {
      onDataRefresh();
    }
  };

  const handleStrategyClickFromTrades = (date: string) => {
    setSelectedDateForTrades(null);
    setSelectedDateForStrategy(date);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    let newYear = year;
    let newMonth = month;

    if (direction === 'prev') {
      newMonth--;
      if (newMonth < 1) {
        newMonth = 12;
        newYear--;
      }
    } else {
      newMonth++;
      if (newMonth > 12) {
        newMonth = 1;
        newYear++;
      }
    }

    onMonthChange(newYear, newMonth);
  };

  const goToToday = () => {
    onMonthChange(currentYear, currentMonth);
  };

  const goToAdjacentMonth = (cellYear: number, cellMonth: number) => {
    onMonthChange(cellYear, cellMonth);
  };

  const getAdjacentMonthLabel = (cellYear: number, cellMonth: number): string => {
    return t('calendar:goToMonth', { month: monthNames[cellMonth - 1], year: cellYear });
  };

  const getAdjacentCellProps = (cell: AdjacentCell) => {
    const label = getAdjacentMonthLabel(cell.year, cell.month);
    return {
      role: 'button' as const,
      tabIndex: 0,
      title: label,
      'aria-label': label,
      onClick: () => goToAdjacentMonth(cell.year, cell.month),
      onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          goToAdjacentMonth(cell.year, cell.month);
        }
      },
    };
  };

  const renderTradeCountBadge = (tradeCount: number, className: string) => (
    <Tooltip content={`${tradeCount} ${tradeCount > 1 ? t('calendar:trades') : t('calendar:trade')}`} position="top">
      <span className={className}>{tradeCount}</span>
    </Tooltip>
  );

  // Jour du mois précédent/suivant (desktop) : grisé, PnL + badge, clic = navigation vers ce mois
  const renderDesktopAdjacentCell = (cell: AdjacentCell, colIndex: number) => (
    <div
      key={colIndex}
      {...getAdjacentCellProps(cell)}
      className={`h-24 sm:h-32 p-1 sm:p-2 cursor-pointer bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors ${
        colIndex < 6 ? 'border-r border-gray-300 dark:border-gray-600' :
        colIndex === 6 ? 'border-r-2 border-gray-400 dark:border-gray-500' : ''
      }`}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-1 gap-0.5 sm:gap-1">
          <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">{cell.day}</span>
          {cell.tradeCount > 0 && renderTradeCountBadge(
            cell.tradeCount,
            'text-[10px] sm:text-xs bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-1 sm:px-1.5 py-0.5 rounded-full cursor-help flex-shrink-0'
          )}
        </div>
        {cell.pnl !== 0 && (
          <div className={`text-xs sm:text-base font-semibold mt-auto ${getPnlColor(cell.pnl)} break-words`}>
            {formatPnl(cell.pnl)}
          </div>
        )}
      </div>
    </div>
  );

  const renderMobileAdjacentDay = (cell: AdjacentCell) => {
    const date = new Date(cell.year, cell.month - 1, cell.day);
    const dayOfWeek = date.getDay();
    const dayName = dayNames[dayOfWeek];
    const pnl = cell.pnl;
    const tradeCount = cell.tradeCount;

    return (
      <div
        key={cell.date}
        {...getAdjacentCellProps(cell)}
        className="px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-700/50 opacity-70 hover:opacity-100 cursor-pointer"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex flex-col items-center min-w-[50px]">
              <span className="text-lg font-bold text-gray-500 dark:text-gray-400">{cell.day}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 uppercase">{dayName}</span>
            </div>
            {pnl !== 0 && (
              <div className={`text-base font-semibold ${getPnlColor(pnl)} flex-1`}>{formatPnl(pnl)}</div>
            )}
            {tradeCount > 0 && renderTradeCountBadge(
              tradeCount,
              'text-xs bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-full'
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex flex-col gap-4">
        {/* Sélecteur de vue à gauche */}
        {onViewTypeChange && (
          <div className="inline-flex self-start rounded-md shadow-sm" role="group">
            <button
              type="button"
              onClick={() => onViewTypeChange('daily')}
              className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-l-lg border ${
                viewType === 'daily'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {t('calendar:daily')}
            </button>
            <button
              type="button"
              onClick={() => onViewTypeChange('monthly')}
              className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-r-lg border-t border-r border-b ${
                viewType === 'monthly'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {t('calendar:monthly')}
            </button>
          </div>
        )}

        {/* Bandeau : navigation de période + total du mois (sous le sélecteur de vue) */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        {/* Navigation de période centrée */}
        <div className="flex items-center justify-center space-x-2 sm:space-x-4">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400"
            aria-label={t('calendar:previousMonth')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <h2 className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-gray-100 text-center">
            {monthNames[month - 1]} {year}
          </h2>

          <button
            onClick={() => navigateMonth('next')}
            className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400"
            aria-label={t('calendar:nextMonth')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="hidden sm:block h-8 w-px bg-gray-200 dark:bg-gray-700" aria-hidden />

        {/* Total du mois : hors colonne hebdo, car les semaines incluent les jours des mois voisins */}
        <div
          className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1"
          title={t('calendar:monthTotalExcludesAdjacent')}
        >
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t('calendar:total')}
          </span>
          <span className={`text-lg sm:text-xl font-bold ${getPnlColor(monthlyTotal)}`}>
            {formatCurrencyWithSign(monthlyTotal, currencySymbol, preferences.number_format, 2)}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {monthlyTradeCount} {monthlyTradeCount > 1 ? t('calendar:trades') : t('calendar:trade')}
          </span>
        </div>

        {(year !== currentYear || month !== currentMonth) && (
          <button
            onClick={goToToday}
            className="px-3 sm:px-4 py-2 text-xs sm:text-sm bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            {t('calendar:today')}
          </button>
        )}
        </div>
      </div>

      {/* Calendrier */}
      <div className="md:bg-white md:dark:bg-gray-800 md:rounded-lg md:shadow md:overflow-hidden md:border md:border-gray-200 md:dark:border-gray-700">
        {/* Vue grille pour desktop (md et plus) */}
        <div className="hidden md:block overflow-x-auto">
          {/* En-têtes des jours */}
          <div className="grid grid-cols-8 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 min-w-[640px]">
            {dayNames.map((dayName, index) => (
              <div
                key={index}
                className={`px-1 sm:px-2 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 ${
                  index < 6 ? 'border-r border-gray-200 dark:border-gray-600' : index === 6 ? 'border-r-2 border-gray-400 dark:border-gray-500' : ''
                }`}
              >
                {dayName}
              </div>
            ))}
            <div className="px-1 sm:px-2 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 bg-blue-50 dark:bg-blue-900/30">
              {t('calendar:weeklyPnL')}
            </div>
          </div>

          {/* Grille du calendrier */}
          <div className="min-w-[640px]">
            {weeks.map(({ cells: weekCells, weeklyPnl }, rowIndex) => {
            // weeklyPnl inclut les jours adjacents (mois précédent/suivant) affichés sur la ligne

            return (
              <div key={rowIndex} className={`grid grid-cols-8 ${rowIndex > 0 ? 'border-t border-gray-200 dark:border-gray-700' : ''}`}>
                {weekCells.map((cell, colIndex) => {
                  // Jour hors mois : cellule grisée avec PnL/trades, clic = navigation
                  if (cell.kind === 'adjacent') {
                    return renderDesktopAdjacentCell(cell, colIndex);
                  }

                  const dayNumber = cell.day;
                  const dayData = cell.data;
                  const pnl = dayData?.pnl || 0;
                  const tradeCount = dayData?.trade_count || 0;
                  const isToday = year === currentYear && month === currentMonth && dayNumber === currentDay;

                  return (
                    <div
                      key={colIndex}
                      className={`h-24 sm:h-32 p-1 sm:p-2 cursor-pointer ${
                        colIndex < 6 ? 'border-r border-gray-200 dark:border-gray-700' : 
                        colIndex === 6 ? 'border-r-2 border-gray-400 dark:border-gray-500' : ''
                      } ${getDayBgColor(dayNumber, pnl, dayData)} ${isToday ? 'ring-2 ring-blue-500 dark:ring-blue-400 ring-inset' : ''}`}
                    >
                      {/* Affichage normal pour tous les jours (y compris samedi) */}
                      <div className="flex flex-col h-full relative">
                        {/* Pastille de statut de stratégie - centrée dans la cellule */}
                        {dayData?.strategy_compliance_status && dayData.strategy_compliance_status !== 'unknown' && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <Tooltip 
                              content={
                                dayData.strategy_compliance_status === 'compliant' ? t('calendar:strategyRespected') :
                                dayData.strategy_compliance_status === 'non_compliant' ? t('calendar:strategyNotRespected') :
                                dayData.strategy_compliance_status === 'partial' ? t('calendar:strategyPartiallyRespected') :
                                ''
                              }
                              position="top"
                            >
                              <div
                                className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full ${getStrategyStatusColor(dayData.strategy_compliance_status)} cursor-help pointer-events-auto ${
                                  dayData.strategy_compliance_status === 'compliant' ? 'animate-pulse' : ''
                                }`}
                              />
                            </Tooltip>
                          </div>
                        )}
                        <div className="flex items-center justify-between mb-1 flex-wrap gap-0.5 sm:gap-1 z-10">
                          <span className={`text-xs sm:text-sm font-medium ${isToday ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-700 dark:text-gray-300'}`}>
                            {dayNumber}
                          </span>
                          <div className="flex items-center gap-0.5 sm:gap-1 flex-wrap">
                            {/* Actions pour les jours avec trades */}
                            {tradeCount > 0 && (
                              <>
                                <Tooltip content={t('calendar:viewDayTrades')} position="top">
                                  <button
                                    onClick={() => handleTradesClick(dayNumber)}
                                    className="p-0.5 sm:p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors flex-shrink-0"
                                    aria-label={t('calendar:viewTrades')}
                                  >
                                    <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                  </button>
                                </Tooltip>
                                <Tooltip content={t('calendar:manageStrategyCompliance')} position="top">
                                  <button
                                    onClick={() => handleStrategyClick(dayNumber)}
                                    className="p-0.5 sm:p-1 rounded hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-400 transition-colors flex-shrink-0"
                                    aria-label={t('calendar:manageStrategy')}
                                  >
                                    <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  </button>
                                </Tooltip>
                              </>
                            )}
                            {dayData?.has_journal_entry && (
                              <Tooltip content={t('calendar:viewJournal', { defaultValue: 'Voir le journal' })} position="top">
                                <button
                                  onClick={() => handleJournalClick(dayNumber)}
                                  className="p-0.5 sm:p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 dark:text-amber-400 transition-colors flex-shrink-0"
                                  aria-label={t('calendar:viewJournal', { defaultValue: 'Voir le journal' })}
                                >
                                  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h10a2 2 0 012 2v11a1 1 0 01-1 1H8a2 2 0 01-2-2V8a2 2 0 012-2z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6h-1a2 2 0 00-2 2v11a1 1 0 001 1h1" />
                                  </svg>
                                </button>
                              </Tooltip>
                            )}
                            {renderDayTransactionIcons(dayData)}
                            {/* Action pour les jours sans trades - permettre de cliquer pour gérer la compliance */}
                            {tradeCount === 0 && (
                              <Tooltip content={t('calendar:manageStrategyCompliance', { defaultValue: 'Gérer le respect de la stratégie' })} position="top">
                                <button
                                  onClick={() => handleStrategyClick(dayNumber)}
                                  className="p-0.5 sm:p-1 rounded hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-400 transition-colors flex-shrink-0"
                                  aria-label={t('calendar:manageStrategy')}
                                >
                                  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </button>
                              </Tooltip>
                            )}
                            {/* Badge du nombre de trades en dernier */}
                            {tradeCount > 0 && (
                              <Tooltip 
                                content={`${tradeCount} ${tradeCount > 1 ? t('calendar:trades') : t('calendar:trade')}`} 
                                position="top"
                              >
                                <span className="text-[10px] sm:text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-1 sm:px-1.5 py-0.5 rounded-full cursor-help flex-shrink-0">
                                  {tradeCount}
                                </span>
                              </Tooltip>
                            )}
                          </div>
                        </div>

                        {pnl !== 0 && (
                          <div className={`text-xs sm:text-base font-semibold mt-auto ${getPnlColor(pnl)} z-10 break-words`}>
                            {formatPnl(pnl)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                
                {/* Colonne supplémentaire pour le total hebdomadaire */}
                <div
                  className={`h-24 sm:h-32 p-1 sm:p-2 bg-blue-50 dark:bg-blue-900/30 ${weeklyPnl > 0 ? 'bg-green-50 dark:bg-green-900/20' : weeklyPnl < 0 ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                >
                  <div className="flex flex-col h-full justify-center items-center">
                    {weeklyPnl !== 0 && (
                      <div className={`text-xs sm:text-base font-semibold text-center ${getPnlColor(weeklyPnl)}`}>
                        {formatPnl(weeklyPnl)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>

        {/* Vue liste pour mobile (moins de md) */}
        <div className="md:hidden space-y-3">
            {weeks.map(({ cells: weekCells, weeklyPnl }, rowIndex) => {
              return (
              <div key={rowIndex} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  {/* En-tête de semaine */}
                  <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                        {t('calendar:week')} {rowIndex + 1}
                      </span>
                      {weeklyPnl !== 0 && (
                        <span className={`text-sm font-bold ${getPnlColor(weeklyPnl)}`}>
                          {formatPnl(weeklyPnl)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Liste des jours de la semaine */}
                <div className="space-y-1 p-2">
                    {weekCells.map((cell) => {
                      // Liste mobile : jours adjacents affichés seulement s'ils portent des trades
                      if (cell.kind === 'adjacent') {
                        return cell.tradeCount > 0 ? renderMobileAdjacentDay(cell) : null;
                      }
                      const dayNumber = cell.day;
                      const dayData = cell.data;
                      const pnl = dayData?.pnl || 0;
                      const tradeCount = dayData?.trade_count || 0;
                      const isToday = year === currentYear && month === currentMonth && dayNumber === currentDay;
                      const date = new Date(year, month - 1, dayNumber);
                      const dayOfWeek = date.getDay();
                      const dayName = dayNames[dayOfWeek];

                      return (
                        <div
                          key={dayNumber}
                          className={`px-4 py-3 rounded-lg ${getMobileDayClasses(dayData, pnl, isToday)}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              {/* Numéro du jour et nom */}
                              <div className="flex flex-col items-center min-w-[50px]">
                                <span className={`text-lg font-bold ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                  {dayNumber}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400 uppercase">
                                  {dayName}
                                </span>
                                {dayData?.has_journal_entry && (
                                  <Tooltip content={t('calendar:viewJournal', { defaultValue: 'Voir le journal' })} position="top">
                                    <button
                                      onClick={() => handleJournalClick(dayNumber)}
                                      className="mt-1 p-1 rounded-full hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 dark:text-amber-400 transition-colors"
                                      aria-label={t('calendar:viewJournal', { defaultValue: 'Voir le journal' })}
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h10a2 2 0 012 2v11a1 1 0 01-1 1H8a2 2 0 01-2-2V8a2 2 0 012-2z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6h-1a2 2 0 00-2 2v11a1 1 0 001 1h1" />
                                      </svg>
                                    </button>
                                  </Tooltip>
                                )}
                              </div>

                              {/* PnL */}
                              {pnl !== 0 && (
                                <div className={`text-base font-semibold ${getPnlColor(pnl)} flex-1`}>
                                  {formatPnl(pnl)}
                                </div>
                              )}

                              {/* Badge de trades et actions */}
                              <div className="flex items-center gap-2">
                                {renderDayTransactionIcons(dayData)}
                                {tradeCount > 0 && (
                                  <>
                                    {/* Pastille de statut de stratégie */}
                                    {dayData?.strategy_compliance_status && dayData.strategy_compliance_status !== 'unknown' && (
                                      <Tooltip 
                                        content={
                                          dayData.strategy_compliance_status === 'compliant' ? t('calendar:strategyRespected') :
                                          dayData.strategy_compliance_status === 'non_compliant' ? t('calendar:strategyNotRespected') :
                                          dayData.strategy_compliance_status === 'partial' ? t('calendar:strategyPartiallyRespected') :
                                          ''
                                        }
                                        position="top"
                                      >
                                        <div
                                          className={`w-4 h-4 rounded-full ${getStrategyStatusColor(dayData.strategy_compliance_status)} ${
                                            dayData.strategy_compliance_status === 'compliant' ? 'animate-pulse' : ''
                                          }`}
                                        />
                                      </Tooltip>
                                    )}

                                    {/* Badge nombre de trades */}
                                    <Tooltip 
                                      content={`${tradeCount} ${tradeCount > 1 ? t('calendar:trades') : t('calendar:trade')}`} 
                                      position="top"
                                    >
                                      <span className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-full">
                                        {tradeCount}
                                      </span>
                                    </Tooltip>

                                    {/* Actions pour les jours avec trades */}
                                    {tradeCount > 0 && (
                                      <div className="flex items-center gap-1">
                                        <Tooltip content={t('calendar:viewDayTrades')} position="top">
                                          <button
                                            onClick={() => handleTradesClick(dayNumber)}
                                            className="p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors"
                                            aria-label={t('calendar:viewTrades')}
                                          >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                          </button>
                                        </Tooltip>
                                        <Tooltip content={t('calendar:manageStrategyCompliance')} position="top">
                                          <button
                                            onClick={() => handleStrategyClick(dayNumber)}
                                            className="p-2 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-400 transition-colors"
                                            aria-label={t('calendar:manageStrategy')}
                                          >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                          </button>
                                        </Tooltip>
                                      </div>
                                    )}
                                    {/* Action pour les jours sans trades */}
                                    {tradeCount === 0 && (
                                      <Tooltip content={t('calendar:manageStrategyCompliance', { defaultValue: 'Gérer le respect de la stratégie' })} position="top">
                                        <button
                                          onClick={() => handleStrategyClick(dayNumber)}
                                          className="p-2 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-400 transition-colors"
                                          aria-label={t('calendar:manageStrategy')}
                                        >
                                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          </svg>
                                        </button>
                                      </Tooltip>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Modales */}
      {selectedDateForTrades && (
        <DayTradesModal
          open={true}
          date={selectedDateForTrades}
          onClose={handleCloseTradesModal}
          tradingAccount={tradingAccount}
          onStrategyClick={handleStrategyClickFromTrades}
          onJournalSaved={onDataRefresh}
        />
      )}

      {selectedDateForStrategy && (
        <StrategyComplianceModal
          open={true}
          date={selectedDateForStrategy}
          onClose={handleCloseStrategyModal}
          tradingAccount={tradingAccount}
          dayBasis="entered_at"
        />
      )}

      {selectedDateForJournal && (
        <DailyJournalModal
          open={true}
          date={selectedDateForJournal}
          tradingAccountId={tradingAccount}
          onClose={handleCloseJournalModal}
        />
      )}
    </div>
  );
};

export default DailyView;

