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

type Tab = 'asset' | 'performance';

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
  const { t } = useTranslation('marketPhases');
  const { preferences } = usePreferences();
  const { selectedAccountId } = useTradingAccount();
  const accountId = tradingAccountId ?? selectedAccountId ?? undefined;
  const [tab, setTab] = useState<Tab>('asset');
  const [instruments, setInstruments] = useState<MarketInstrument[]>([]);
  const [instrumentKey, setInstrumentKey] = useState('nasdaq');
  const [assetProfiles, setAssetProfiles] = useState<AssetMarketProfile[]>([]);
  const [ranking, setRanking] = useState<PeriodProfile[]>([]);
  const [loading, setLoading] = useState(false);

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
    setLoading(true);
    const params = {
      instrument_key: instrumentKey,
      trading_account: accountId,
      date_from: dateFrom,
      date_to: dateTo,
    };
    const p =
      tab === 'asset'
        ? marketPhasesService.getAssetProfiles(params).then((r) => {
            setAssetProfiles('profiles' in r ? r.profiles : [r as AssetMarketProfile]);
          })
        : marketPhasesService.getRanking(params).then((r) => setRanking(r.ranking));
    p.finally(() => setLoading(false));
  }, [tab, instrumentKey, accountId, dateFrom, dateTo]);

  const formatPct = (value: number) =>
    `${formatNumber(value, 1, preferences.number_format)} %`;

  const formatCount = (value: number) =>
    formatNumber(value, 0, preferences.number_format);

  const formatExpectancy = (value: number) =>
    formatCurrency(value, currencySymbol, preferences.number_format);

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

  return (
    <section id="market-phases-analytics" className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('analytics.title')}</h2>
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

      {loading && <p className="text-sm text-gray-500">…</p>}

      {!loading && tab === 'asset' && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-2 pr-4">{t('analytics.period')}</th>
                <th className="py-2 pr-4">{t('analytics.dominantRegime')}</th>
                <th className="py-2 pr-4">{t('analytics.regimePct')}</th>
                <th className="py-2">{t('analytics.sampleSessions')}</th>
              </tr>
            </thead>
            <tbody>
              {assetProfiles.map((row) => (
                <tr key={row.period.key} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="py-2 pr-4">{row.period.label}</td>
                  <td className="py-2 pr-4">{row.dominant_regime}</td>
                  <td className="py-2 pr-4">{formatPct(row.dominant_regime_pct)}</td>
                  <td className="py-2">{formatCount(row.sample_sessions)}</td>
                </tr>
              ))}
              {assetProfiles.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-gray-500">{t('analytics.noRanking')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === 'performance' && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-2 pr-4">{t('analytics.period')}</th>
                <th className="py-2 pr-4">{t('analytics.regimePct')}</th>
                <th className="py-2 pr-4">{t('analytics.winRate')}</th>
                <th className="py-2 pr-4">{t('analytics.expectancy')}</th>
                <th className="py-2">{t('analytics.tradeCount')}</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((row) => (
                <tr key={row.period.key} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="py-2 pr-4">
                    <div>{row.period.label}</div>
                    <span className={`mt-1 inline-block rounded px-2 py-0.5 text-xs ${verdictClass(row.verdict)}`}>
                      {t(`analytics.verdict.${row.verdict}`)}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    {row.dominant_regime} · {formatPct(row.dominant_regime_pct)}
                  </td>
                  <td className="py-2 pr-4">{formatPct(row.win_rate)}</td>
                  <td className="py-2 pr-4">{formatExpectancy(row.expectancy)}</td>
                  <td className="py-2">{formatCount(row.trade_count)}</td>
                </tr>
              ))}
              {ranking.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-gray-500">{t('analytics.noRanking')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default MarketPhaseAnalyticsSection;
