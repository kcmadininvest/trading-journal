import React, { useState, useEffect } from 'react';
import { accountTransactionsService, AccountTransaction } from '../../services/accountTransactions';
import { usePreferences } from '../../hooks/usePreferences';
import { formatCurrency } from '../../utils/numberFormat';
import { formatDate } from '../../utils/dateFormat';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'deposit' | 'withdrawal'>('all');
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);

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

  const handleDelete = async (id: number) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette transaction ?')) {
      return;
    }

    try {
      await accountTransactionsService.delete(id);
      loadTransactions();
      if (onDelete) {
        onDelete(id);
      }
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la suppression');
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
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterType === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Tous
          </button>
          <button
            onClick={() => setFilterType('deposit')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterType === 'deposit'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Dépôts
          </button>
          <button
            onClick={() => setFilterType('withdrawal')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterType === 'withdrawal'
                ? 'bg-orange-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Retraits
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
                              onClick={() => handleDelete(transaction.id)}
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
    </div>
  );
};

