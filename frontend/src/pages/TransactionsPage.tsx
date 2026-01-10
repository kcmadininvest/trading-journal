import React, { useState } from 'react';
import { AccountTransaction } from '../services/accountTransactions';
import { TransactionFormModal } from '../components/transactions/TransactionFormModal';
import { TransactionHistory } from '../components/transactions/TransactionHistory';
import { AccountSelector } from '../components/accounts/AccountSelector';
import { useTradingAccount } from '../contexts/TradingAccountContext';
import { toast } from 'react-hot-toast/headless';
import { useTranslation as useI18nTranslation } from 'react-i18next';

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
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <button
              onClick={() => {
                window.location.hash = 'dashboard';
              }}
              className="px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base"
              title={t('transactions:backToDashboard', { defaultValue: 'Retour au dashboard' })}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="hidden sm:inline">{t('transactions:dashboard', { defaultValue: 'Dashboard' })}</span>
            </button>
            <button
              onClick={() => {
                setEditingTransaction(null);
                setShowDepositModal(true);
              }}
              className="px-3 sm:px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base flex-1 sm:flex-initial"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">{t('transactions:newDeposit', { defaultValue: 'Nouveau dépôt' })}</span>
              <span className="sm:hidden">{t('transactions:newDeposit', { defaultValue: 'Nouveau dépôt' }).split(' ')[0]}</span>
            </button>
            <button
              onClick={() => {
                setEditingTransaction(null);
                setShowWithdrawalModal(true);
              }}
              className="px-3 sm:px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base flex-1 sm:flex-initial"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
              <span className="hidden sm:inline">{t('transactions:newWithdrawal', { defaultValue: 'Nouveau retrait' })}</span>
              <span className="sm:hidden">{t('transactions:newWithdrawal', { defaultValue: 'Nouveau retrait' }).split(' ')[0]}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Historique */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {t('transactions:history', { defaultValue: 'Historique des transactions' })}
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

