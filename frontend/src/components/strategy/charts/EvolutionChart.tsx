import React from 'react';
import { ChartSection } from '../../common/ChartSection';
import { LazyChart } from './LazyChart';
import { MemoizedMixedChart as MixedChart } from './MemoizedCharts';
import { TradingAccount } from '../../../services/tradingAccounts';

interface EvolutionChartProps {
  data: any | null;
  options: any;
  selectedAccount: TradingAccount | null;
  t: any;
}

export const EvolutionChart: React.FC<EvolutionChartProps> = React.memo(({
  data,
  options,
  selectedAccount,
  t,
}) => {
  if (data) {
    return (
      <ChartSection 
        title={t('strategies:compliance.evolution')}
        tooltip={selectedAccount 
          ? t('strategies:complianceEvolutionSelectedAccountTooltip', { defaultValue: 'Évolution du taux de respect de la stratégie pour le compte sélectionné' })
          : t('strategies:complianceEvolutionAllAccountsTooltip', { defaultValue: 'Évolution du taux de respect de la stratégie pour tous vos comptes actifs' })}
      >
        <LazyChart height="h-64 sm:h-80 md:h-96">
          <MixedChart type="bar" data={data} options={options} />
        </LazyChart>
      </ChartSection>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 md:p-6">
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 break-words">
          {t('strategies:compliance.evolution')}
        </h3>
      </div>
      <div className="h-64 sm:h-80 md:h-96 flex items-center justify-center">
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          {t('strategies:noDataForAccount', { defaultValue: 'Aucune donnée disponible' })}
        </p>
      </div>
    </div>
  );
});

EvolutionChart.displayName = 'EvolutionChart';
