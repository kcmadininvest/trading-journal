import React, { useState, useEffect, useCallback, useMemo } from 'react';
import MonthlyView from '../components/calendar/MonthlyView';
import DailyView from '../components/calendar/DailyView';
import { AccountSelector } from '../components/accounts/AccountSelector';
import { useAccountNumberVisibility } from '../hooks/useAccountNumberVisibility';
import { useTradingAccount } from '../contexts/TradingAccountContext';
import { ImportTradesModal } from '../components/trades/ImportTradesModal';
import {
  calendarService,
  CalendarMonthResponse,
  CalendarYearlyResponse,
  CalendarWeeklyYearlyResponse,
} from '../services/calendar';
import { tradingAccountsService, TradingAccount } from '../services/tradingAccounts';
import { currenciesService, Currency } from '../services/currencies';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { PageShell } from '../components/layout';
import { PnlBasisToggle } from '../components/common/PnlBasisToggle';
import { TopStepSyncControls } from '../components/accounts/TopStepSyncControls';
import { usePreferences } from '../hooks/usePreferences';
import { parsePnlDisplayMode } from '../utils/pnlDisplay';

type ViewType = 'daily' | 'monthly';

const CalendarPage: React.FC = () => {
  const { t } = useI18nTranslation();
  const { preferences } = usePreferences();
  const pnlDisplayMode = parsePnlDisplayMode(preferences.pnl_display);
  const [viewType, setViewType] = useState<ViewType>('daily');
  const [isLoading, setIsLoading] = useState(true);
  const { selectedAccountId: selectedAccount, setSelectedAccountId: setSelectedAccount, loading: accountLoading } = useTradingAccount();
  const hideAccountNumber = useAccountNumberVisibility();
  const [selectedAccountData, setSelectedAccountData] = useState<TradingAccount | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // État pour la vue quotidienne
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [dailyData, setDailyData] = useState<CalendarMonthResponse | null>(null);

  // État pour la vue mensuelle
  const [yearlyYear, setYearlyYear] = useState(new Date().getFullYear());
  const [yearlyMonthlyData, setYearlyMonthlyData] = useState<CalendarYearlyResponse | null>(null);
  const [yearlyWeeklyData, setYearlyWeeklyData] = useState<CalendarWeeklyYearlyResponse | null>(null);

  // Charger les données pour la vue quotidienne
  const loadDailyData = useCallback(async () => {
    const tradingAccount = selectedAccount && selectedAccount > 0 ? selectedAccount : undefined;
    setIsLoading(true);
    setError(null);
    try {
      const data = await calendarService.getMonthData(
        currentYear,
        currentMonth,
        tradingAccount,
        pnlDisplayMode
      );
      setDailyData(data);
    } catch (err) {
      setError(t('calendar:errorLoadingMonthlyData'));
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [currentYear, currentMonth, selectedAccount, t, pnlDisplayMode]);

  // Charger les données pour la vue mensuelle
  const loadYearlyData = useCallback(async (year: number, tradingAccount?: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const [monthlyData, weeklyData] = await Promise.all([
        calendarService.getYearlyMonthlyData(year, tradingAccount, pnlDisplayMode),
        calendarService.getYearlyWeeklyData(year, tradingAccount, pnlDisplayMode),
      ]);
      setYearlyMonthlyData(monthlyData);
      setYearlyWeeklyData(weeklyData);
    } catch (err) {
      setError(t('calendar:errorLoadingYearlyData'));
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [t, pnlDisplayMode]);

  // Charger les devises
  useEffect(() => {
    const loadCurrencies = async () => {
      try {
        const list = await currenciesService.list();
        setCurrencies(list);
      } catch (err) {
        console.error('Erreur lors du chargement des devises', err);
      }
    };
    loadCurrencies();
  }, []);

  // Récupérer le compte sélectionné pour obtenir sa devise
  useEffect(() => {
    const loadAccount = async () => {
      if (!selectedAccount || selectedAccount === 0) {
        setSelectedAccountData(null);
        return;
      }
      try {
        const account = await tradingAccountsService.get(selectedAccount);
        setSelectedAccountData(account);
      } catch (err) {
        console.error('Erreur lors du chargement du compte', err);
        setSelectedAccountData(null);
      }
    };
    loadAccount();
  }, [selectedAccount]);

  // Obtenir le symbole de devise
  const currencySymbol = useMemo(() => {
    if (!selectedAccountData || !currencies.length) return '';
    const currency = currencies.find(c => c.code === selectedAccountData.currency);
    return currency?.symbol || '';
  }, [selectedAccountData, currencies]);

  // Charger les données quand la vue change ou quand les dates changent
  useEffect(() => {
    // Attendre que le compte soit chargé avant de charger les données
    if (accountLoading) {
      return;
    }

    const tradingAccount = selectedAccount && selectedAccount > 0 ? selectedAccount : undefined;
    if (viewType === 'daily') {
      loadDailyData();
    } else {
      loadYearlyData(yearlyYear, tradingAccount);
    }
  }, [viewType, currentYear, currentMonth, yearlyYear, selectedAccount, accountLoading, loadDailyData, loadYearlyData]);

  const handleMonthChange = (year: number, month: number) => {
    setCurrentYear(year);
    setCurrentMonth(month);
  };

  const handleYearChange = (year: number) => {
    setYearlyYear(year);
  };

  const handleMonthClick = (month: number) => {
    // Basculer vers la vue quotidienne avec le mois sélectionné
    setCurrentYear(yearlyYear);
    setCurrentMonth(month);
    setViewType('daily');
  };

  return (
    <PageShell>
        {/* Filtres — même disposition que Stratégies (carte + compte + toggle aligné bas) */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex min-w-0 flex-col lg:flex-row lg:items-end gap-4">
            <div className="w-full min-w-0 lg:w-auto lg:flex-shrink-0">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('common:tradingAccount')}
              </label>
              <AccountSelector
                value={selectedAccount}
                onChange={setSelectedAccount}
                hideLabel
                hideAccountNumber={hideAccountNumber}
              />
            </div>
            <div className="flex w-full flex-wrap items-end gap-2 lg:w-auto lg:flex-shrink-0">
              <TopStepSyncControls
                iconOnly="narrow"
                accountId={selectedAccount}
                onSynced={() => {
                  if (viewType === 'daily') {
                    void loadDailyData();
                  } else {
                    void loadYearlyData(currentYear, selectedAccount ?? undefined);
                  }
                }}
              />
              <PnlBasisToggle />
            </div>
          </div>
        </div>

        {/* Affichage des erreurs */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Contenu du calendrier */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">{t('calendar:loading')}</p>
            </div>
          </div>
        ) : viewType === 'daily' && dailyData ? (
          <DailyView
            year={currentYear}
            month={currentMonth}
            dailyData={dailyData.daily_data}
            weeklyData={dailyData.weekly_data}
            monthlyTotal={dailyData.monthly_total}
            onMonthChange={handleMonthChange}
            viewType={viewType}
            onViewTypeChange={setViewType}
            tradingAccount={selectedAccount ?? undefined}
            onDataRefresh={loadDailyData}
            currencySymbol={currencySymbol}
          />
        ) : viewType === 'monthly' && yearlyMonthlyData && yearlyWeeklyData ? (
          <MonthlyView
            year={yearlyYear}
            monthlyData={yearlyMonthlyData.monthly_data}
            weeklyData={yearlyWeeklyData.weekly_data}
            yearlyTotal={yearlyMonthlyData.yearly_total}
            onYearChange={handleYearChange}
            onMonthClick={handleMonthClick}
            viewType={viewType}
            onViewTypeChange={setViewType}
            currencySymbol={currencySymbol}
          />
        ) : null}
      <ImportTradesModal 
        open={showImport} 
        onClose={(done) => {
          setShowImport(false);
          if (done) {
            // Recharger les données du calendrier après import
            if (viewType === 'daily') {
              loadDailyData();
            } else {
              loadYearlyData(yearlyYear, selectedAccount ?? undefined);
            }
          }
        }} 
      />
    </PageShell>
  );
};

export default CalendarPage;

