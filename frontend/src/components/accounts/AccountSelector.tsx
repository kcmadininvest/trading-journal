import React, { useEffect, useMemo, useRef, useState } from 'react';
import { tradingAccountsService, TradingAccount } from '../../services/tradingAccounts';
import { useTranslation as useI18nTranslation } from 'react-i18next';

interface AccountSelectorProps {
  value?: number | null;
  onChange?: (accountId: number | null) => void;
  allowAllActive?: boolean;
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

// Fonction pour diviser le texte : 4 premiers caractères visibles, le reste flouté
const renderAccountName = (name: string, hide: boolean): React.ReactNode => {
  if (!hide || name.length <= 4) {
    return name;
  }
  const visiblePart = name.substring(0, 4);
  const hiddenPart = name.substring(4);
  return (
    <>
      <span>{visiblePart}</span>
      <span className="blur-sm">{hiddenPart}</span>
    </>
  );
};

export const AccountSelector: React.FC<AccountSelectorProps> = ({ value, onChange, allowAllActive = true, hideLabel = false }) => {
  const { t } = useI18nTranslation();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [hideNamePart, setHideNamePart] = useState<boolean>(getHideAccountNamePart());
  const selectedId = value ?? null;
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [dropdownWidth, setDropdownWidth] = useState<number | undefined>(undefined);
  const [minWidth, setMinWidth] = useState<number | undefined>(undefined);
  const [buttonMinWidth, setButtonMinWidth] = useState<number | undefined>(undefined);
  const [dropdownPosition, setDropdownPosition] = useState<'bottom' | 'top'>('bottom');
  const [maxDropdownHeight, setMaxDropdownHeight] = useState<number | undefined>(undefined);
  const isMountedRef = useRef(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const list = await tradingAccountsService.list();
        // Par défaut ne montrer que les actifs, triés par date de création (plus récent au plus ancien)
        const activeAccounts = list.filter(a => a.status === 'active');
        activeAccounts.sort((a, b) => {
          // Si les deux ont une date de création, trier du plus récent au plus ancien
          if (a.created_at && b.created_at) {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          }
          // Si seulement a a une date, le mettre en premier
          if (a.created_at) return -1;
          // Si seulement b a une date, le mettre en premier
          if (b.created_at) return 1;
          // Si aucun n'a de date, garder l'ordre original
          return 0;
        });
        setAccounts(activeAccounts);
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

  // Calculer la largeur minimale nécessaire pour tous les contenus possibles
  useEffect(() => {
    if (buttonRef.current && options.length > 0) {
      const calculateMinWidth = () => {
        if (!buttonRef.current) return;
        
        // Créer un élément temporaire pour mesurer le texte
        const tempElement = document.createElement('span');
        tempElement.style.visibility = 'hidden';
        tempElement.style.position = 'absolute';
        tempElement.style.whiteSpace = 'nowrap';
        const buttonStyle = window.getComputedStyle(buttonRef.current);
        tempElement.style.fontSize = buttonStyle.fontSize;
        tempElement.style.fontFamily = buttonStyle.fontFamily;
        tempElement.style.fontWeight = buttonStyle.fontWeight;
        document.body.appendChild(tempElement);
        
          // Calculer la largeur pour chaque option
          let maxContentWidth = 0;
          options.forEach(opt => {
            const label = opt.label;
            tempElement.textContent = label;
          const contentWidth = tempElement.offsetWidth;
          // Ajouter de l'espace pour le badge "default" si présent
          const hasBadge = (opt as any).isDefault;
          const badgeWidth = hasBadge ? 80 : 0; // Estimation de la largeur du badge
          const totalWidth = contentWidth + badgeWidth;
          if (totalWidth > maxContentWidth) {
            maxContentWidth = totalWidth;
          }
        });
        
        document.body.removeChild(tempElement);
        
        // Ajouter le padding du bouton (px-3 = 12px de chaque côté) + icône flèche (16px) + gap (8px)
        const buttonPadding = 24; // 12px * 2
        const iconWidth = 16;
        const gap = 8;
        const minButtonWidth = maxContentWidth + buttonPadding + iconWidth + gap;
        
        setButtonMinWidth(minButtonWidth);
      };
      
      // Calculer une fois que le composant est monté
      const timer = setTimeout(calculateMinWidth, 0);
      
      // Recalculer si les options changent
      window.addEventListener('resize', calculateMinWidth);
      
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', calculateMinWidth);
      };
    }
  }, [options]);

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
          } else if (spaceAbove >= minDropdownHeight + marginSafety) {
            // Pas assez d'espace en dessous, mais assez au-dessus
            position = 'top';
            maxHeight = spaceAbove - marginSafety;
          } else {
            // Utiliser l'espace le plus grand
            if (spaceBelow > spaceAbove) {
              position = 'bottom';
              maxHeight = spaceBelow - marginSafety;
            } else {
              position = 'top';
              maxHeight = spaceAbove - marginSafety;
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
          
          // Utiliser le maximum entre la largeur minimale (bouton) et la largeur du contenu
          const finalWidth = Math.max(buttonWidth, maxContentWidth);
          setDropdownWidth(finalWidth);
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
      <div ref={dropdownRef} className="relative flex items-center gap-2">
        <button
          ref={buttonRef}
          type="button"
          disabled={loading}
          onClick={() => setOpen(v => !v)}
          className="flex-1 inline-flex items-center justify-between rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ minWidth: buttonMinWidth ? `${buttonMinWidth}px` : undefined }}
        >
          <span className="inline-flex items-center gap-2 min-w-0 flex-1">
            <span className="text-gray-900 dark:text-gray-100 truncate transition-all duration-200">
              {renderAccountName(currentOption?.label || t('common:allActiveAccounts'), hideNamePart)}
            </span>
            {currentOption && (currentOption as any).isDefault && (
              <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 text-xs flex-shrink-0">{t('common:default')}</span>
            )}
          </span>
          <svg className={`h-4 w-4 text-gray-400 dark:text-gray-500 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </button>
        <button
          type="button"
          onClick={() => {
            const newValue = !hideNamePart;
            setHideNamePart(newValue);
            setHideAccountNamePart(newValue);
          }}
          className="p-1.5 sm:p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0"
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
          <div 
            className="absolute z-50 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-auto"
            style={{ 
              width: dropdownWidth ? `${dropdownWidth}px` : '100%',
              minWidth: buttonMinWidth ? `${buttonMinWidth}px` : (minWidth ? `${minWidth}px` : undefined),
              maxHeight: maxDropdownHeight ? `${maxDropdownHeight}px` : '288px',
              ...(dropdownPosition === 'bottom' 
                ? { top: '100%', marginTop: '4px' }
                : { bottom: '100%', marginBottom: '4px' }
              )
            }}
          >
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
                    <span className="text-gray-900 dark:text-gray-100 whitespace-nowrap flex-1 text-left transition-all duration-200">
                      {renderAccountName(opt.label, hideNamePart)}
                    </span>
                    {(opt as any).isDefault && <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 text-xs flex-shrink-0 ml-2">{t('common:default')}</span>}
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


