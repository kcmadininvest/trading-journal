import React, { useState, useEffect } from 'react';
import { TradingAccount } from '../types';
import { tradingAccountService } from '../services/tradingAccountService';
import TradingAccountForm from '../components/TradingAccount/TradingAccountForm';

const TradingAccountsPage: React.FC = () => {
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<TradingAccount | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<number | null>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const accountsData = await tradingAccountService.getAccounts();
      setAccounts(accountsData);
    } catch (err) {
      setError('Erreur lors du chargement des comptes');
      console.error('Error loading accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = () => {
    setEditingAccount(null);
    setShowModal(true);
  };

  const handleEditAccount = (account: TradingAccount) => {
    setEditingAccount(account);
    setShowModal(true);
  };

  const handleSaveAccount = (savedAccount: TradingAccount) => {
    if (editingAccount) {
      // Mise à jour
      setAccounts(prev => 
        prev.map(acc => acc.id === savedAccount.id ? savedAccount : acc)
      );
    } else {
      // Création
      setAccounts(prev => [savedAccount, ...prev]);
    }
    setShowModal(false);
    setEditingAccount(null);
  };

  const handleCancelModal = () => {
    setShowModal(false);
    setEditingAccount(null);
  };

  const handleDeleteAccount = async (account: TradingAccount) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer le compte "${account.name}" ?`)) {
      return;
    }

    try {
      setDeletingAccount(account.id);
      await tradingAccountService.deleteAccount(account.id);
      setAccounts(prev => prev.filter(acc => acc.id !== account.id));
    } catch (err) {
      setError('Erreur lors de la suppression du compte');
      console.error('Error deleting account:', err);
    } finally {
      setDeletingAccount(null);
    }
  };

  const handleSetDefault = async (account: TradingAccount) => {
    try {
      await tradingAccountService.setDefaultAccount(account.id);
      setAccounts(prev => 
        prev.map(acc => ({
          ...acc,
          is_default: acc.id === account.id
        }))
      );
    } catch (err) {
      setError('Erreur lors de la définition du compte par défaut');
      console.error('Error setting default account:', err);
    }
  };

  const getAccountTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'topstep': 'TopStep',
      'ibkr': 'Interactive Brokers',
      'ninjatrader': 'NinjaTrader',
      'tradovate': 'Tradovate',
      'other': 'Autre'
    };
    return labels[type] || type;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'active': 'bg-green-100 text-green-800',
      'inactive': 'bg-yellow-100 text-yellow-800',
      'archived': 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'active': 'Actif',
      'inactive': 'Inactif',
      'archived': 'Archivé'
    };
    return labels[status] || status;
  };


  return (
    <div className="pt-1 px-6 pb-6 bg-gray-50">
      <div className="max-w-full mx-auto">
        {/* En-tête */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Comptes de Trading</h1>
            <p className="text-gray-600">Gérez vos comptes de trading et leurs paramètres</p>
          </div>
          
          <button
            onClick={handleCreateAccount}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Nouveau compte
          </button>
        </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

        {loading ? (
          <div className="flex justify-center items-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 text-lg">Chargement des comptes...</p>
            </div>
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-16">
            <div className="max-w-md mx-auto">
              <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Aucun compte de trading</h3>
              <p className="text-gray-500 mb-6">Commencez par créer votre premier compte de trading pour organiser vos trades.</p>
              <button
                onClick={handleCreateAccount}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Créer votre premier compte
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {accounts.map((account) => (
              <div key={account.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{account.name}</h3>
                      <p className="text-sm text-gray-600">{getAccountTypeLabel(account.account_type)}</p>
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      {account.is_default && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Défaut
                        </span>
                      )}
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(account.status)}`}>
                        {getStatusLabel(account.status)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">Devise</div>
                      <div className="text-sm font-semibold text-gray-900">{account.currency}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">Trades</div>
                      <div className="text-sm font-semibold text-gray-900">{account.trades_count}</div>
                    </div>
                  </div>

                  {account.broker_account_id && (
                    <div className="mb-4">
                      <div className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">ID Broker</div>
                      <div className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">{account.broker_account_id}</div>
                    </div>
                  )}

                  {account.description && (
                    <div className="mb-4">
                      <div className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Description</div>
                      <p className="text-sm text-gray-700 line-clamp-2">{account.description}</p>
                    </div>
                  )}
                </div>

                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <div className="flex space-x-3">
                      <button
                        onClick={() => handleEditAccount(account)}
                        className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors duration-200"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Modifier
                      </button>
                      {!account.is_default && (
                        <button
                          onClick={() => handleSetDefault(account)}
                          className="inline-flex items-center text-green-600 hover:text-green-800 text-sm font-medium transition-colors duration-200"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Défaut
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteAccount(account)}
                      disabled={deletingAccount === account.id}
                      className="inline-flex items-center text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50 transition-colors duration-200"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      {deletingAccount === account.id ? 'Suppression...' : 'Supprimer'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modale pour créer/modifier un compte */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
          onClick={handleCancelModal}
        >
          <div 
            className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mt-3">
              <TradingAccountForm
                account={editingAccount || undefined}
                onSave={handleSaveAccount}
                onCancel={handleCancelModal}
                isEditing={!!editingAccount}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradingAccountsPage;
