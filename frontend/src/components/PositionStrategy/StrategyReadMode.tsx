import React, { useState, useEffect, useCallback } from 'react';
import { positionStrategiesService } from '../../services/positionStrategies';

interface Rule {
  id: number;
  text: string;
  checked: boolean;
}

interface Section {
  title: string;
  rules: Rule[];
}

interface StrategyReadModeData {
  id: number;
  title: string;
  description: string;
  version: number;
  status: string;
  created_at: string;
  updated_at: string;
  sections: Section[];
}

interface StrategyReadModeProps {
  strategyId: number;
  onClose: () => void;
}

const StrategyReadMode: React.FC<StrategyReadModeProps> = ({ strategyId, onClose }) => {
  const [strategy, setStrategy] = useState<StrategyReadModeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkedRules, setCheckedRules] = useState<Set<string>>(new Set());

  const loadStrategy = useCallback(async () => {
    try {
      setLoading(true);
      const data = await positionStrategiesService.getReadMode(strategyId);
      setStrategy(data);
    } catch (err) {
      console.error('Erreur lors du chargement de la stratégie:', err);
      setError('Erreur lors du chargement de la stratégie');
    } finally {
      setLoading(false);
    }
  }, [strategyId]);

  useEffect(() => {
    loadStrategy();
  }, [loadStrategy]);

  const handleRuleToggle = (sectionIndex: number, ruleId: number) => {
    const ruleKey = `${sectionIndex}-${ruleId}`;
    const newCheckedRules = new Set(checkedRules);
    
    if (checkedRules.has(ruleKey)) {
      newCheckedRules.delete(ruleKey);
    } else {
      newCheckedRules.add(ruleKey);
    }
    
    setCheckedRules(newCheckedRules);
  };

  const getSectionProgress = (section: Section, sectionIndex: number) => {
    const totalRules = section.rules.length;
    const checkedCount = section.rules.filter((_, ruleIndex) => 
      checkedRules.has(`${sectionIndex}-${section.rules[ruleIndex].id}`)
    ).length;
    
    return {
      checked: checkedCount,
      total: totalRules,
      percentage: totalRules > 0 ? Math.round((checkedCount / totalRules) * 100) : 0
    };
  };

  const getOverallProgress = () => {
    if (!strategy) return { checked: 0, total: 0, percentage: 0 };
    
    const totalRules = strategy.sections.reduce((sum, section) => sum + section.rules.length, 0);
    const checkedCount = checkedRules.size;
    
    return {
      checked: checkedCount,
      total: totalRules,
      percentage: totalRules > 0 ? Math.round((checkedCount / totalRules) * 100) : 0
    };
  };

  const resetProgress = () => {
    setCheckedRules(new Set());
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Chargement...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !strategy) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
          <div className="text-center">
            <div className="text-red-600 mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Erreur</h3>
            <p className="text-gray-600 mb-4">{error || 'Stratégie non trouvée'}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    );
  }

  const overallProgress = getOverallProgress();

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{strategy.title}</h2>
              <p className="text-sm text-gray-600">Version {strategy.version} • {strategy.status}</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={resetProgress}
                className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Réinitialiser
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-4 bg-blue-50 border-b border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-900">Progression globale</span>
            <span className="text-sm text-blue-700">{overallProgress.checked}/{overallProgress.total} règles</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${overallProgress.percentage}%` }}
            ></div>
          </div>
          <div className="text-center mt-1">
            <span className="text-sm text-blue-700">{overallProgress.percentage}% complété</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {strategy.description && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Description</h3>
              <p className="text-gray-700">{strategy.description}</p>
            </div>
          )}

          <div className="space-y-6">
            {strategy.sections.map((section, sectionIndex) => {
              const progress = getSectionProgress(section, sectionIndex);
              
              return (
                <div key={sectionIndex} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">{section.title}</h3>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">
                        {progress.checked}/{progress.total}
                      </span>
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {section.rules.map((rule, ruleIndex) => {
                      const ruleKey = `${sectionIndex}-${rule.id}`;
                      const isChecked = checkedRules.has(ruleKey);
                      
                      return (
                        <div 
                          key={rule.id}
                          className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                            isChecked 
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            id={`rule-${ruleKey}`}
                            checked={isChecked}
                            onChange={() => handleRuleToggle(sectionIndex, rule.id)}
                            className="mt-1 h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                          />
                          <label 
                            htmlFor={`rule-${ruleKey}`}
                            className={`flex-1 text-sm cursor-pointer ${
                              isChecked ? 'text-green-800 line-through' : 'text-gray-700'
                            }`}
                          >
                            {rule.text}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StrategyReadMode;
