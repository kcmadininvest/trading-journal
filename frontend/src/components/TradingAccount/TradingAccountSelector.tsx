import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TradingAccount, tradingAccountsService } from '../../services/tradingAccounts';
import { useTranslation as useI18nTranslation } from 'react-i18next';

interface TradingAccountSelectorProps {
  selectedAccountId?: number | null;
  onAccountChange: (account: TradingAccount | null) => void;
  className?: string;
  hideLabel?: boolean;
}

const HIDE_ACCOUNT_NAME_PART_KEY = 'hide_account_name_part';

const getHideAccountNamePart = (): boolean => {
  try {
    const value = localStorage.getItem(HIDE_ACCOUNT_NAME_PART_KEY);
    return value === 'true';
  } catch {
    return false;
  }
};

const setHideAccountNamePart = (hide: boolean): void => {
  try {
    localStorage.setItem(HIDE_ACCOUNT_NAME_PART_KEY, String(hide));
  } catch {
    // Ignore errors
  }
};

const truncateAccountName = (name: string, hide: boolean): string => {
  if (!hide) return name;
  // Garder les 6 premiers caractères et masquer le reste
  if (name.length > 6) {
    return name.substring(0, 6);
  }
  return name;
};

export const TradingAccountSelector: React.FC<TradingAccountSelectorProps> = ({ 
  selectedAccountId, 
  onAccountChange, 
  className = '',
  hideLabel = false 
}) => {
  const { t } = useI18nTranslation();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [hideNamePart, setHideNamePart] = useState<boolean>(getHideAccountNamePart());
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const selectedId = selectedAccountId ?? null;

  const isMountedRef = useRef(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const list = await tradingAccountsService.list();
        setAccounts(list.filter(a => a.status === 'active'));
      } catch {
        setAccounts([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Initialiser le compte par défaut uniquement au premier montage si aucune valeur n'est fournie
  // Ne pas réinitialiser si selectedId est explicitement null (choix "Tous les comptes")
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      // Au premier montage uniquement, initialiser le compte par défaut si aucune valeur n'est fournie
      // selectedAccountId === undefined signifie qu'aucune valeur n'a été fournie
      // selectedAccountId === null signifie que l'utilisateur a choisi "Tous les comptes"
      if (selectedAccountId === undefined) {
        const initDefault = async () => {
          try {
            const def = await tradingAccountsService.default();
            if (def && def.status === 'active') {
              onAccountChange(def);
            }
          } catch {
            // noop
          }
        };
        initDefault();
      }
    }
    // Ne pas réinitialiser après le premier montage - respecter le choix de l'utilisateur
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const options = useMemo(() => {
    const base = accounts.map(a => ({ 
      value: a.id, 
      label: a.name,
      displayLabel: truncateAccountName(a.name, hideNamePart),
      isDefault: !!a.is_default,
      account: a 
    }));
    return [{ value: null, label: t('common:allActiveAccounts'), displayLabel: t('common:allActiveAccounts'), isDefault: false, account: null }, ...base];
  }, [accounts, hideNamePart, t]);

  const currentValue = useMemo(() => {
    if (selectedId === null || selectedId === undefined) return null;
    return selectedId;
  }, [selectedId]);

  const currentOption = useMemo(() => {
    return options.find(o => o.value === currentValue) || options[0];
  }, [options, currentValue]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (open && dropdownRef.current && !dropdownRef.current.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div className={`max-w-sm ${className}`}>
      {!hideLabel && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common:tradingAccount')}</label>
      )}
      <div ref={dropdownRef} className="relative flex items-center gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => setOpen(v => !v)}
          className="flex-1 inline-flex items-center justify-between rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
        >
          <span className="inline-flex items-center gap-2">
            <span className="text-gray-900 dark:text-gray-100">{currentOption?.displayLabel || currentOption?.label || t('common:allActiveAccounts')}</span>
            {currentOption && currentOption.isDefault && (
              <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 text-xs">{t('common:default')}</span>
            )}
          </span>
          <svg className={`h-4 w-4 text-gray-400 dark:text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => {
            const newValue = !hideNamePart;
            setHideNamePart(newValue);
            setHideAccountNamePart(newValue);
          }}
          className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title={hideNamePart ? t('common:showAccountNamePart', { defaultValue: 'Afficher le nom complet' }) : t('common:hideAccountNamePart', { defaultValue: 'Masquer une partie du nom' })}
        >
          {hideNamePart ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg max-h-72 overflow-auto">
            <ul className="py-1 text-sm text-gray-700 dark:text-gray-300">
              {options.map(opt => (
                <li key={opt.value ?? 'all'}>
                  <button
                    type="button"
                    onClick={() => {
                      onAccountChange(opt.account);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${opt.value === currentValue ? 'bg-gray-50 dark:bg-gray-700' : ''}`}
                  >
                    <span className="text-gray-900 dark:text-gray-100">{opt.displayLabel || opt.label}</span>
                    {opt.isDefault && (
                      <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 text-xs">{t('common:default')}</span>
                    )}
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
