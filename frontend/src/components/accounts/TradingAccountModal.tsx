import React, { useState, useEffect, useMemo, useRef } from 'react';
import { TradingAccount } from '../../services/tradingAccounts';
import { Currency } from '../../services/currencies';
import { NumberInput } from '../common/NumberInput';
import { useTranslation as useI18nTranslation } from 'react-i18next';

interface TradingAccountModalProps {
  account: TradingAccount | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (accountId: number | null, data: Partial<TradingAccount>) => Promise<void>;
  currencies: Currency[];
}

const TradingAccountModal: React.FC<TradingAccountModalProps> = ({
  account,
  isOpen,
  onClose,
  onSave,
  currencies,
}) => {
  const { t } = useI18nTranslation();
  const [form, setForm] = useState<Partial<TradingAccount>>({
    name: '',
    account_type: 'topstep',
    currency: 'USD',
    status: 'active',
    description: '',
    maximum_loss_limit: undefined,
    mll_enabled: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isCurrencyOpen, setIsCurrencyOpen] = useState(false);
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const currencyRef = useRef<HTMLDivElement | null>(null);
  const typeRef = useRef<HTMLDivElement | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);

  const orderedCurrencies = useMemo(() => {
    if (!currencies || currencies.length === 0) return [] as Currency[];
    const priority = ['USD', 'EUR', 'GBP'];
    const prioritySet = new Set(priority);
    const first = priority
      .map(code => currencies.find(c => c.code === code))
      .filter(Boolean) as Currency[];
    const rest = currencies
      .filter(c => !prioritySet.has(c.code))
      .sort((a, b) => a.code.localeCompare(b.code));
    return [...first, ...rest];
  }, [currencies]);

  const selectedCurrency = useMemo(() => {
    const code = form.currency || 'USD';
    return currencies.find(c => c.code === code) || (currencies.length ? currencies[0] : undefined);
  }, [currencies, form.currency]);

  useEffect(() => {
    if (account) {
      const mllValue = account.maximum_loss_limit ? (typeof account.maximum_loss_limit === 'string' ? parseFloat(account.maximum_loss_limit) : account.maximum_loss_limit) : undefined;
      setForm({
        name: account.name,
        account_type: account.account_type,
        currency: account.currency,
        initial_capital: account.initial_capital,
        maximum_loss_limit: mllValue,
        mll_enabled: account.mll_enabled !== undefined ? account.mll_enabled : true,
        status: account.status,
        description: account.description || '',
        broker_account_id: account.broker_account_id || '',
        is_default: account.is_default,
      });
    } else {
      setForm({
        name: '',
        account_type: 'topstep',
        currency: 'USD',
        status: 'active',
        description: '',
        maximum_loss_limit: undefined,
        mll_enabled: true,
      });
    }
    setError('');
  }, [account, isOpen]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (isCurrencyOpen && currencyRef.current && !currencyRef.current.contains(t)) setIsCurrencyOpen(false);
      if (isTypeOpen && typeRef.current && !typeRef.current.contains(t)) setIsTypeOpen(false);
      if (isStatusOpen && statusRef.current && !statusRef.current.contains(t)) setIsStatusOpen(false);
    };
    if (isOpen) {
      document.addEventListener('mousedown', onDocClick);
      return () => document.removeEventListener('mousedown', onDocClick);
    }
  }, [isCurrencyOpen, isTypeOpen, isStatusOpen, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) {
      setError(t('accounts:form.nameRequired', { defaultValue: 'Le nom est requis' }));
      return;
    }

    setSaving(true);
    setError('');

    try {
      await onSave(account?.id || null, form);
      onClose();
    } catch (err: any) {
      setError(err.message || t('accounts:form.error', { defaultValue: 'Erreur lors de la sauvegarde' }));
    } finally {
      setSaving(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !saving) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-2 sm:p-4"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-xl shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-3 sm:px-6 py-3 sm:py-5 border-b border-gray-200 dark:border-gray-700 flex items-start sm:items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-t-xl flex-shrink-0 gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-600 dark:bg-blue-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
                {account ? t('accounts:form.editTitle') : t('accounts:form.newTitle')}
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
                {account ? t('accounts:form.editDescription') : t('accounts:form.newDescription')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-white/80 dark:hover:bg-gray-700/80 flex items-center justify-center transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                {t('accounts:form.name')} <span className="text-red-500">*</span>
              </label>
              <input
                className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm sm:text-base px-2 sm:px-3 py-1.5 sm:py-2"
                value={form.name || ''}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder={t('accounts:form.namePlaceholder')}
                required
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                {t('accounts:form.type')}
              </label>
              <div ref={typeRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsTypeOpen(v => !v)}
                  className="w-full inline-flex items-center justify-between rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                >
                  <span className="inline-flex items-center gap-1.5 sm:gap-2 capitalize truncate">
                    {t(`accounts:accountTypes.${form.account_type || 'topstep'}`)}
                  </span>
                  <svg className={`h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400 dark:text-gray-500 transition-transform flex-shrink-0 ${isTypeOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isTypeOpen && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-hidden">
                    <ul className="py-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300 max-h-60 overflow-y-auto">
                      {[
                        { value: 'topstep' },
                        { value: 'ibkr' },
                        { value: 'ninjatrader' },
                        { value: 'tradovate' },
                        { value: 'other' },
                      ].map(opt => (
                        <li key={opt.value}>
                          <button
                            type="button"
                            onClick={() => { setForm(prev => ({ ...prev, account_type: opt.value as TradingAccount['account_type'] })); setIsTypeOpen(false); }}
                            className={`w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${opt.value === (form.account_type || 'topstep') ? 'bg-gray-50 dark:bg-gray-700' : ''}`}
                          >
                            <span className="text-gray-900 dark:text-gray-100">{t(`accounts:accountTypes.${opt.value}`)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <p className="mt-1 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{t('accounts:form.typeDescription')}</p>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                {t('accounts:form.brokerId')}
              </label>
              <input
                className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2"
                value={(form as any).broker_account_id || ''}
                onChange={(e) => setForm(prev => ({ ...prev, broker_account_id: e.target.value } as any))}
                placeholder={t('accounts:form.brokerIdPlaceholder')}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                  {t('accounts:form.currency')}
                </label>
                <div ref={currencyRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsCurrencyOpen(v => !v)}
                    className="w-full inline-flex items-center justify-between rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                  >
                    <span className="truncate">{(selectedCurrency?.symbol || '$') + ' ' + (selectedCurrency?.code || 'USD')}</span>
                    <svg className={`h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400 dark:text-gray-500 transition-transform flex-shrink-0 ${isCurrencyOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isCurrencyOpen && (
                    <div className="absolute z-10 mt-1 w-full min-w-[16rem] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg max-h-60 overflow-auto">
                      <ul className="py-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                        {((orderedCurrencies.length ? orderedCurrencies : (currencies.length ? currencies : [{ code: 'USD', name: t('accounts:defaultCurrencyName'), symbol: '$', id: 0 } as any]))).map(c => (
                          <li key={c.code}>
                            <button
                              type="button"
                              onClick={() => { setForm(prev => ({ ...prev, currency: c.code })); setIsCurrencyOpen(false); }}
                              className={`w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${c.code === (form.currency || 'USD') ? 'bg-gray-50 dark:bg-gray-700' : ''}`}
                            >
                              <span className="font-medium mr-1">{c.symbol}</span>
                              <span className="text-gray-600 dark:text-gray-400 mr-1">{c.code}</span>
                              <span className="text-gray-500 dark:text-gray-500">— {c.name}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <p className="mt-1 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{t('accounts:form.currencyDescription')}</p>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                  {t('accounts:form.initialCapital')}
                </label>
                <NumberInput
                  value={(form as any).initial_capital || ''}
                  onChange={(value) => setForm(prev => ({ ...prev, initial_capital: value ? parseFloat(value) : null } as any))}
                  className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs sm:text-sm sm:text-base px-2 sm:px-3 py-1.5 sm:py-2"
                  placeholder={t('accounts:form.initialCapitalPlaceholder')}
                  min={0}
                  step="0.01"
                  digits={2}
                />
                <p className="mt-1 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{t('accounts:form.initialCapitalDescription')}</p>
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="mll_enabled"
                checked={(form as any).mll_enabled !== false}
                onChange={(e) => setForm(prev => ({ ...prev, mll_enabled: e.target.checked } as any))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              />
              <label htmlFor="mll_enabled" className="ml-2 block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('accounts:form.enableMLL', { defaultValue: 'Activer le Maximum Loss Limit (MLL)' })}
              </label>
            </div>
            {(form as any).mll_enabled !== false && (
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                  {t('accounts:form.maximumLossLimit', { defaultValue: 'Maximum Loss Limit (MLL)' })}
                  <span className="text-gray-400 text-xs ml-1">({t('common:optional', { defaultValue: 'optionnel' })})</span>
                </label>
                <NumberInput
                  value={(() => {
                    const mll = (form as any).maximum_loss_limit;
                    if (mll === null || mll === undefined) return '';
                    const numValue = typeof mll === 'string' ? parseFloat(mll) : mll;
                    return isNaN(numValue) ? '' : numValue;
                  })()}
                  onChange={(value) => setForm(prev => ({ ...prev, maximum_loss_limit: value ? parseFloat(value) : null } as any))}
                  className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs sm:text-sm sm:text-base px-2 sm:px-3 py-1.5 sm:py-2"
                  placeholder={t('accounts:form.maximumLossLimitPlaceholder', { defaultValue: 'Saisir le MLL' })}
                  min={0}
                  step="0.01"
                  digits={2}
                />
                <p className="mt-1 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                  {t('accounts:form.maximumLossLimitDescription', { defaultValue: 'Limite de perte maximale (saisie manuelle)' })}
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                {t('accounts:form.status')}
              </label>
              <div ref={statusRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsStatusOpen(v => !v)}
                  className="w-full inline-flex items-center justify-between rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <span className={`inline-flex items-center rounded-md px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs ${
                    (form.status || 'active') === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300'
                  }`}>
                    {(form.status || 'active') === 'active' ? t('accounts:status.active') : t('accounts:status.inactive')}
                  </span>
                  <svg className={`h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400 dark:text-gray-500 transition-transform flex-shrink-0 ${isStatusOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isStatusOpen && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-hidden">
                    <ul className="py-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                      {[{ value: 'active' }, { value: 'inactive' }].map(opt => (
                        <li key={opt.value}>
                          <button
                            type="button"
                            onClick={() => { setForm(prev => ({ ...prev, status: opt.value as TradingAccount['status'] })); setIsStatusOpen(false); }}
                            className={`w-full flex items-center justify-between px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${opt.value === (form.status || 'active') ? 'bg-gray-50 dark:bg-gray-700' : ''}`}
                          >
                            <span>{t(`accounts:status.${opt.value}`)}</span>
                            <span className={`inline-flex items-center rounded-md px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs ${
                              opt.value === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300'
                            }`}>
                              {t(`accounts:status.${opt.value}`)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <p className="mt-1 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{t('accounts:form.statusDescription')}</p>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                {t('accounts:form.description')}
              </label>
              <textarea
                className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 resize-y"
                value={form.description || ''}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                placeholder={t('accounts:form.descriptionPlaceholder')}
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-400 focus:ring-blue-500 bg-white dark:bg-gray-700 appearance-none checked:bg-blue-600 dark:checked:bg-blue-400"
                  checked={Boolean((form as any).is_default)}
                  onChange={(e) => setForm(prev => ({ ...prev, is_default: e.target.checked } as any))}
                />
                {t('accounts:form.setAsDefault')}
              </label>
              <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{t('accounts:form.onlyOneDefault')}</div>
            </div>

            {/* Footer */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                type="button"
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm hover:shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-95"
                onClick={onClose}
                disabled={saving}
              >
                {t('accounts:form.cancel')}
              </button>
              <button
                type="submit"
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-medium bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-500 dark:to-blue-600 text-white rounded-lg shadow-sm hover:shadow-md hover:from-blue-700 hover:to-blue-800 dark:hover:from-blue-600 dark:hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-95"
                disabled={saving || !form.name}
              >
                {saving ? (
                  <>
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                    </svg>
                    {account ? t('accounts:form.saving') : t('accounts:form.creating')}
                  </>
                ) : (
                  <>
                    {account ? (
                      <>
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {t('accounts:form.save')}
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
                        </svg>
                        {t('accounts:form.create')}
                      </>
                    )}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TradingAccountModal;

