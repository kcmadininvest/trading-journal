import React from 'react';
import { GlobalViewProps } from '../../types/strategy.types';
import GlobalNavigation from './GlobalNavigation';
import YearlyCalendar from '../../../../components/Strategy/YearlyCalendar';
import YearlyChartsContainer from '../Charts/YearlyChartsContainer';
import { useSelectedAccountCurrency } from '../../../../hooks/useSelectedAccountCurrency';

const GlobalView: React.FC<GlobalViewProps> = ({
  currentYear,
  selectedAccount,
  loading,
  hasInitialDataLoaded,
  onNavigateYear,
  onGoToCurrentYear,
  onMonthClick
}) => {
  const selectedCurrency = useSelectedAccountCurrency(selectedAccount);

  return (
    <>
      {/* Navigation de l'année */}
      <GlobalNavigation
        currentYear={currentYear}
        onNavigateYear={onNavigateYear}
        onGoToCurrentYear={onGoToCurrentYear}
      />

      {/* Layout principal : Graphiques + Calendrier Annuel + Graphiques */}
      <div className="flex flex-col xl:flex-row gap-6">
        {/* Graphiques de gauche */}
        <div className="w-full xl:w-96 xl:flex-shrink-0 flex flex-col space-y-4">
          {selectedAccount && hasInitialDataLoaded && (
            <YearlyChartsContainer
              year={currentYear}
              selectedAccount={selectedAccount}
              isLoading={false} // Les graphiques annuels gèrent leur propre état de chargement
              position="left"
            />
          )}
        </div>
        
        {/* Calendrier Annuel */}
        <div className="flex-1">
          {selectedAccount && hasInitialDataLoaded && (
            <YearlyCalendar 
              key={`calendar-${selectedAccount.id}-${currentYear}`}
              year={currentYear} 
              selectedAccount={selectedAccount}
              currency={selectedCurrency}
              onMonthClick={onMonthClick}
            />
          )}
        </div>
        
        {/* Graphiques de droite */}
        <div className="w-full xl:w-96 xl:flex-shrink-0 flex flex-col space-y-4">
          {selectedAccount && hasInitialDataLoaded && (
            <YearlyChartsContainer
              year={currentYear}
              selectedAccount={selectedAccount}
              isLoading={false} // Les graphiques annuels gèrent leur propre état de chargement
              position="right"
            />
          )}
        </div>
      </div>
    </>
  );
};

export default GlobalView;
