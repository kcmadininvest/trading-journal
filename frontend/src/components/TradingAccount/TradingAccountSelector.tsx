import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TradingAccount, tradingAccountsService } from '../../services/tradingAccounts';

interface TradingAccountSelectorProps {
  selectedAccountId?: number | null;
  onAccountChange: (account: TradingAccount | null) => void;
  className?: string;
  hideLabel?: boolean;
}

export const TradingAccountSelector: React.FC<TradingAccountSelectorProps> = ({ 
  selectedAccountId, 
  onAccountChange, 
  className = '',
  hideLabel = false 
}) => {
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const selectedId = selectedAccountId ?? null;

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

  // Si aucune valeur n'est fournie, sélectionner automatiquement le compte par défaut
  useEffect(() => {
    const initDefault = async () => {
      if (selectedId == null) {
        try {
          const def = await tradingAccountsService.default();
          if (def && def.status === 'active') {
            onAccountChange(def);
          }
        } catch {
          // noop
        }
      }
    };
    initDefault();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const options = useMemo(() => {
    const base = accounts.map(a => ({ 
      value: a.id, 
      label: a.name, 
      isDefault: !!a.is_default,
      account: a 
    }));
    return [{ value: null, label: 'Tous les comptes actifs', isDefault: false, account: null }, ...base];
  }, [accounts]);

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
      <label className="block text-sm font-medium text-gray-700 mb-1">Compte de trading</label>
      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          disabled={loading}
          onClick={() => setOpen(v => !v)}
          className="w-full inline-flex items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <span className="inline-flex items-center gap-2">
            <span className="text-gray-900">{currentOption?.label || 'Tous les comptes actifs'}</span>
            {currentOption && currentOption.isDefault && (
              <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-xs">Par défaut</span>
            )}
          </span>
          <svg className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg max-h-72 overflow-auto">
            <ul className="py-1 text-sm text-gray-700">
              {options.map(opt => (
                <li key={opt.value ?? 'all'}>
                  <button
                    type="button"
                    onClick={() => {
                      onAccountChange(opt.account);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 ${opt.value === currentValue ? 'bg-gray-50' : ''}`}
                  >
                    <span className="text-gray-900">{opt.label}</span>
                    {opt.isDefault && (
                      <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-xs">Par défaut</span>
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
