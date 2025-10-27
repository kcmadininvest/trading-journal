import React from 'react';
import TradingAccountSelector from '../../../components/TradingAccount/TradingAccountSelector';
import StrategyProgressBar from '../../../components/Strategy/StrategyProgressBar';
import { StrategyHeaderProps } from '../types/strategy.types';

const StrategyHeader: React.FC<StrategyHeaderProps> = ({
  selectedAccount,
  onAccountChange,
  globalStrategyData,
  isGlobalStrategyDataLoading
}) => {
  return (
    <>
      {/* En-tête */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Stratégie de Trading</h1>
          <p className="text-gray-600">Planifiez et suivez vos stratégies de trading avec le calendrier intégré</p>
        </div>
        
        {/* Barre de progression du respect global de la stratégie */}
        <div className="flex-shrink-0">
          <StrategyProgressBar
            respectPercentage={globalStrategyData.percentage || 0}
            totalTrades={globalStrategyData.total || 0}
            respectedTrades={globalStrategyData.respected || 0}
            isLoading={isGlobalStrategyDataLoading}
          />
        </div>
      </div>

      {/* Sélecteur de compte de trading */}
      <div className="flex justify-between items-center mb-6">
        <TradingAccountSelector
          selectedAccountId={selectedAccount?.id}
          onAccountChange={onAccountChange}
          className="flex items-center space-x-2"
        />
        {selectedAccount && (
          <div className="text-sm text-gray-600">
            Stratégies pour le compte "{selectedAccount.name}"
          </div>
        )}
      </div>
    </>
  );
};

export default StrategyHeader;
