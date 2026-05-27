import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { tradingAccountsService, TradingAccount } from '../../services/tradingAccounts';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { bandAccountTriggerClass } from '../dashboard/filterBarStyles';

interface AccountSelectorProps {
  value?: number | null;
  onChange?: (accountId: number | null) => void;
  allowAllActive?: boolean;
  hideLabel?: boolean;
  hideAccountNumber?: boolean;
  variant?: 'default' | 'band';
  /**
   * undefined : charge via list() comme avant.
   * null : parent pas encore prêt (affichage chargement, pas d'init compte défaut).
   * tableau : liste prête du parent (y compris []), pas d'appel list() au montage.
   */
  prefetchedAccounts?: TradingAccount[] | null;
}

// Cache pour les noms masqués pour éviter de recalculer à chaque rendu
const maskedNamesCache = new Map<string, React.ReactNode>();

// Fonction pour diviser le texte : 7 premiers caractères visibles, le reste masqué par des astérisques
const renderAccountName = (name: string, hide: boolean): React.ReactNode => {
  if (!hide || name.length <= 7) {
    return name;
  }
  
  // Utiliser le cache pour éviter de recréer les éléments React
  const cacheKey = `${name}-${hide}`;
  if (maskedNamesCache.has(cacheKey)) {
    return maskedNamesCache.get(cacheKey);
  }
  
  const visiblePart = name.substring(0, 7);
  const hiddenPart = name.substring(7);
  const maskedPart = '•'.repeat(hiddenPart.length);
  const result = (
    <>
      <span>{visiblePart}</span>
      <span className="text-gray-400 dark:text-gray-500 tracking-wider">{maskedPart}</span>
    </>
  );
  
  maskedNamesCache.set(cacheKey, result);
  return result;
};

function normalizeActiveAccountsSorted(list: TradingAccount[]): TradingAccount[] {
  const activeAccounts = list.filter((a) => a.status === 'active');
  activeAccounts.sort((a, b) => {
    const aDef = !!a.is_default;
    const bDef = !!b.is_default;
    if (aDef !== bDef) {
      return aDef ? -1 : 1;
    }
    if (a.created_at && b.created_at) {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    if (a.created_at) return -1;
    if (b.created_at) return 1;
    return 0;
  });
  return activeAccounts;
}

const AccountSelectorComponent: React.FC<AccountSelectorProps> = ({
  value,
  onChange,
  allowAllActive = true,
  hideLabel = false,
  hideAccountNumber = false,
  prefetchedAccounts,
  variant = 'default',
}) => {
  const { t } = useI18nTranslation();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const selectedId = value ?? null;
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [dropdownWidth, setDropdownWidth] = useState<number | undefined>(undefined);
  const [minWidth, setMinWidth] = useState<number | undefined>(undefined);
  const [dropdownTop, setDropdownTop] = useState<number | undefined>(undefined);
  const [dropdownLeft, setDropdownLeft] = useState<number | undefined>(undefined);
  const [dropdownPosition, setDropdownPosition] = useState<'bottom' | 'top'>('bottom');
  const [maxDropdownHeight, setMaxDropdownHeight] = useState<number | undefined>(undefined);
  const isMountedRef = useRef(false);

  useEffect(() => {
    if (prefetchedAccounts === null) {
      setAccounts([]);
      setLoading(true);
      return;
    }

    if (prefetchedAccounts !== undefined) {
      setAccounts(normalizeActiveAccountsSorted(prefetchedAccounts));
      setLoading(false);

      const handleLogin = async () => {
        try {
          const list = await tradingAccountsService.list();
          setAccounts(normalizeActiveAccountsSorted(list));
        } catch {
          setAccounts([]);
        }
      };
      window.addEventListener('user:login', handleLogin);
      return () => window.removeEventListener('user:login', handleLogin);
    }

    const load = async () => {
      setLoading(true);
      try {
        const list = await tradingAccountsService.list();
        setAccounts(normalizeActiveAccountsSorted(list));
      } catch {
        setAccounts([]);
      } finally {
        setLoading(false);
      }
    };
    load();

    const handleLogin = () => {
      load();
    };

    window.addEventListener('user:login', handleLogin);

    return () => {
      window.removeEventListener('user:login', handleLogin);
    };
  }, [prefetchedAccounts]);

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

      // Liste vide OU liste sans drapeau is_default : même source que le contexte global
      const initDefault = async () => {
        try {
          const def = await tradingAccountsService.default();
          if (def && def.status === 'active' && !isMountedRef.current) {
            isMountedRef.current = true;
            onChange(def.id);
          }
        } catch {
          // noop
        } finally {
          isMountedRef.current = true;
        }
      };
      initDefault();
    }
    // Ne pas réinitialiser après le premier montage - respecter le choix de l'utilisateur
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, loading]);

  const options = useMemo(() => {
    const base = accounts.map(a => ({ 
      value: a.id, 
      label: a.name,
      isDefault: !!a.is_default 
    }));
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

  // Réinitialiser les positions quand on ferme le dropdown
  useEffect(() => {
    if (!open) {
      setDropdownTop(undefined);
      setDropdownLeft(undefined);
    }
  }, [open]);

  // Calculer la largeur minimale (bouton) et la largeur nécessaire pour le contenu
  // + position et hauteur adaptative
  useEffect(() => {
    if (open && buttonRef.current) {
      const updateDimensions = () => {
        if (buttonRef.current) {
          const buttonWidth = buttonRef.current.offsetWidth;
          const buttonRect = buttonRef.current.getBoundingClientRect();
          setMinWidth(buttonWidth);

          // Calculer l'espace disponible au-dessus et en dessous du bouton
          const spaceBelow = window.innerHeight - buttonRect.bottom;
          const spaceAbove = buttonRect.top;
          const marginSafety = 16; // Marge de sécurité
          const minDropdownHeight = 200; // Hauteur minimale du dropdown
          
          // Déterminer la position optimale
          let position: 'bottom' | 'top' = 'bottom';
          let maxHeight: number;
          
          if (spaceBelow >= minDropdownHeight + marginSafety) {
            // Assez d'espace en dessous
            position = 'bottom';
            maxHeight = spaceBelow - marginSafety;
            setDropdownTop(buttonRect.bottom + 4);
          } else if (spaceAbove >= minDropdownHeight + marginSafety) {
            // Pas assez d'espace en dessous, mais assez au-dessus
            position = 'top';
            maxHeight = spaceAbove - marginSafety;
            setDropdownTop(buttonRect.top - 4);
          } else {
            // Utiliser l'espace le plus grand
            if (spaceBelow > spaceAbove) {
              position = 'bottom';
              maxHeight = spaceBelow - marginSafety;
              setDropdownTop(buttonRect.bottom + 4);
            } else {
              position = 'top';
              maxHeight = spaceAbove - marginSafety;
              setDropdownTop(buttonRect.top - 4);
            }
          }
          
          setDropdownPosition(position);
          setMaxDropdownHeight(maxHeight);
          
          // Calculer la largeur nécessaire pour le contenu le plus long
          const tempElement = document.createElement('span');
          tempElement.style.visibility = 'hidden';
          tempElement.style.position = 'absolute';
          tempElement.style.whiteSpace = 'nowrap';
          tempElement.style.fontSize = window.getComputedStyle(buttonRef.current).fontSize;
          tempElement.style.fontFamily = window.getComputedStyle(buttonRef.current).fontFamily;
          tempElement.style.padding = '0 12px'; // px-3
          document.body.appendChild(tempElement);
          
          let maxContentWidth = buttonWidth;
          options.forEach(opt => {
            const label = opt.label;
            tempElement.textContent = label;
            const contentWidth = tempElement.offsetWidth;
            // Ajouter de l'espace pour le badge "default" si présent
            const hasBadge = (opt as any).isDefault;
            const badgeWidth = hasBadge ? 80 : 0; // Estimation de la largeur du badge
            if (contentWidth + badgeWidth > maxContentWidth) {
              maxContentWidth = contentWidth + badgeWidth;
            }
          });
          
          document.body.removeChild(tempElement);

          const viewportMargin = 16;
          const maxViewportWidth = Math.max(
            buttonWidth,
            window.innerWidth - buttonRect.left - viewportMargin,
          );
          const idealWidth = Math.max(buttonWidth, maxContentWidth);
          const finalWidth = Math.min(idealWidth, maxViewportWidth);
          setDropdownWidth(finalWidth);
          setDropdownLeft(
            Math.max(viewportMargin, Math.min(buttonRect.left, window.innerWidth - finalWidth - viewportMargin)),
          );
        }
      };
      
      // Attendre que le DOM soit prêt et que le bouton soit rendu
      const timer = setTimeout(() => {
        updateDimensions();
      }, 10);
      
      // Mettre à jour les dimensions lors du resize ou scroll
      window.addEventListener('resize', updateDimensions);
      window.addEventListener('scroll', updateDimensions, true);
      
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', updateDimensions);
        window.removeEventListener('scroll', updateDimensions, true);
      };
    } else {
      // Réinitialiser les dimensions quand le dropdown est fermé
      setDropdownWidth(undefined);
      setMinWidth(undefined);
      setDropdownPosition('bottom');
      setMaxDropdownHeight(undefined);
    }
  }, [open, options]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        open &&
        !dropdownRef.current?.contains(t) &&
        !menuRef.current?.contains(t)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const isBand = variant === 'band';
  const triggerClass = isBand
    ? bandAccountTriggerClass
    : 'flex-1 inline-flex h-10 items-center gap-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
  const labelTextClass = isBand
    ? 'text-white truncate transition-all duration-200'
    : 'text-gray-900 dark:text-gray-100 truncate transition-all duration-200';
  const defaultBadgeClass = isBand
    ? 'inline-flex items-center rounded-full border border-white/20 bg-white/15 px-2 py-0.5 text-xs text-white flex-shrink-0'
    : 'inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 text-xs flex-shrink-0';
  const chevronClass = isBand
    ? `h-4 w-4 text-white/50 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`
    : `h-4 w-4 text-gray-400 dark:text-gray-500 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`;

  return (
    <div className={hideLabel ? 'min-w-0 w-full max-w-full' : 'mb-4 w-full max-w-sm'}>
      {!hideLabel && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common:tradingAccount')}</label>
      )}
      <div ref={dropdownRef} className="relative flex w-full min-w-0 items-center gap-2">
        <button
          ref={buttonRef}
          type="button"
          disabled={loading}
          onClick={() => setOpen(v => !v)}
          className={`${triggerClass} w-full min-w-0`}
        >
          <span className="inline-flex items-center gap-2 min-w-0 flex-1">
            <span className={labelTextClass}>
              {renderAccountName(currentOption?.label || t('common:allActiveAccounts'), hideAccountNumber)}
            </span>
            {currentOption && (currentOption as any).isDefault && (
              <span className={defaultBadgeClass}>{t('common:default')}</span>
            )}
          </span>
          <svg className={chevronClass} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </button>
        {open &&
          dropdownTop !== undefined &&
          dropdownLeft !== undefined &&
          typeof document !== 'undefined' &&
          createPortal(
            <div
              ref={menuRef}
              role="listbox"
              className="fixed z-[9999] rounded-md border border-gray-200 bg-white shadow-lg overflow-y-auto overflow-x-hidden dark:border-gray-700 dark:bg-gray-800"
              style={{
                width: dropdownWidth ? `${dropdownWidth}px` : minWidth ? `${minWidth}px` : '200px',
                maxHeight: maxDropdownHeight ? `${maxDropdownHeight}px` : '288px',
                top: `${dropdownTop}px`,
                left: `${dropdownLeft}px`,
                ...(dropdownPosition === 'top' ? { transform: 'translateY(-100%)' } : {}),
              }}
            >
              <ul className="py-1 text-sm text-gray-700 dark:text-gray-300">
                {options.map((opt) => (
                  <li key={opt.value}>
                    <button
                      type="button"
                      onClick={() => {
                        if (opt.value === 0) onChange && onChange(null);
                        else onChange && onChange(opt.value as number);
                        setOpen(false);
                      }}
                      className={`flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left transition-colors ${
                        opt.value === currentValue
                          ? 'bg-blue-50/90 font-medium text-blue-900 dark:bg-blue-950/45 dark:text-blue-100'
                          : 'text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span
                        className={`min-w-0 flex-1 truncate text-left transition-all duration-200 ${
                          opt.value === currentValue
                            ? 'text-blue-900 dark:text-blue-100'
                            : 'text-gray-900 dark:text-gray-100'
                        }`}
                      >
                        {renderAccountName(opt.label, hideAccountNumber)}
                      </span>
                      {(opt as any).isDefault && (
                        <span className="inline-flex flex-shrink-0 items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                          {t('common:default')}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>,
            document.body
          )}
      </div>
    </div>
  );
};

// Mémoïser le composant pour éviter les re-rendus inutiles
export const AccountSelector = React.memo(AccountSelectorComponent, (prevProps, nextProps) => {
  return (
    prevProps.value === nextProps.value &&
    prevProps.allowAllActive === nextProps.allowAllActive &&
    prevProps.hideLabel === nextProps.hideLabel &&
    prevProps.hideAccountNumber === nextProps.hideAccountNumber &&
    prevProps.prefetchedAccounts === nextProps.prefetchedAccounts &&
    prevProps.variant === nextProps.variant
  );
});

