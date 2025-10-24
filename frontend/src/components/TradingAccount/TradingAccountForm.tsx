import React, { useState, useEffect } from 'react';
import { TradingAccount, TradingAccountCreate, TradingAccountUpdate } from '../../types';
import { tradingAccountService } from '../../services/tradingAccountService';

interface TradingAccountFormProps {
  account?: TradingAccount;
  onSave: (account: TradingAccount) => void;
  onCancel: () => void;
  isEditing?: boolean;
}

const TradingAccountForm: React.FC<TradingAccountFormProps> = ({
  account,
  onSave,
  onCancel,
  isEditing = false
}) => {
  const [formData, setFormData] = useState<TradingAccountCreate>({
    name: '',
    account_type: 'topstep',
    broker_account_id: '',
    currency: 'USD',
    status: 'active',
    description: '',
    is_default: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (account && isEditing) {
      setFormData({
        name: account.name,
        account_type: account.account_type,
        broker_account_id: account.broker_account_id || '',
        currency: account.currency,
        status: account.status,
        description: account.description || '',
        is_default: account.is_default
      });
    }
  }, [account, isEditing]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let savedAccount: TradingAccount;
      
      if (isEditing && account) {
        const updateData: TradingAccountUpdate = {
          ...formData,
          broker_account_id: formData.broker_account_id || undefined,
          description: formData.description || undefined
        };
        savedAccount = await tradingAccountService.updateAccount(account.id, updateData);
      } else {
        const createData: TradingAccountCreate = {
          ...formData,
          broker_account_id: formData.broker_account_id || undefined,
          description: formData.description || undefined
        };
        savedAccount = await tradingAccountService.createAccount(createData);
      }

      onSave(savedAccount);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const accountTypeOptions = [
    { value: 'topstep', label: 'TopStep' },
    { value: 'ibkr', label: 'Interactive Brokers' },
    { value: 'ninjatrader', label: 'NinjaTrader' },
    { value: 'tradovate', label: 'Tradovate' },
    { value: 'other', label: 'Autre' }
  ];

  const statusOptions = [
    { value: 'active', label: 'Actif' },
    { value: 'inactive', label: 'Inactif' },
    { value: 'archived', label: 'Archivé' }
  ];

  const currencyOptions = [
    { value: 'USD', label: 'USD' },
    { value: 'EUR', label: 'EUR' },
    { value: 'GBP', label: 'GBP' }
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {isEditing ? 'Modifier le compte' : 'Nouveau compte de trading'}
        </h2>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Nom du compte *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Mon compte TopStep"
            />
          </div>

          <div>
            <label htmlFor="account_type" className="block text-sm font-medium text-gray-700 mb-1">
              Type de broker *
            </label>
            <select
              id="account_type"
              name="account_type"
              value={formData.account_type}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {accountTypeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="broker_account_id" className="block text-sm font-medium text-gray-700 mb-1">
              ID du compte broker
            </label>
            <input
              type="text"
              id="broker_account_id"
              name="broker_account_id"
              value={formData.broker_account_id}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: 123456789"
            />
          </div>

          <div>
            <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-1">
              Devise *
            </label>
            <select
              id="currency"
              name="currency"
              value={formData.currency}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {currencyOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
              Statut *
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Description du compte (optionnel)"
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="is_default"
            name="is_default"
            checked={formData.is_default}
            onChange={handleInputChange}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="is_default" className="ml-2 block text-sm text-gray-700">
            Définir comme compte par défaut
          </label>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? 'Sauvegarde...' : (isEditing ? 'Mettre à jour' : 'Créer')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TradingAccountForm;
