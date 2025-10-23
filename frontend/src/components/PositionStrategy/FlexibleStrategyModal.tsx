import React, { useState, useEffect } from 'react';
import { PositionStrategy } from '../../services/positionStrategies';

interface FlexibleStrategyModalProps {
  strategy?: PositionStrategy;
  onClose: () => void;
  onSave: (data: any) => void;
}

interface Section {
  id?: number;
  title: string;
  rules: Array<{
    id?: number;
    text: string;
  }>;
}

const FlexibleStrategyModal: React.FC<FlexibleStrategyModalProps> = ({
  strategy,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'draft' as 'draft' | 'active' | 'archived',
    strategy_content: {
      sections: [] as Section[]
    },
    version_notes: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (strategy) {
      // Adapter la structure backend vers la structure frontend
      const adaptedSections = (strategy.strategy_content?.sections || []).map((section, sectionIndex) => ({
        id: sectionIndex + 1,
        title: section.title,
        rules: (section.rules || []).map((rule, ruleIndex) => ({
          id: ruleIndex + 1,
          text: rule.text
        }))
      }));

      setFormData({
        title: strategy.title,
        description: strategy.description,
        status: strategy.status,
        strategy_content: {
          sections: adaptedSections
        },
        version_notes: ''
      });
    } else {
      // Créer une section par défaut
      setFormData(prev => ({
        ...prev,
        strategy_content: {
          sections: [{
            id: Date.now(),
            title: 'Préparation',
            rules: [{
              id: Date.now() + 1,
              text: ''
            }]
          }]
        }
      }));
    }
  }, [strategy]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Adapter la structure frontend vers la structure backend
      const adaptedData = {
        ...formData,
        strategy_content: {
          sections: formData.strategy_content.sections.map(section => ({
            title: section.title,
            rules: section.rules.map(rule => ({
              id: rule.id || Date.now(),
              text: rule.text
            }))
          }))
        },
        // Ne créer une nouvelle version que si ce n'est pas un brouillon
        create_new_version: formData.status !== 'draft'
      };

      await onSave(adaptedData);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addSection = () => {
    const newSection: Section = {
      id: Date.now(),
      title: '',
      rules: [{
        id: Date.now() + 1,
        text: ''
      }]
    };

    setFormData(prev => ({
      ...prev,
      strategy_content: {
        sections: [...prev.strategy_content.sections, newSection]
      }
    }));
  };

  const removeSection = (sectionId: number) => {
    setFormData(prev => ({
      ...prev,
      strategy_content: {
        sections: prev.strategy_content.sections.filter(section => (section.id || 0) !== sectionId)
      }
    }));
  };

  const updateSectionTitle = (sectionId: number, title: string) => {
    setFormData(prev => ({
      ...prev,
      strategy_content: {
        sections: prev.strategy_content.sections.map(section =>
          (section.id || 0) === sectionId ? { ...section, title } : section
        )
      }
    }));
  };

  const addRule = (sectionId: number) => {
    const newRule = {
      id: Date.now(),
      text: ''
    };

    setFormData(prev => ({
      ...prev,
      strategy_content: {
        sections: prev.strategy_content.sections.map(section =>
          (section.id || 0) === sectionId 
            ? { ...section, rules: [...section.rules, newRule] }
            : section
        )
      }
    }));
  };

  const updateRule = (sectionId: number, ruleId: number, text: string) => {
    setFormData(prev => ({
      ...prev,
      strategy_content: {
        sections: prev.strategy_content.sections.map(section =>
          (section.id || 0) === sectionId
            ? {
                ...section,
                rules: section.rules.map(rule =>
                  (rule.id || 0) === ruleId ? { ...rule, text } : rule
                )
              }
            : section
        )
      }
    }));
  };

  const removeRule = (sectionId: number, ruleId: number) => {
    setFormData(prev => ({
      ...prev,
      strategy_content: {
        sections: prev.strategy_content.sections.map(section =>
          (section.id || 0) === sectionId
            ? {
                ...section,
                rules: section.rules.filter(rule => (rule.id || 0) !== ruleId)
              }
            : section
        )
      }
    }));
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {strategy ? 'Modifier la stratégie' : 'Nouvelle stratégie'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="p-6 space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Titre *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Statut
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="draft">Brouillon</option>
                  <option value="active">Active</option>
                  <option value="archived">Archivée</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Description courte de la stratégie..."
              />
            </div>

            {/* Sections dynamiques */}
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Sections de la stratégie</h3>
                <button
                  type="button"
                  onClick={addSection}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Ajouter une section
                </button>
              </div>

              {(formData.strategy_content.sections || []).map((section, sectionIndex) => (
                <div key={section.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-center mb-4">
                    <input
                      type="text"
                      value={section.title}
                      onChange={(e) => updateSectionTitle(section.id || sectionIndex, e.target.value)}
                      className="text-lg font-semibold text-gray-900 bg-transparent border-none outline-none flex-1 mr-4"
                      placeholder="Titre de la section (ex: Préparation, Analyse technique, Conditions d'entrée...)"
                    />
                    {formData.strategy_content.sections.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSection(section.id || sectionIndex)}
                        className="text-red-600 hover:text-red-700 p-1"
                        title="Supprimer cette section"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="block text-sm font-medium text-gray-700">
                        Règles de cette section
                      </label>
                      <button
                        type="button"
                        onClick={() => addRule(section.id || sectionIndex)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        + Ajouter une règle
                      </button>
                    </div>

                    <div className="space-y-2">
                      {section.rules.map((rule, ruleIndex) => (
                        <div key={rule.id} className="flex gap-2 items-center">
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="checkbox"
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              disabled
                            />
                            <input
                              type="text"
                              value={rule.text}
                              onChange={(e) => updateRule(section.id || sectionIndex, rule.id || ruleIndex, e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Décrivez la règle ou condition..."
                            />
                          </div>
                          {section.rules.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeRule(section.id || sectionIndex, rule.id || ruleIndex)}
                              className="text-red-600 hover:text-red-700 p-1"
                              title="Supprimer cette règle"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Version Notes */}
            {strategy && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes de version
                </label>
                <textarea
                  value={formData.version_notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, version_notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Décrivez les changements apportés dans cette version..."
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {isSubmitting ? 'Sauvegarde...' : (strategy ? 'Mettre à jour' : 'Créer')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FlexibleStrategyModal;
