import React, { useEffect, useMemo, useRef, useState } from 'react';
import { tradingAccountsService, TradingAccount } from '../../services/tradingAccounts';
import { useTranslation as useI18nTranslation } from 'react-i18next';

interface AccountSelectorProps {
  value?: number | null;
  onChange?: (accountId: number | null) => void;
  allowAllActive?: boolean;
  hideLabel?: boolean;
}

export const AccountSelector: React.FC<AccountSelectorProps> = ({ value, onChange, allowAllActive = true, hideLabel = false }) => {
  const { t } = useI18nTranslation();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const selectedId = value ?? null;
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const isMountedRef = useRef(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const list = await tradingAccountsService.list();
        // Par défaut ne montrer que les actifs
        setAccounts(list.filter(a => a.status === 'active'));
      } catch {
        setAccounts([]);
      } finally {
        setLoading(false);
      }
    };
    load();

    // Recharger les comptes après une connexion pour s'assurer d'avoir la liste à jour
    const handleLogin = () => {
      load();
    };

    window.addEventListener('user:login', handleLogin);

    return () => {
      window.removeEventListener('user:login', handleLogin);
    };
  }, []);

  // Initialiser le compte par défaut si aucune valeur n'est fournie
  // Ne pas réinitialiser si value est explicitement null (choix "Tous les comptes")
  useEffect(() => {
    // Au premier montage uniquement, initialiser le compte par défaut si aucune valeur n'est fournie
    // value === undefined signifie qu'aucune valeur n'a été fournie
    // value === null signifie que l'utilisateur a choisi "Tous les comptes"
    if (!isMountedRef.current && value === undefined && onChange && !loading) {
      // D'abord, vérifier si un compte par défaut existe dans la liste déjà chargée
      const defaultAccount = accounts.find(a => a.is_default && a.status === 'active');
      if (defaultAccount) {
        onChange(defaultAccount.id);
        isMountedRef.current = true;
        return;
      }
      
      // Si aucun compte par défaut dans la liste, faire un appel API
      // (peut arriver si les comptes ne sont pas encore chargés)
      if (accounts.length === 0) {
        const initDefault = async () => {
          try {
            const def = await tradingAccountsService.default();
            if (def && def.status === 'active') {
              onChange(def.id);
            }
          } catch {
            // noop
          } finally {
            isMountedRef.current = true;
          }
        };
        initDefault();
      } else {
        isMountedRef.current = true;
      }
    }
    // Ne pas réinitialiser après le premier montage - respecter le choix de l'utilisateur
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, loading]);

  const options = useMemo(() => {
    const base = accounts.map(a => ({ value: a.id, label: a.name, isDefault: !!a.is_default }));
    if (allowAllActive) {
      return [{ value: 0, label: t('common:allActiveAccounts'), isDefault: false } as any, ...base];
    }
    return base;
  }, [accounts, allowAllActive, t]);

  const currentValue = useMemo(() => {
    if (selectedId === null || selectedId === undefined) return 0;
    return selectedId;
  }, [selectedId]);

  const currentOption = useMemo(() => options.find(o => o.value === currentValue) || options[0], [options, currentValue]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (open && dropdownRef.current && !dropdownRef.current.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div className={hideLabel ? "max-w-sm" : "mb-4 max-w-sm"}>
      {!hideLabel && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common:tradingAccount')}</label>
      )}
      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          disabled={loading}
          onClick={() => setOpen(v => !v)}
          className="w-full inline-flex items-center justify-between rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="inline-flex items-center gap-2">
            <span className="text-gray-900 dark:text-gray-100">{currentOption?.label || t('common:allActiveAccounts')}</span>
            {currentOption && (currentOption as any).isDefault && (
              <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 text-xs">{t('common:default')}</span>
            )}
          </span>
          <svg className={`h-4 w-4 text-gray-400 dark:text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </button>
        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg max-h-72 overflow-auto">
            <ul className="py-1 text-sm text-gray-700 dark:text-gray-300">
              {options.map(opt => (
                <li key={opt.value}>
                  <button
                    type="button"
                    onClick={() => {
                      if (opt.value === 0) onChange && onChange(null); else onChange && onChange(opt.value as number);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${opt.value === currentValue ? 'bg-gray-50 dark:bg-gray-700' : ''}`}
                  >
                    <span className="text-gray-900 dark:text-gray-100">{opt.label}</span>
                    {(opt as any).isDefault && <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 text-xs">{t('common:default')}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};


