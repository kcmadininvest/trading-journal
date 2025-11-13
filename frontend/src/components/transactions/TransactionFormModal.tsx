import React, { useState, useEffect } from 'react';
import { accountTransactionsService, AccountTransaction } from '../../services/accountTransactions';
import { tradingAccountsService, TradingAccount } from '../../services/tradingAccounts';
import { AccountSelector } from '../accounts/AccountSelector';
import { DateInput } from '../common/DateInput';
import { usePreferences } from '../../hooks/usePreferences';
import { formatCurrency } from '../../utils/numberFormat';

interface TransactionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  transactionType: 'deposit' | 'withdrawal';
  defaultAccountId?: number;
  transaction?: AccountTransaction | null;
}

export const TransactionFormModal: React.FC<TransactionFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  transactionType,
  defaultAccountId,
  transaction,
}) => {
  const { preferences } = usePreferences();
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(defaultAccountId || null);
  const [selectedAccount, setSelectedAccount] = useState<TradingAccount | null>(null);
  const [amount, setAmount] = useState('');
  const [transactionDate, setTransactionDate] = useState(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  });
  const [transactionTime, setTransactionTime] = useState(() => {
    const now = new Date();
    return now.toTimeString().slice(0, 5);
  });
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);

  // Charger le compte sélectionné et son solde
  useEffect(() => {
    if (selectedAccountId) {
      const loadAccount = async () => {
        try {
          const account = await tradingAccountsService.get(selectedAccountId);
          setSelectedAccount(account);
          
          // Charger le solde actuel
          const balance = await accountTransactionsService.getBalance(selectedAccountId);
          setCurrentBalance(parseFloat(balance.current_balance));
        } catch (err) {
          console.error('Erreur lors du chargement du compte:', err);
        }
      };
      loadAccount();
    } else {
      setSelectedAccount(null);
      setCurrentBalance(null);
    }
  }, [selectedAccountId]);

  // Initialiser avec la transaction existante si en mode édition
  useEffect(() => {
    if (transaction && isOpen) {
      setSelectedAccountId(transaction.trading_account);
      setAmount(transaction.amount.toString());
      const date = new Date(transaction.transaction_date);
      setTransactionDate(date.toISOString().split('T')[0]);
      setTransactionTime(date.toTimeString().slice(0, 5));
      setDescription(transaction.description || '');
    } else if (isOpen && !transaction) {
      // Réinitialiser le formulaire en mode création
      setAmount('');
      const now = new Date();
      setTransactionDate(now.toISOString().split('T')[0]);
      setTransactionTime(now.toTimeString().slice(0, 5));
      setDescription('');
      setError('');
    }
  }, [transaction, isOpen]);

  // Calculer le solde après transaction
  const balanceAfterTransaction = React.useMemo(() => {
    if (currentBalance === null || !amount) return null;
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum)) return null;
    
    if (transactionType === 'deposit') {
      return currentBalance + amountNum;
    } else {
      return currentBalance - amountNum;
    }
  }, [currentBalance, amount, transactionType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedAccountId) {
      setError('Veuillez sélectionner un compte');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Le montant doit être supérieur à 0');
      return;
    }

    if (transactionType === 'withdrawal' && currentBalance !== null && parseFloat(amount) > currentBalance) {
      setError('Le montant du retrait ne peut pas dépasser le solde disponible');
      return;
    }

    setIsLoading(true);

    try {
      const dateTime = new Date(`${transactionDate}T${transactionTime}`);
      
      if (transaction) {
        // Mise à jour
        await accountTransactionsService.update(transaction.id, {
          trading_account: selectedAccountId,
          transaction_type: transactionType,
          amount: parseFloat(amount),
          transaction_date: dateTime.toISOString(),
          description: description || undefined,
        });
      } else {
        // Création
        await accountTransactionsService.create({
          trading_account: selectedAccountId,
          transaction_type: transactionType,
          amount: parseFloat(amount),
          transaction_date: dateTime.toISOString(),
          description: description || undefined,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue lors de l\'enregistrement');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const currencySymbol = selectedAccount 
    ? (selectedAccount.currency === 'USD' ? '$' : selectedAccount.currency === 'EUR' ? '€' : selectedAccount.currency)
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {transaction 
              ? transactionType === 'deposit' ? 'Modifier le dépôt' : 'Modifier le retrait'
              : transactionType === 'deposit' ? 'Nouveau dépôt' : 'Nouveau retrait'
            }
          </h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="w-8 h-8 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Compte de trading */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Compte de trading *
            </label>
            <AccountSelector
              value={selectedAccountId}
              onChange={setSelectedAccountId}
              allowAllActive={false}
            />
          </div>

          {/* Solde disponible (pour les retraits) */}
          {selectedAccount && currentBalance !== null && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium">Solde disponible:</span>{' '}
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {formatCurrency(currentBalance, currencySymbol, preferences.number_format, 2)}
                </span>
              </p>
            </div>
          )}

          {/* Montant */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Montant *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">
                {currencySymbol}
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full pl-8 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Date et heure */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Date *
              </label>
              <DateInput
                value={transactionDate}
                onChange={setTransactionDate}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Heure *
              </label>
              <input
                type="time"
                value={transactionTime}
                onChange={(e) => setTransactionTime(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description (optionnel)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
              placeholder="Notes sur cette transaction..."
            />
          </div>

          {/* Aperçu du solde après transaction */}
          {balanceAfterTransaction !== null && selectedAccount && (
            <div className={`p-3 rounded-lg border ${
              transactionType === 'deposit'
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
            }`}>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium">
                  {transactionType === 'deposit' ? 'Solde après dépôt:' : 'Solde après retrait:'}
                </span>{' '}
                <span className={`font-semibold ${
                  transactionType === 'deposit'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-orange-600 dark:text-orange-400'
                }`}>
                  {formatCurrency(balanceAfterTransaction, currencySymbol, preferences.number_format, 2)}
                </span>
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className={`flex-1 px-4 py-2 rounded-lg text-white font-medium transition-colors disabled:opacity-50 ${
                transactionType === 'deposit'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-orange-600 hover:bg-orange-700'
              }`}
            >
              {isLoading ? 'Enregistrement...' : transaction ? 'Modifier' : 'Confirmer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

