import React, { useState, useEffect, useCallback } from 'react';
import { positionStrategiesService, PositionStrategy } from '../services/positionStrategies';
import { useTranslation as useI18nTranslation } from 'react-i18next';

const STORAGE_KEY_PREFIX = 'strategy-checklist-';

const StrategyChecklistPopup: React.FC = () => {
  const { t } = useI18nTranslation();
  const [strategy, setStrategy] = useState<PositionStrategy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkedRules, setCheckedRules] = useState<Record<string, boolean>>({});
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());

  // Extraire l'ID de la stratégie depuis les query params
  const strategyId = new URLSearchParams(window.location.search).get('strategyId');
  const storageKey = strategyId ? `${STORAGE_KEY_PREFIX}${strategyId}` : null;

  // Appliquer le thème depuis localStorage et synchroniser en temps réel
  useEffect(() => {
    const applyTheme = () => {
      try {
        const theme = localStorage.getItem('theme');
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch {
        // Ignorer
      }
    };

    applyTheme();

    // Appliquer la taille de police
    try {
      const savedFontSize = localStorage.getItem('font_size');
      if (savedFontSize === 'small' || savedFontSize === 'medium' || savedFontSize === 'large') {
        document.documentElement.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
        document.documentElement.classList.add(`font-size-${savedFontSize}`);
      }
    } catch {
      // Ignorer
    }

    // Écouter les changements de thème depuis la fenêtre principale
    const handleStorageTheme = (e: StorageEvent) => {
      if (e.key === 'theme') {
        applyTheme();
      }
    };

    window.addEventListener('storage', handleStorageTheme);
    return () => window.removeEventListener('storage', handleStorageTheme);
  }, []);

  // Charger la stratégie
  useEffect(() => {
    if (!strategyId) {
      setError(t('positionStrategies:noStrategies', { defaultValue: 'Aucune stratégie trouvée' }));
      setIsLoading(false);
      return;
    }

    const loadStrategy = async () => {
      try {
        const data = await positionStrategiesService.get(Number(strategyId));
        setStrategy(data);

        // Restaurer les cases cochées depuis localStorage
        if (storageKey) {
          try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
              setCheckedRules(JSON.parse(saved));
            }
          } catch {
            // Ignorer
          }
        }
      } catch (err: any) {
        setError(err.message || t('common:error', { defaultValue: 'Erreur' }));
      } finally {
        setIsLoading(false);
      }
    };

    loadStrategy();
  }, [strategyId, storageKey, t]);

  // Synchroniser les cases cochées via l'événement storage (entre fenêtres)
  useEffect(() => {
    if (!storageKey) return;

    const handleStorage = (e: StorageEvent) => {
      if (e.key === storageKey) {
        if (e.newValue) {
          try {
            setCheckedRules(JSON.parse(e.newValue));
          } catch {
            // Ignorer
          }
        } else {
          // Clé supprimée = reset
          setCheckedRules({});
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [storageKey]);

  // Sauvegarder les cases cochées dans localStorage
  const saveCheckedRules = useCallback((newChecked: Record<string, boolean>) => {
    setCheckedRules(newChecked);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(newChecked));
      } catch {
        // Ignorer
      }
    }
  }, [storageKey]);

  // Toggle une règle
  const toggleRule = (sectionIndex: number, ruleIndex: number) => {
    const ruleKey = `${sectionIndex}_${ruleIndex}`;
    const newChecked = {
      ...checkedRules,
      [ruleKey]: !checkedRules[ruleKey]
    };
    saveCheckedRules(newChecked);
  };

  // Réinitialiser toutes les cases
  const resetChecklist = () => {
    saveCheckedRules({});
  };

  // Calculer le pourcentage
  const calculatePercentage = (): number => {
    if (!strategy?.strategy_content?.sections) return 0;

    let totalRules = 0;
    let checked = 0;

    strategy.strategy_content.sections.forEach((section, sectionIndex) => {
      if (section.rules && section.rules.length > 0) {
        section.rules.forEach((rule, ruleIndex) => {
          if (typeof rule === 'string' ? rule.trim() : rule) {
            totalRules++;
            const ruleKey = `${sectionIndex}_${ruleIndex}`;
            if (checkedRules[ruleKey]) {
              checked++;
            }
          }
        });
      }
    });

    return totalRules > 0 ? Math.round((checked / totalRules) * 100) : 0;
  };

  // Compter les règles
  const countRules = (): { total: number; checked: number } => {
    if (!strategy?.strategy_content?.sections) return { total: 0, checked: 0 };

    let total = 0;
    let checked = 0;

    strategy.strategy_content.sections.forEach((section, sectionIndex) => {
      if (section.rules && section.rules.length > 0) {
        section.rules.forEach((rule, ruleIndex) => {
          if (typeof rule === 'string' ? rule.trim() : rule) {
            total++;
            const ruleKey = `${sectionIndex}_${ruleIndex}`;
            if (checkedRules[ruleKey]) {
              checked++;
            }
          }
        });
      }
    });

    return { total, checked };
  };

  const percentage = calculatePercentage();
  const { total, checked } = countRules();

  // Mettre à jour le titre de la fenêtre
  useEffect(() => {
    if (strategy) {
      document.title = `${strategy.title} - ${t('positionStrategies:strategyChecklist', { defaultValue: 'Checklist' })}`;
    }
  }, [strategy, t]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-3"></div>
          <p className="text-sm text-gray-600 dark:text-gray-300">{t('positionStrategies:loading', { defaultValue: 'Chargement...' })}</p>
        </div>
      </div>
    );
  }

  if (error || !strategy) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <svg className="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header compact sticky */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-3 py-2.5">
          {/* Titre et bouton reset */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate flex-1">
              {strategy.title}
            </h1>
            <button
              onClick={resetChecklist}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors flex-shrink-0"
              title={t('positionStrategies:resetChecklist', { defaultValue: 'Tout décocher' })}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {t('positionStrategies:resetChecklist', { defaultValue: 'Tout décocher' })}
            </button>
          </div>

          {/* Barre de progression */}
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  percentage >= 80 ? 'bg-green-500' :
                  percentage >= 50 ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span className={`text-xs font-bold min-w-[3rem] text-right ${
              percentage >= 80 ? 'text-green-600 dark:text-green-400' :
              percentage >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
              'text-red-600 dark:text-red-400'
            }`}>
              {percentage}%
            </span>
          </div>

          {/* Compteur de règles */}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('positionStrategies:rulesFollowed', { 
              defaultValue: '{{checked}} / {{total}} règles suivies',
              checked: checked,
              total: total
            })}
          </p>
        </div>
      </div>

      {/* Contenu scrollable */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
        {strategy.strategy_content?.sections && strategy.strategy_content.sections.length > 0 ? (
          strategy.strategy_content.sections.map((section, sectionIndex) => {
            // Compter directement sur les index originaux (corrige le bug indexOf avec doublons)
            const rules = section.rules || [];
            let sectionTotal = 0;
            let sectionChecked = 0;
            rules.forEach((rule, ruleIndex) => {
              const ruleText = typeof rule === 'string' ? rule : (rule && typeof rule === 'object' ? ((rule as any)?.text || '') : String(rule || ''));
              if (ruleText.trim()) {
                sectionTotal++;
                const ruleKey = `${sectionIndex}_${ruleIndex}`;
                if (checkedRules[ruleKey]) sectionChecked++;
              }
            });

            if (sectionTotal === 0) return null;

            const isCollapsed = collapsedSections.has(sectionIndex);
            const isSectionComplete = sectionChecked === sectionTotal && sectionTotal > 0;

            return (
              <div key={sectionIndex} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                {/* En-tête de section (cliquable pour replier/déplier) */}
                <button
                  type="button"
                  onClick={() => {
                    setCollapsedSections(prev => {
                      const next = new Set(prev);
                      if (next.has(sectionIndex)) {
                        next.delete(sectionIndex);
                      } else {
                        next.add(sectionIndex);
                      }
                      return next;
                    });
                  }}
                  className={`w-full px-3 py-2 border-b border-gray-200 dark:border-gray-600 text-left transition-colors ${
                    isSectionComplete
                      ? 'bg-green-50 dark:bg-green-900/20'
                      : 'bg-gray-50 dark:bg-gray-700/50'
                  } hover:bg-gray-100 dark:hover:bg-gray-600/50`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <svg
                        className={`w-3.5 h-3.5 text-gray-400 dark:text-gray-500 transition-transform flex-shrink-0 ${
                          isCollapsed ? '' : 'rotate-90'
                        }`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <h3 className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                        {section.title || t('positionStrategies:sectionWithoutTitle', { defaultValue: 'Section sans titre' })}
                      </h3>
                    </div>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${
                      isSectionComplete
                        ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                    }`}>
                      {sectionChecked}/{sectionTotal}
                    </span>
                  </div>
                </button>

                {/* Règles (repliables) */}
                {!isCollapsed && (
                  <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {rules.map((rule, ruleIndex) => {
                      let ruleText: string;
                      if (typeof rule === 'string') {
                        ruleText = rule;
                      } else if (rule && typeof rule === 'object') {
                        ruleText = (rule as any)?.text || (rule as any)?.id || JSON.stringify(rule);
                      } else {
                        ruleText = String(rule || '');
                      }

                      if (!ruleText.trim()) return null;

                      const ruleKey = `${sectionIndex}_${ruleIndex}`;
                      const isChecked = checkedRules[ruleKey] || false;

                      return (
                        <label
                          key={ruleIndex}
                          className={`flex items-start gap-2.5 px-3 py-2 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30 ${
                            isChecked ? 'bg-green-50/50 dark:bg-green-900/10' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleRule(sectionIndex, ruleIndex)}
                            className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 cursor-pointer flex-shrink-0"
                          />
                          <span className={`text-xs leading-relaxed flex-1 ${
                            isChecked 
                              ? 'line-through text-gray-400 dark:text-gray-500' 
                              : 'text-gray-700 dark:text-gray-300'
                          }`}>
                            {ruleText}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <p className="text-xs text-gray-500 dark:text-gray-400 italic text-center py-4">
            {t('positionStrategies:noSections', { defaultValue: 'Aucune section définie' })}
          </p>
        )}
      </div>

      {/* Footer compact */}
      {percentage === 100 && (
        <div className="sticky bottom-0 bg-green-50 dark:bg-green-900/30 border-t border-green-200 dark:border-green-800 px-3 py-2 text-center">
          <p className="text-xs font-medium text-green-700 dark:text-green-300">
            ✓ {t('positionStrategies:allRulesFollowed', { defaultValue: 'Toutes les règles sont respectées !' })}
          </p>
        </div>
      )}
    </div>
  );
};

export default StrategyChecklistPopup;
