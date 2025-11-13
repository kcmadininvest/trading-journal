import React, { useState, useEffect, useMemo } from 'react';
import { accountTransactionsService, AccountTransaction } from '../../services/accountTransactions';
import { usePreferences } from '../../hooks/usePreferences';
import { formatCurrency } from '../../utils/numberFormat';
import { formatDate } from '../../utils/dateFormat';
import DeleteConfirmModal from '../ui/DeleteConfirmModal';

interface TransactionHistoryProps {
  tradingAccountId?: number;
  onEdit?: (transaction: AccountTransaction) => void;
  onDelete?: (transactionId: number) => void;
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  tradingAccountId,
  onEdit,
  onDelete,
}) => {
  const { preferences } = usePreferences();
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<AccountTransaction[]>([]); // Toutes les transactions pour les compteurs
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'deposit' | 'withdrawal'>('all');
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<AccountTransaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadTransactions = async () => {
    setLoading(true);
    setError('');
    try {
      const params: any = {};
      if (tradingAccountId) {
        params.trading_account = tradingAccountId;
      }
      if (filterType !== 'all') {
        params.transaction_type = filterType;
      }
      
      const data = await accountTransactionsService.list(params);
      setTransactions(data);

      // Charger toutes les transactions (sans filtre) pour les compteurs
      const allParams: any = {};
      if (tradingAccountId) {
        allParams.trading_account = tradingAccountId;
      }
      const allData = await accountTransactionsService.list(allParams);
      setAllTransactions(allData);

      // Charger le solde actuel si un compte est sélectionné
      if (tradingAccountId) {
        try {
          const balance = await accountTransactionsService.getBalance(tradingAccountId);
          setCurrentBalance(parseFloat(balance.current_balance));
        } catch (err) {
          console.error('Erreur lors du chargement du solde:', err);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradingAccountId, filterType]);

  // Calculer les compteurs
  const totalCount = useMemo(() => allTransactions.length, [allTransactions]);
  const depositCount = useMemo(() => 
    allTransactions.filter(t => t.transaction_type === 'deposit').length,
    [allTransactions]
  );
  const withdrawalCount = useMemo(() => 
    allTransactions.filter(t => t.transaction_type === 'withdrawal').length,
    [allTransactions]
  );

  const handleDeleteClick = (transaction: AccountTransaction) => {
    setTransactionToDelete(transaction);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!transactionToDelete || !transactionToDelete.id) return;
    
    setIsDeleting(true);
    try {
      await accountTransactionsService.delete(transactionToDelete.id);
      loadTransactions();
      if (onDelete) {
        onDelete(transactionToDelete.id);
      }
      setDeleteModalOpen(false);
      setTransactionToDelete(null);
    } catch (err: any) {
      console.error('Erreur lors de la suppression:', err);
      // L'erreur sera gérée par le composant parent si nécessaire
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return formatDate(date.toISOString().split('T')[0], preferences.date_format) + ' ' + 
           date.toTimeString().slice(0, 5);
  };

  const getCurrencySymbol = (transaction: AccountTransaction) => {
    // Essayer de récupérer la devise depuis le nom du compte ou utiliser USD par défaut
    // Dans un vrai cas, on devrait avoir la devise dans les données
    return '$';
  };

  if (loading && transactions.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500 dark:text-gray-400">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtres et solde */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              filterType === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Tous
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              filterType === 'all'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
            }`}>
              {totalCount}
            </span>
          </button>
          <button
            onClick={() => setFilterType('deposit')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              filterType === 'deposit'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Dépôts
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              filterType === 'deposit'
                ? 'bg-green-500 text-white'
                : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
            }`}>
              {depositCount}
            </span>
          </button>
          <button
            onClick={() => setFilterType('withdrawal')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              filterType === 'withdrawal'
                ? 'bg-orange-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Retraits
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              filterType === 'withdrawal'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
            }`}>
              {withdrawalCount}
            </span>
          </button>
        </div>

        {currentBalance !== null && (
          <div className="text-sm">
            <span className="text-gray-600 dark:text-gray-400">Solde actuel: </span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {formatCurrency(currentBalance, '$', preferences.number_format, 2)}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Liste des transactions */}
      {transactions.length === 0 ? (
        <div className="text-center p-8 text-gray-500 dark:text-gray-400">
          Aucune transaction trouvée
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Date
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Type
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Compte
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Montant
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description
                </th>
                {(onEdit || onDelete) && (
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => {
                const currencySymbol = getCurrencySymbol(transaction);
                const amount = parseFloat(transaction.amount.toString());

                return (
                  <tr
                    key={transaction.id}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100">
                      {formatDateTime(transaction.transaction_date)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          transaction.transaction_type === 'deposit'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                        }`}
                      >
                        {transaction.transaction_type === 'deposit' ? '📥 Dépôt' : '📤 Retrait'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                      {transaction.trading_account_name || `Compte #${transaction.trading_account}`}
                    </td>
                    <td className={`py-3 px-4 text-sm text-right font-medium ${
                      transaction.transaction_type === 'deposit'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-orange-600 dark:text-orange-400'
                    }`}>
                      {transaction.transaction_type === 'deposit' ? '+' : '-'}
                      {formatCurrency(amount, currencySymbol, preferences.number_format, 2)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                      {transaction.description || '-'}
                    </td>
                    {(onEdit || onDelete) && (
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          {onEdit && (
                            <button
                              onClick={() => onEdit(transaction)}
                              className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                              title="Modifier"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={() => handleDeleteClick(transaction)}
                              className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              title="Supprimer"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modale de confirmation de suppression */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setTransactionToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Supprimer la transaction"
        message="Êtes-vous sûr de vouloir supprimer cette transaction ? Cette action est irréversible."
        isLoading={isDeleting}
        confirmButtonText="Supprimer"
      />
    </div>
  );
};

