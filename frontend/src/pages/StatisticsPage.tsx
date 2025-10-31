import React, { useState } from 'react';
import { FloatingActionButton } from '../components/ui/FloatingActionButton';
import { ImportTradesModal } from '../components/trades/ImportTradesModal';
import { AccountSelector } from '../components/accounts/AccountSelector';

const StatisticsPage: React.FC = () => {
  const [accountId, setAccountId] = useState<number | null>(null);
  const [showImport, setShowImport] = useState(false);
  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <AccountSelector value={accountId} onChange={setAccountId} />
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">
          Cette page affichera vos statistiques de trading. Fonctionnalités à venir :
        </p>
        <ul className="mt-4 space-y-2 text-gray-600">
          <li>• Graphiques de performance</li>
          <li>• Métriques de rentabilité</li>
          <li>• Analyse des gains/pertes</li>
          <li>• Comparaisons temporelles</li>
        </ul>
      </div>
      <FloatingActionButton onClick={() => setShowImport(true)} title="Importer des trades" />
      <ImportTradesModal open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
};

export default StatisticsPage;
