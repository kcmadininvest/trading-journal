import React, { useState } from 'react';
import { accountTransactionsService, AccountTransaction } from '../services/accountTransactions';
import { TransactionFormModal } from '../components/transactions/TransactionFormModal';
import { TransactionHistory } from '../components/transactions/TransactionHistory';
import { AccountSelector } from '../components/accounts/AccountSelector';
import { useTradingAccount } from '../contexts/TradingAccountContext';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';

const TransactionsPage: React.FC = () => {
  const { t } = useI18nTranslation();
  const { selectedAccountId, setSelectedAccountId } = useTradingAccount();
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<AccountTransaction | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSuccess = () => {
    setRefreshKey(prev => prev + 1);
    toast.success('Transaction enregistrée avec succès');
    // Déclencher un événement pour rafraîchir le solde dans le Dashboard
    window.dispatchEvent(new CustomEvent('account-transaction:updated'));
  };

  const handleEdit = (transaction: AccountTransaction) => {
    setEditingTransaction(transaction);
    if (transaction.transaction_type === 'deposit') {
      setShowDepositModal(true);
    } else {
      setShowWithdrawalModal(true);
    }
  };

  const handleDelete = () => {
    setRefreshKey(prev => prev + 1);
    toast.success('Transaction supprimée avec succès');
    // Déclencher un événement pour rafraîchir le solde dans le Dashboard
    window.dispatchEvent(new CustomEvent('account-transaction:updated'));
  };

  const handleCloseModal = () => {
    setShowDepositModal(false);
    setShowWithdrawalModal(false);
    setEditingTransaction(null);
  };

  return (
    <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
      {/* Filtres et actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Sélecteur de compte */}
          <div className="flex-1 max-w-md">
            <AccountSelector
              value={selectedAccountId}
              onChange={setSelectedAccountId}
              allowAllActive={true}
              hideLabel={true}
            />
          </div>

          {/* Boutons d'action */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                setEditingTransaction(null);
                setShowDepositModal(true);
              }}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nouveau dépôt
            </button>
            <button
              onClick={() => {
                setEditingTransaction(null);
                setShowWithdrawalModal(true);
              }}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
              Nouveau retrait
            </button>
          </div>
        </div>
      </div>

      {/* Historique */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Historique des transactions
        </h2>
        <TransactionHistory
          key={refreshKey}
          tradingAccountId={selectedAccountId || undefined}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>

      {/* Modals */}
      <TransactionFormModal
        isOpen={showDepositModal}
        onClose={handleCloseModal}
        onSuccess={handleSuccess}
        transactionType="deposit"
        defaultAccountId={selectedAccountId || undefined}
        transaction={editingTransaction}
      />
      <TransactionFormModal
        isOpen={showWithdrawalModal}
        onClose={handleCloseModal}
        onSuccess={handleSuccess}
        transactionType="withdrawal"
        defaultAccountId={selectedAccountId || undefined}
        transaction={editingTransaction}
      />
    </div>
  );
};

export default TransactionsPage;

