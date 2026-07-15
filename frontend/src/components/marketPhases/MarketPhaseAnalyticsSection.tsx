import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomSelect } from '../common/CustomSelect';
import { replayPrimaryButtonClass, replaySecondaryButtonClass } from '../replay/replayStyles';
import { usePreferences } from '../../hooks/usePreferences';
import { useTradingAccount } from '../../contexts/useTradingAccount';
import {
  marketPhasesService,
  MarketInstrument,
  PeriodProfile,
  AssetMarketProfile,
} from '../../services/marketPhases';
import { formatNumber, formatCurrency } from '../../utils/numberFormat';
import { DeleteConfirmModal } from '../ui';
import { TradingActivityLedgerDeleteAction } from '../tradingActivity/TradingActivityLedgerDeleteAction';

type Tab = 'asset' | 'performance';

type PeriodToDelete = { key: string; label: string };

export interface MarketPhaseAnalyticsSectionProps {
  dateFrom?: string;
  dateTo?: string;
  tradingAccountId?: number | null;
  currencySymbol?: string;
}

export const MarketPhaseAnalyticsSection: React.FC<MarketPhaseAnalyticsSectionProps> = ({
  dateFrom,
  dateTo,
  tradingAccountId,
  currencySymbol = '',
}) => {
  const { t } = useTranslation(['marketPhases', 'common']);
  const { preferences } = usePreferences();
  const { selectedAccountId } = useTradingAccount();
  const accountId = tradingAccountId ?? selectedAccountId ?? undefined;
  const [tab, setTab] = useState<Tab>('asset');
  const [instruments, setInstruments] = useState<MarketInstrument[]>([]);
  const [instrumentKey, setInstrumentKey] = useState('nasdaq');
  const [assetProfiles, setAssetProfiles] = useState<AssetMarketProfile[]>([]);
  const [ranking, setRanking] = useState<PeriodProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [periodToDelete, setPeriodToDelete] = useState<PeriodToDelete | null>(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    marketPhasesService
      .getInstruments(accountId ?? undefined)
      .then((r) => {
        setInstruments(r.instruments);
        if (r.instruments.length > 0) {
          setInstrumentKey((current) =>
            r.instruments.some((i) => i.key === current) ? current : r.instruments[0].key,
          );
        }
      })
      .catch(() => undefined);
  }, [accountId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSelectedKeys([]);
    const params = {
      instrument_key: instrumentKey,
      trading_account: accountId,
      date_from: dateFrom,
      date_to: dateTo,
    };
    const p =
      tab === 'asset'
        ? marketPhasesService.getAssetProfiles(params).then((r) => {
            if (!cancelled) {
              setAssetProfiles('profiles' in r ? r.profiles : [r as AssetMarketProfile]);
            }
          })
        : marketPhasesService.getRanking(params).then((r) => {
            if (!cancelled) setRanking(r.ranking);
          });
    p.finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [tab, instrumentKey, accountId, dateFrom, dateTo]);

  const visibleRows = tab === 'asset' ? assetProfiles : ranking;
  const visibleKeys = useMemo(() => visibleRows.map((row) => row.period.key), [visibleRows]);
  const allSelected =
    visibleKeys.length > 0 && visibleKeys.every((key) => selectedKeys.includes(key));

  const formatPct = (value: number) =>
    `${formatNumber(value, 1, preferences.number_format)} %`;

  const formatCount = (value: number) =>
    formatNumber(value, 0, preferences.number_format);

  const formatExpectancy = (value: number) =>
    formatCurrency(value, currencySymbol, preferences.number_format);

  const formatRegime = (code: string | null | undefined) => {
    if (!code) return '—';
    return t(`phases.${code}`, { defaultValue: code });
  };

  const toggleRow = (key: string, selected: boolean) => {
    setSelectedKeys((prev) => (selected ? [...prev, key] : prev.filter((k) => k !== key)));
  };

  const toggleAll = (selected: boolean) => {
    setSelectedKeys((prev) =>
      selected
        ? Array.from(new Set([...prev, ...visibleKeys]))
        : prev.filter((key) => !visibleKeys.includes(key)),
    );
  };

  const removeKeysFromState = (keys: string[]) => {
    const keySet = new Set(keys);
    setAssetProfiles((prev) => prev.filter((row) => !keySet.has(row.period.key)));
    setRanking((prev) => prev.filter((row) => !keySet.has(row.period.key)));
    setSelectedKeys((prev) => prev.filter((key) => !keySet.has(key)));
  };

  const requestDeletePeriod = (periodKey: string, periodLabel: string) => {
    setShowBulkDeleteModal(false);
    setPeriodToDelete({ key: periodKey, label: periodLabel });
  };

  const confirmDeletePeriod = async () => {
    if (!periodToDelete || deleteLoading) return;
    const removedKey = periodToDelete.key;
    setDeleteLoading(true);
    try {
      await marketPhasesService.deletePeriodCaptures({
        instrument_key: instrumentKey,
        period_key: removedKey,
        trading_account: accountId,
        date_from: dateFrom,
        date_to: dateTo,
      });
      removeKeysFromState([removedKey]);
      setPeriodToDelete(null);
    } catch {
      // ignore — keep rows until a successful refresh
    } finally {
      setDeleteLoading(false);
    }
  };

  const confirmBulkDelete = async () => {
    if (selectedKeys.length === 0 || deleteLoading) return;
    const keys = [...selectedKeys];
    setDeleteLoading(true);
    try {
      await marketPhasesService.deletePeriodCaptures({
        instrument_key: instrumentKey,
        period_keys: keys,
        trading_account: accountId,
        date_from: dateFrom,
        date_to: dateTo,
      });
      removeKeysFromState(keys);
      setShowBulkDeleteModal(false);
    } catch {
      // ignore — keep rows until a successful refresh
    } finally {
      setDeleteLoading(false);
    }
  };

  const instrumentOptions = useMemo(
    () => instruments.map((i) => ({ value: i.key, label: i.label })),
    [instruments],
  );

  const instrumentSelectValue = useMemo(() => {
    if (instrumentOptions.some((opt) => opt.value === instrumentKey)) {
      return instrumentKey;
    }
    return instrumentOptions[0]?.value ?? instrumentKey;
  }, [instrumentKey, instrumentOptions]);

  const verdictClass = (v: string) => {
    if (v === 'favor') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
    if (v === 'avoid') return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300';
    return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  };

  const tabButtonClass = (active: boolean) =>
    active
      ? `${replayPrimaryButtonClass} !h-9`
      : `${replaySecondaryButtonClass} !h-9`;

  const selectAllCheckbox = (
    <input
      type="checkbox"
      checked={allSelected}
      onChange={(e) => toggleAll(e.target.checked)}
      aria-label={t('analytics.selectAll')}
      className="h-4 w-4 flex-shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
    />
  );

  const rowCheckbox = (key: string, label: string) => (
    <input
      type="checkbox"
      checked={selectedKeys.includes(key)}
      onChange={(e) => toggleRow(key, e.target.checked)}
      aria-label={label}
      className="h-4 w-4 flex-shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
    />
  );

  return (
    <section
      id="market-phases-analytics"
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-4 sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t('analytics.title')}
        </h2>
        <div className="min-w-[10rem]">
          <CustomSelect
            value={instrumentSelectValue}
            onChange={(value) => setInstrumentKey(String(value ?? instrumentSelectValue))}
            options={instrumentOptions}
            variant="compact"
          />
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          className={tabButtonClass(tab === 'asset')}
          onClick={() => setTab('asset')}
        >
          {t('analytics.assetProfileTab')}
        </button>
        <button
          type="button"
          className={tabButtonClass(tab === 'performance')}
          onClick={() => setTab('performance')}
        >
          {t('analytics.periodProfileTab')}
        </button>
      </div>

      {selectedKeys.length > 0 && (
        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-gray-700 dark:bg-gray-900/40">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            {t('analytics.selectedCount', { count: selectedKeys.length })}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setSelectedKeys([])}
              className="rounded bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              {t('common:reset')}
            </button>
            <button
              type="button"
              onClick={() => {
                setPeriodToDelete(null);
                setShowBulkDeleteModal(true);
              }}
              className="rounded bg-rose-600 px-3 py-2 text-sm text-white hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600"
            >
              {t('analytics.deleteSelected')}
            </button>
          </div>
        </div>
      )}

      {loading && <p className="text-sm text-gray-500 dark:text-gray-400">…</p>}

      {!loading && tab === 'asset' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="pb-2 pr-3 w-8">{selectAllCheckbox}</th>
                <th className="pb-2 pr-4 font-medium">{t('analytics.period')}</th>
                <th className="pb-2 pr-4 font-medium">{t('analytics.dominantRegime')}</th>
                <th className="pb-2 pr-4 font-medium">{t('analytics.regimePct')}</th>
                <th className="pb-2 pr-4 font-medium">{t('analytics.sampleSessions')}</th>
                <th className="pb-2 w-10" aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {assetProfiles.map((row) => (
                <tr
                  key={row.period.key}
                  className="border-b border-gray-100 dark:border-gray-700/80 last:border-0"
                >
                  <td className="py-2 pr-3">{rowCheckbox(row.period.key, row.period.label)}</td>
                  <td className="py-2 pr-4 text-gray-800 dark:text-gray-200">{row.period.label}</td>
                  <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{formatRegime(row.dominant_regime)}</td>
                  <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{formatPct(row.dominant_regime_pct)}</td>
                  <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{formatCount(row.sample_sessions)}</td>
                  <td className="py-2 text-right">
                    <TradingActivityLedgerDeleteAction
                      deleteLabel={t('analytics.removePeriod')}
                      onRequestDelete={() => requestDeletePeriod(row.period.key, row.period.label)}
                      compact
                    />
                  </td>
                </tr>
              ))}
              {assetProfiles.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-gray-500 dark:text-gray-400">
                    {t('analytics.noRanking')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === 'performance' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="pb-2 pr-3 w-8">{selectAllCheckbox}</th>
                <th className="pb-2 pr-4 font-medium">{t('analytics.period')}</th>
                <th className="pb-2 pr-4 font-medium">{t('analytics.regimePct')}</th>
                <th className="pb-2 pr-4 font-medium">{t('analytics.winRate')}</th>
                <th className="pb-2 pr-4 font-medium">{t('analytics.expectancy')}</th>
                <th className="pb-2 pr-4 font-medium">{t('analytics.tradeCount')}</th>
                <th className="pb-2 w-10" aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {ranking.map((row) => (
                <tr
                  key={row.period.key}
                  className="border-b border-gray-100 dark:border-gray-700/80 last:border-0"
                >
                  <td className="py-2 pr-3">{rowCheckbox(row.period.key, row.period.label)}</td>
                  <td className="py-2 pr-4 text-gray-800 dark:text-gray-200">
                    <div>{row.period.label}</div>
                    <span className={`mt-1 inline-block rounded px-2 py-0.5 text-xs ${verdictClass(row.verdict)}`}>
                      {t(`analytics.verdict.${row.verdict}`)}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">
                    {formatRegime(row.dominant_regime)} · {formatPct(row.dominant_regime_pct)}
                  </td>
                  <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{formatPct(row.win_rate)}</td>
                  <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{formatExpectancy(row.expectancy)}</td>
                  <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{formatCount(row.trade_count)}</td>
                  <td className="py-2 text-right">
                    <TradingActivityLedgerDeleteAction
                      deleteLabel={t('analytics.removePeriod')}
                      onRequestDelete={() => requestDeletePeriod(row.period.key, row.period.label)}
                      compact
                    />
                  </td>
                </tr>
              ))}
              {ranking.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-gray-500 dark:text-gray-400">
                    {t('analytics.noRanking')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <DeleteConfirmModal
        isOpen={Boolean(periodToDelete)}
        onClose={() => {
          if (!deleteLoading) {
            setPeriodToDelete(null);
          }
        }}
        onConfirm={confirmDeletePeriod}
        title={t('analytics.removePeriod')}
        message={
          periodToDelete
            ? t('analytics.confirmDeletePeriod', { period: periodToDelete.label })
            : ''
        }
        isLoading={deleteLoading}
      />

      <DeleteConfirmModal
        isOpen={showBulkDeleteModal}
        onClose={() => {
          if (!deleteLoading) {
            setShowBulkDeleteModal(false);
          }
        }}
        onConfirm={confirmBulkDelete}
        title={t('analytics.deleteMultipleTitle')}
        message={t('analytics.confirmDeleteMultiple', { count: selectedKeys.length })}
        isLoading={deleteLoading}
        confirmButtonText={t('analytics.deleteSelected')}
      />
    </section>
  );
};

export default MarketPhaseAnalyticsSection;
