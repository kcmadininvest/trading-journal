import React, { useState, useEffect, useMemo, useRef } from 'react';
import { positionStrategiesService, PositionStrategy, PositionStrategyVersion } from '../services/positionStrategies';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { formatDate } from '../utils/dateFormat';
import { usePreferences } from '../hooks/usePreferences';
import DeleteConfirmModal from '../components/ui/DeleteConfirmModal';
import { Tooltip } from '../components/ui';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Composant pour une section sortable
interface SortableSectionProps {
  id: string;
  section: { title: string; rules: string[] };
  sectionIndex: number;
  formData: any;
  setFormData: any;
  removeSection: (index: number) => void;
  addSection: (insertIndex?: number) => void;
  addRule: (sectionIndex: number, insertIndex?: number) => void;
  removeRule: (sectionIndex: number, ruleIndex: number) => void;
  handleRuleDragEnd: (event: DragEndEvent, sectionIndex: number) => void;
  handleRuleDragStart: (event: DragStartEvent, sectionIndex: number) => void;
  activeRuleIndex: { sectionIndex: number; ruleIndex: number } | null;
  activeId: string | null;
  sensors: any;
  t: any;
}

const SortableSection: React.FC<SortableSectionProps> = ({
  id,
  section,
  sectionIndex,
  formData,
  setFormData,
  removeSection,
  addSection,
  addRule,
  removeRule,
  handleRuleDragEnd,
  handleRuleDragStart,
  activeRuleIndex,
  activeId,
  sensors,
  t,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const ruleIds = section.rules.map((_, i) => `rule-${sectionIndex}-${i}`);

  return (
    <div ref={setNodeRef} style={style} className="mb-3 sm:mb-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="bg-gray-100 dark:bg-gray-700 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-gray-300 dark:border-gray-600">
        <div className="flex items-center gap-2">
          <div
                {...attributes}
                {...listeners}
                className="cursor-move p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title={t('positionStrategies:dragToReorder', { defaultValue: 'Glisser pour réorganiser' })}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path d="M5 8h14M5 12h14M5 16h14" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 8h2M3 12h2M3 16h2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M19 8h2M19 12h2M19 16h2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
          <textarea
            placeholder={t('positionStrategies:sectionTitle', { defaultValue: 'Titre de la section' })}
            value={section.title}
            onChange={(e) => {
              const newSections = [...formData.strategy_content.sections];
              newSections[sectionIndex].title = e.target.value;
              setFormData({ ...formData, strategy_content: { sections: newSections } });
            }}
            rows={1}
            className="flex-1 min-w-0 px-3 py-2 text-sm sm:text-base font-semibold border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-hidden"
            style={{ minHeight: '42px' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = target.scrollHeight + 'px';
            }}
          />
          <button
            type="button"
            onClick={() => addSection(sectionIndex)}
            className="px-2 sm:px-3 py-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded flex-shrink-0"
            title={t('positionStrategies:addSectionBefore', { defaultValue: 'Ajouter une section avant' })}
          >
            + {t('positionStrategies:before', { defaultValue: 'Avant' })}
          </button>
          {formData.strategy_content.sections.length > 1 && (
            <button
              type="button"
              onClick={() => removeSection(sectionIndex)}
              className="px-2 sm:px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded flex-shrink-0"
              title={t('positionStrategies:removeSection', { defaultValue: 'Supprimer la section' })}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="p-3 sm:p-4 space-y-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(event) => handleRuleDragStart(event, sectionIndex)}
          onDragEnd={(event) => handleRuleDragEnd(event, sectionIndex)}
        >
          <SortableContext items={ruleIds} strategy={verticalListSortingStrategy}>
            {section.rules.map((rule, ruleIndex) => {
              const ruleValue = typeof rule === 'string' 
                ? rule 
                : (rule && typeof rule === 'object' 
                  ? ((rule as any)?.text || (rule as any)?.id || JSON.stringify(rule))
                  : String(rule || ''));
              
              return (
                <SortableRule
                  key={`rule-${sectionIndex}-${ruleIndex}`}
                  id={`rule-${sectionIndex}-${ruleIndex}`}
                  ruleValue={ruleValue}
                  sectionIndex={sectionIndex}
                  ruleIndex={ruleIndex}
                  formData={formData}
                  setFormData={setFormData}
                  removeRule={removeRule}
                  addRule={addRule}
                  rulesCount={section.rules.length}
                  t={t}
                />
              );
            })}
          </SortableContext>
          {activeRuleIndex?.sectionIndex === sectionIndex && activeId?.startsWith('rule-') && (
            <DragOverlay>
              <div className="flex gap-2 items-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-2 shadow-lg opacity-95">
                <div className="p-1.5 text-gray-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path d="M5 8h14M5 12h14M5 16h14" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M3 8h2M3 12h2M3 16h2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M19 8h2M19 12h2M19 16h2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <textarea
                  value={section.rules[activeRuleIndex.ruleIndex] || ''}
                  readOnly
                  rows={1}
                  className="flex-1 min-w-0 px-3 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none overflow-hidden"
                  style={{ minHeight: '42px' }}
                />
              </div>
            </DragOverlay>
          )}
        </DndContext>
        <button
          type="button"
          onClick={() => addRule(sectionIndex)}
          className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          + {t('positionStrategies:addRule', { defaultValue: 'Ajouter une règle' })}
        </button>
      </div>
    </div>
  );
};

// Composant pour une règle sortable
interface SortableRuleProps {
  id: string;
  ruleValue: string;
  sectionIndex: number;
  ruleIndex: number;
  formData: any;
  setFormData: any;
  removeRule: (sectionIndex: number, ruleIndex: number) => void;
  addRule: (sectionIndex: number, insertIndex?: number) => void;
  rulesCount: number;
  t: any;
}

const SortableRule: React.FC<SortableRuleProps> = ({
  id,
  ruleValue,
  sectionIndex,
  ruleIndex,
  formData,
  setFormData,
  removeRule,
  addRule,
  rulesCount,
  t,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex gap-2 items-center">
      <div
        {...attributes}
        {...listeners}
        className="cursor-move p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        title={t('positionStrategies:dragToReorder', { defaultValue: 'Glisser pour réorganiser' })}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path d="M5 8h14M5 12h14M5 16h14" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3 8h2M3 12h2M3 16h2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M19 8h2M19 12h2M19 16h2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <textarea
        placeholder={t('positionStrategies:rule', { defaultValue: 'Règle' })}
        value={ruleValue}
        onChange={(e) => {
          const newSections = [...formData.strategy_content.sections];
          newSections[sectionIndex].rules[ruleIndex] = e.target.value;
          setFormData({ ...formData, strategy_content: { sections: newSections } });
        }}
        rows={1}
        className="flex-1 min-w-0 px-3 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-hidden"
        style={{ minHeight: '42px' }}
        onInput={(e) => {
          const target = e.target as HTMLTextAreaElement;
          target.style.height = 'auto';
          target.style.height = target.scrollHeight + 'px';
        }}
      />
      <button
        type="button"
        onClick={() => addRule(sectionIndex, ruleIndex)}
        className="px-2 py-1 text-xs text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded flex-shrink-0"
        title={t('positionStrategies:addRuleBefore', { defaultValue: 'Ajouter une règle avant' })}
      >
        +
      </button>
      {rulesCount > 1 && (
        <button
          type="button"
          onClick={() => removeRule(sectionIndex, ruleIndex)}
          className="px-2 sm:px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded flex-shrink-0"
          title={t('positionStrategies:removeRule', { defaultValue: 'Supprimer la règle' })}
        >
          ✕
        </button>
      )}
    </div>
  );
};

const PositionStrategiesPage: React.FC = () => {
  const { t } = useI18nTranslation();
  const { preferences } = usePreferences();

  const [strategies, setStrategies] = useState<PositionStrategy[]>([]);
  const [allStrategies, setAllStrategies] = useState<PositionStrategy[]>([]); // Toutes les stratégies pour les compteurs
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<PositionStrategy | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showVersionsModal, setShowVersionsModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [versions, setVersions] = useState<PositionStrategyVersion[]>([]);
  const [previousVersion, setPreviousVersion] = useState<PositionStrategy | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'draft' | 'archived'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [strategyToDelete, setStrategyToDelete] = useState<PositionStrategy | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [checkedRules, setCheckedRules] = useState<Record<string, boolean>>({});
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const menuRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeSectionIndex, setActiveSectionIndex] = useState<number | null>(null);
  const [activeRuleIndex, setActiveRuleIndex] = useState<{ sectionIndex: number; ruleIndex: number } | null>(null);
  const [expandedArchivedGroups, setExpandedArchivedGroups] = useState<Set<number>>(new Set());
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number; positionAbove?: boolean } | null>(null);
  const menuButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const menuDropdownRef = useRef<HTMLDivElement | null>(null);

  // Sensors pour le drag & drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Nécessite 8px de mouvement avant d'activer le drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Formulaire
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'draft' as 'active' | 'archived' | 'draft',
    strategy_content: {
      sections: [{ title: '', rules: [''] }] as Array<{ title: string; rules: string[] }>
    },
    version_notes: '',
  });

  // Fermer le menu quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuId !== null) {
        const buttonElement = menuButtonRefs.current[openMenuId];
        const dropdownElement = menuDropdownRef.current;
        const target = event.target as Node;
        
        // Vérifier si le clic est en dehors du menu dropdown et du bouton
        if (buttonElement && !buttonElement.contains(target) &&
            dropdownElement && !dropdownElement.contains(target)) {
          setOpenMenuId(null);
          setMenuPosition(null);
        }
      }
      if (statusDropdownOpen && statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setStatusDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMenuId, statusDropdownOpen]);

  // Recalculer la position du menu lors du scroll
  useEffect(() => {
    if (openMenuId !== null) {
      const handleScroll = () => {
        const buttonElement = menuButtonRefs.current[openMenuId];
        if (buttonElement) {
          const position = calculateMenuPosition(buttonElement);
          setMenuPosition(position);
        }
      };

      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleScroll);
      
      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleScroll);
      };
    }
  }, [openMenuId]);

  // Ajuster automatiquement la hauteur des textareas
  useEffect(() => {
    if (showModal) {
      // Attendre que le DOM soit mis à jour
      setTimeout(() => {
        const textareas = document.querySelectorAll('textarea.resize-none');
        textareas.forEach((textarea) => {
          const element = textarea as HTMLTextAreaElement;
          element.style.height = 'auto';
          element.style.height = element.scrollHeight + 'px';
        });
      }, 0);
    }
  }, [showModal, formData]);

  // Charger toutes les stratégies pour les compteurs (sans filtre de statut)
  const loadAllStrategies = React.useCallback(async () => {
    try {
      const filters: any = {
        include_archived: true, // Inclure toutes les stratégies pour les compteurs
      };
      const data = await positionStrategiesService.list(filters);
      setAllStrategies(data);
    } catch (err: any) {
      console.error('Failed to load all strategies for counts:', err);
      setAllStrategies([]);
    }
  }, []);

  // Charger les stratégies filtrées pour l'affichage
  const loadStrategies = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const filters: any = {};
      if (filterStatus !== 'all') {
        filters.status = filterStatus;
      }
      if (searchQuery) {
        filters.search = searchQuery;
      }
      // Inclure les archivées uniquement si on filtre "all"
      if (filterStatus === 'all') {
        filters.include_archived = true;
      }
      const data = await positionStrategiesService.list(filters);
      setStrategies(data);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des stratégies');
      setStrategies([]); // S'assurer que strategies reste un tableau même en cas d'erreur
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus, searchQuery]);

  useEffect(() => {
    loadAllStrategies();
  }, [loadAllStrategies]);

  useEffect(() => {
    loadStrategies();
  }, [loadStrategies]);

  // Ouvrir le modal de création
  const handleCreate = () => {
    setSelectedStrategy(null);
    setStatusDropdownOpen(false);
    setFormData({
      title: '',
      description: '',
      status: 'draft',
      strategy_content: {
        sections: [{ title: '', rules: [''] }]
      },
      version_notes: '',
    });
    setShowModal(true);
  };


  // Calculer le pourcentage de règles suivies
  const calculatePercentage = (strategy: PositionStrategy, checked: Record<string, boolean>): number => {
    if (!strategy.strategy_content?.sections) return 0;
    
    let totalRules = 0;
    let checkedRules = 0;
    
    strategy.strategy_content.sections.forEach((section, sectionIndex) => {
      if (section.rules && section.rules.length > 0) {
        section.rules.forEach((rule, ruleIndex) => {
          totalRules++;
          const ruleKey = `${sectionIndex}_${ruleIndex}`;
          if (checked[ruleKey]) {
            checkedRules++;
          }
        });
      }
    });
    
    return totalRules > 0 ? Math.round((checkedRules / totalRules) * 100) : 0;
  };

  // Toggle une règle
  const toggleRule = (sectionIndex: number, ruleIndex: number) => {
    if (!selectedStrategy) return;
    
    const ruleKey = `${sectionIndex}_${ruleIndex}`;
    const newChecked = {
      ...checkedRules,
      [ruleKey]: !checkedRules[ruleKey]
    };
    
    setCheckedRules(newChecked);
  };

  // Ouvrir le modal de visualisation
  const handleView = async (strategy: PositionStrategy) => {
    setSelectedStrategy(strategy);
    // Réinitialiser les cases cochées à chaque ouverture
    setCheckedRules({});
    setPreviousVersion(null);
    
    // Charger la version précédente pour comparaison (si ce n'est pas la version 1)
    if (strategy.version > 1) {
      try {
        const versionsData = await positionStrategiesService.getVersions(strategy.id);
        // Trier par version décroissante et trouver la version précédente
        const sortedVersions = [...versionsData].sort((a, b) => b.version - a.version);
        const currentIndex = sortedVersions.findIndex(v => v.id === strategy.id);
        if (currentIndex >= 0 && currentIndex < sortedVersions.length - 1) {
          const prevVersionData = sortedVersions[currentIndex + 1];
          // Récupérer la version complète seulement si elle existe dans les versions disponibles
          // Vérifier d'abord si l'ID existe dans la liste des stratégies accessibles
          try {
            const prevVersion = await positionStrategiesService.get(prevVersionData.id);
            // Vérifier que la version récupérée appartient bien au même utilisateur
            if (prevVersion && prevVersion.user === strategy.user) {
              setPreviousVersion(prevVersion);
            } else {
              setPreviousVersion(null);
            }
          } catch (err: any) {
            // Si la stratégie n'existe pas ou n'est pas accessible (404, 403, etc.), ignorer silencieusement
            console.warn('Previous version not accessible:', prevVersionData.id, err.message || err);
            setPreviousVersion(null);
          }
        } else {
          setPreviousVersion(null);
        }
      } catch (err) {
        // En cas d'erreur lors du chargement des versions, continuer sans comparaison
        console.warn('Error loading versions for comparison:', err);
        setPreviousVersion(null);
      }
    }
    
    setShowViewModal(true);
  };

  // Fermer le modal de visualisation et réinitialiser
  const handleCloseViewModal = () => {
    setShowViewModal(false);
    setSelectedStrategy(null);
    setPreviousVersion(null);
    setCheckedRules({});
  };
  
  // Fonction pour comparer deux versions et identifier les changements
  const getVersionChanges = (current: PositionStrategy, previous: PositionStrategy | null) => {
    if (!previous) return null;
    
    const changes: {
      sectionsAdded: number[];
      sectionsRemoved: number[];
      sectionsModified: number[];
      rulesAdded: Array<{ sectionIndex: number; ruleIndex: number }>;
      rulesRemoved: Array<{ sectionIndex: number; ruleIndex: number }>;
      rulesModified: Array<{ sectionIndex: number; ruleIndex: number }>;
      versionNotesChanged: boolean;
      titleChanged: boolean;
      descriptionChanged: boolean;
    } = {
      sectionsAdded: [],
      sectionsRemoved: [],
      sectionsModified: [],
      rulesAdded: [],
      rulesRemoved: [],
      rulesModified: [],
      versionNotesChanged: false,
      titleChanged: false,
      descriptionChanged: false,
    };
    
    // Comparer les notes de version
    const currentNotes = (current.version_notes || '').trim();
    const previousNotes = (previous.version_notes || '').trim();
    if (currentNotes !== previousNotes) {
      changes.versionNotesChanged = true;
    }
    
    // Comparer le titre
    if (current.title !== previous.title) {
      changes.titleChanged = true;
    }
    
    // Comparer la description
    const currentDesc = (current.description || '').trim();
    const previousDesc = (previous.description || '').trim();
    if (currentDesc !== previousDesc) {
      changes.descriptionChanged = true;
    }
    
    const currentSections = current.strategy_content?.sections || [];
    const previousSections = previous.strategy_content?.sections || [];
    
    // Comparer les sections
    const maxSections = Math.max(currentSections.length, previousSections.length);
    
    for (let i = 0; i < maxSections; i++) {
      const currentSection = currentSections[i];
      const previousSection = previousSections[i];
      
      if (!previousSection && currentSection) {
        // Section ajoutée
        changes.sectionsAdded.push(i);
      } else if (previousSection && !currentSection) {
        // Section supprimée
        changes.sectionsRemoved.push(i);
      } else if (currentSection && previousSection) {
        // Vérifier si le titre a changé
        if (currentSection.title !== previousSection.title) {
          changes.sectionsModified.push(i);
        }
        
        // Comparer les règles de cette section
        const currentRules = currentSection.rules || [];
        const previousRules = previousSection.rules || [];
        const maxRules = Math.max(currentRules.length, previousRules.length);
        
        for (let j = 0; j < maxRules; j++) {
          const currentRule = typeof currentRules[j] === 'string' 
            ? currentRules[j] 
            : (currentRules[j] as any)?.text || (currentRules[j] as any)?.id || JSON.stringify(currentRules[j]);
          const previousRule = typeof previousRules[j] === 'string'
            ? previousRules[j]
            : (previousRules[j] as any)?.text || (previousRules[j] as any)?.id || JSON.stringify(previousRules[j]);
          
          if (!previousRule && currentRule) {
            // Règle ajoutée
            changes.rulesAdded.push({ sectionIndex: i, ruleIndex: j });
          } else if (previousRule && !currentRule) {
            // Règle supprimée
            changes.rulesRemoved.push({ sectionIndex: i, ruleIndex: j });
          } else if (currentRule && previousRule && currentRule !== previousRule) {
            // Règle modifiée
            changes.rulesModified.push({ sectionIndex: i, ruleIndex: j });
          }
        }
      }
    }
    
    return changes;
  };
  
  // Obtenir le type de changement
  const getChangeType = (
    type: 'section' | 'rule',
    sectionIndex: number,
    changes: ReturnType<typeof getVersionChanges>,
    ruleIndex?: number
  ): 'added' | 'removed' | 'modified' | null => {
    if (!changes) return null;
    
    if (type === 'section') {
      if (changes.sectionsAdded.includes(sectionIndex)) return 'added';
      if (changes.sectionsRemoved.includes(sectionIndex)) return 'removed';
      if (changes.sectionsModified.includes(sectionIndex)) return 'modified';
    } else if (type === 'rule' && ruleIndex !== undefined) {
      if (changes.rulesAdded.some(r => r.sectionIndex === sectionIndex && r.ruleIndex === ruleIndex)) return 'added';
      if (changes.rulesRemoved.some(r => r.sectionIndex === sectionIndex && r.ruleIndex === ruleIndex)) return 'removed';
      if (changes.rulesModified.some(r => r.sectionIndex === sectionIndex && r.ruleIndex === ruleIndex)) return 'modified';
    }
    
    return null;
  };

  // Ouvrir le modal d'édition
  const handleEdit = (strategy: PositionStrategy) => {
    setSelectedStrategy(strategy);
    setStatusDropdownOpen(false);
    
    // Convertir les règles en chaînes si elles sont des objets
    const normalizedSections = strategy.strategy_content?.sections?.map(section => ({
      title: section.title || '',
      rules: section.rules?.map(rule => {
        if (typeof rule === 'string') {
          return rule;
        } else if (rule && typeof rule === 'object') {
          return (rule as any)?.text || (rule as any)?.id || JSON.stringify(rule);
        }
        return String(rule || '');
      }) || ['']
    })) || [{ title: '', rules: [''] }];
    
    setFormData({
      title: strategy.title,
      description: strategy.description || '',
      status: strategy.status,
      strategy_content: {
        sections: normalizedSections
      },
      version_notes: '',
    });
    setShowModal(true);
  };

  // Sauvegarder la stratégie
  const handleSave = async () => {
    try {
      setIsLoading(true);
      if (selectedStrategy) {
        // Mise à jour
        await positionStrategiesService.update(selectedStrategy.id, {
          ...formData,
          create_new_version: selectedStrategy.status !== 'draft',
        });
      } else {
        // Création
        await positionStrategiesService.create(formData);
      }
      setShowModal(false);
      setStatusDropdownOpen(false);
      await loadAllStrategies(); // Recharger toutes les stratégies pour les compteurs
      loadStrategies();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setIsLoading(false);
    }
  };

  // Ouvrir la modale de suppression
  const handleDeleteClick = (strategy: PositionStrategy) => {
    setStrategyToDelete(strategy);
  };

  // Supprimer une stratégie
  const handleDelete = async () => {
    if (!strategyToDelete) return;
    
    setIsDeleting(true);
    setError(null);
    try {
      await positionStrategiesService.delete(strategyToDelete.id);
      setStrategyToDelete(null);
      await loadAllStrategies(); // Recharger toutes les stratégies pour les compteurs
      loadStrategies();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  // Activer un brouillon
  const handleActivate = async (strategy: PositionStrategy) => {
    try {
      await positionStrategiesService.update(strategy.id, {
        status: 'active',
        create_new_version: false,
      });
      await loadAllStrategies(); // Recharger toutes les stratégies pour les compteurs
      loadStrategies();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'activation');
    }
  };

  // Archiver/Désarchiver
  const handleToggleArchive = async (strategy: PositionStrategy) => {
    try {
      await positionStrategiesService.update(strategy.id, {
        status: strategy.status === 'archived' ? 'active' : 'archived',
        create_new_version: false,
      });
      await loadAllStrategies(); // Recharger toutes les stratégies pour les compteurs
      loadStrategies();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'archivage');
    }
  };

  // Charger les versions
  const handleViewVersions = async (strategy: PositionStrategy) => {
    try {
      // Utiliser l'ID de la stratégie directement - get_version_history() gère le parent automatiquement
      const versionsData = await positionStrategiesService.getVersions(strategy.id);
      // Trier les versions : version actuelle en premier, puis par numéro de version décroissant
      const sortedVersions = [...versionsData].sort((a, b) => {
        if (a.is_current && !b.is_current) return -1;
        if (!a.is_current && b.is_current) return 1;
        return b.version - a.version;
      });
      setVersions(sortedVersions);
      setSelectedStrategy(strategy);
      setShowVersionsModal(true);
    } catch (err: any) {
      console.error('Error loading versions:', err);
      setError(err.message || 'Erreur lors du chargement des versions');
    }
  };

  // Restaurer une version
  const handleRestoreVersion = async (versionId: number) => {
    if (!selectedStrategy) return;
    try {
      // Utiliser l'ID de la stratégie directement - le backend gère le parent automatiquement
      await positionStrategiesService.restoreVersion(selectedStrategy.id, versionId);
      setShowVersionsModal(false);
      await loadAllStrategies(); // Recharger toutes les stratégies pour les compteurs
      loadStrategies();
    } catch (err: any) {
      console.error('Error restoring version:', err);
      setError(err.message || 'Erreur lors de la restauration');
    }
  };

  // Ajouter une section
  const addSection = (insertIndex?: number) => {
    const newSections = [...formData.strategy_content.sections];
    if (insertIndex !== undefined) {
      newSections.splice(insertIndex, 0, { title: '', rules: [''] });
    } else {
      newSections.push({ title: '', rules: [''] });
    }
    setFormData({
      ...formData,
      strategy_content: {
        sections: newSections
      }
    });
  };

  // Handler pour le début du drag des sections
  const handleSectionDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    const sectionId = String(event.active.id);
    const sectionIndex = parseInt(sectionId.replace('section-', ''), 10);
    setActiveSectionIndex(sectionIndex);
  };

  // Handler pour le drag & drop des sections
  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveSectionIndex(null);
    if (over && active.id !== over.id) {
      const activeId = String(active.id);
      const overId = String(over.id);
      const oldIndex = parseInt(activeId.replace('section-', ''), 10);
      const newIndex = parseInt(overId.replace('section-', ''), 10);
      const newSections = arrayMove(formData.strategy_content.sections, oldIndex, newIndex);
      setFormData({
        ...formData,
        strategy_content: { sections: newSections }
      });
    }
  };

  // Handler pour le début du drag des règles
  const handleRuleDragStart = (event: DragStartEvent, sectionIndex: number) => {
    setActiveId(String(event.active.id));
    const ruleId = String(event.active.id);
    const ruleIndex = parseInt(ruleId.replace(`rule-${sectionIndex}-`, ''), 10);
    setActiveRuleIndex({ sectionIndex, ruleIndex });
  };

  // Handler pour le drag & drop des règles
  const handleRuleDragEnd = (event: DragEndEvent, sectionIndex: number) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveRuleIndex(null);
    if (over && active.id !== over.id) {
      const activeId = String(active.id);
      const overId = String(over.id);
      const oldIndex = parseInt(activeId.replace(`rule-${sectionIndex}-`, ''), 10);
      const newIndex = parseInt(overId.replace(`rule-${sectionIndex}-`, ''), 10);
      const newSections = [...formData.strategy_content.sections];
      newSections[sectionIndex].rules = arrayMove(newSections[sectionIndex].rules, oldIndex, newIndex);
      setFormData({
        ...formData,
        strategy_content: { sections: newSections }
      });
    }
  };

  // Supprimer une section
  const removeSection = (index: number) => {
    const newSections = formData.strategy_content.sections.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      strategy_content: {
        sections: newSections.length > 0 ? newSections : [{ title: '', rules: [''] }]
      }
    });
  };

  // Ajouter une règle
  const addRule = (sectionIndex: number, insertIndex?: number) => {
    const newSections = [...formData.strategy_content.sections];
    if (insertIndex !== undefined) {
      newSections[sectionIndex].rules.splice(insertIndex, 0, '');
    } else {
      newSections[sectionIndex].rules.push('');
    }
    setFormData({
      ...formData,
      strategy_content: { sections: newSections }
    });
  };


  // Supprimer une règle
  const removeRule = (sectionIndex: number, ruleIndex: number) => {
    const newSections = [...formData.strategy_content.sections];
    newSections[sectionIndex].rules = newSections[sectionIndex].rules.filter((_, i) => i !== ruleIndex);
    setFormData({
      ...formData,
      strategy_content: { sections: newSections }
    });
  };

  // Calculer les compteurs pour chaque statut depuis toutes les stratégies (comme GoalsPage)
  const activeStrategies = useMemo(() => allStrategies.filter(s => s.status === 'active'), [allStrategies]);
  const draftStrategies = useMemo(() => allStrategies.filter(s => s.status === 'draft'), [allStrategies]);
  const archivedStrategies = useMemo(() => allStrategies.filter(s => s.status === 'archived'), [allStrategies]);
  
  // Utiliser les compteurs depuis toutes les stratégies (pas seulement celles filtrées)
  const activeCount = activeStrategies.length;
  const draftCount = draftStrategies.length;
  const archivedCount = archivedStrategies.length;
  const totalCount = allStrategies.length;

  // Filtrer les stratégies
  const filteredStrategies = useMemo(() => {
    if (!Array.isArray(strategies)) {
      return [];
    }
    return strategies.filter(strategy => {
      if (filterStatus !== 'all' && strategy.status !== filterStatus) return false;
      if (searchQuery && !strategy.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !strategy.description.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [strategies, filterStatus, searchQuery]);

  // Grouper les stratégies archivées par stratégie parente
  const groupedArchivedStrategies = useMemo(() => {
    if (filterStatus !== 'archived') {
      return null;
    }

    const groups = new Map<number, {
      groupId: number;
      title: string;
      strategies: PositionStrategy[];
    }>();

    // D'abord, identifier tous les IDs de groupes possibles
    // (stratégies qui sont des parents ou qui ont un parent)
    const groupIds = new Set<number>();
    filteredStrategies.forEach(strategy => {
      if (strategy.parent_strategy) {
        groupIds.add(strategy.parent_strategy);
      } else {
        groupIds.add(strategy.id);
      }
    });

    // Ensuite, regrouper les stratégies
    filteredStrategies.forEach(strategy => {
      // Identifier le groupe : utiliser parent_strategy si existe, sinon l'ID de la stratégie elle-même
      const groupId = strategy.parent_strategy || strategy.id;
      
      if (!groups.has(groupId)) {
        // Utiliser le titre de la première stratégie du groupe
        groups.set(groupId, {
          groupId,
          title: strategy.title,
          strategies: []
        });
      }
      
      groups.get(groupId)!.strategies.push(strategy);
    });

    // Trier les stratégies dans chaque groupe par version (décroissant)
    // et mettre à jour le titre avec celui de la version la plus récente
    groups.forEach(group => {
      group.strategies.sort((a, b) => b.version - a.version);
      // Utiliser le titre de la version la plus récente
      if (group.strategies.length > 0) {
        group.title = group.strategies[0].title;
      }
    });

    return Array.from(groups.values());
  }, [filteredStrategies, filterStatus]);

  // Toggle l'expansion d'un groupe d'archives
  const toggleArchivedGroup = (groupId: number) => {
    setExpandedArchivedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  // Calculer la position du menu dropdown avec ajustement automatique
  const calculateMenuPosition = (buttonElement: HTMLButtonElement | null) => {
    if (!buttonElement) return null;
    const rect = buttonElement.getBoundingClientRect();
    const menuHeight = 250; // Hauteur approximative du menu (peut contenir 3-4 items)
    const spacing = 8; // Espacement entre le bouton et le menu
    const minSpace = 10; // Espace minimum requis
    
    // Vérifier s'il y a assez de place en bas
    const spaceBelow = window.innerHeight - rect.bottom - spacing;
    const spaceAbove = rect.top - spacing;
    
    // Déterminer la meilleure position
    // Positionner au-dessus si :
    // 1. Pas assez de place en bas ET assez de place en haut
    // 2. Ou si on est proche du bas de l'écran (moins de 100px)
    const nearBottom = spaceBelow < 100;
    const shouldPositionAbove = (spaceBelow < menuHeight && spaceAbove > menuHeight) || 
                                 (nearBottom && spaceAbove > spaceBelow);
    
    let top: number;
    if (shouldPositionAbove) {
      // Positionner au-dessus, mais s'assurer qu'on ne dépasse pas le haut
      top = Math.max(minSpace, rect.top + window.scrollY - menuHeight - spacing);
    } else {
      // Positionner en dessous, mais s'assurer qu'on ne dépasse pas le bas
      const bottomPosition = rect.bottom + window.scrollY + spacing;
      const maxTop = window.innerHeight + window.scrollY - menuHeight - minSpace;
      top = Math.min(bottomPosition, maxTop);
    }
    
    return {
      top,
      right: window.innerWidth - rect.right + window.scrollX,
      positionAbove: shouldPositionAbove,
    };
  };

  // Ouvrir le menu avec calcul de position
  const handleOpenMenu = (strategyId: number) => {
    const buttonElement = menuButtonRefs.current[strategyId];
    if (openMenuId === strategyId) {
      setOpenMenuId(null);
      setMenuPosition(null);
    } else {
      const position = calculateMenuPosition(buttonElement);
      setMenuPosition(position);
      setOpenMenuId(strategyId);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'archived':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="px-3 sm:px-4 md:px-6 py-4 sm:py-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="w-full">
        {/* Filtres et recherche */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex-1 w-full">
              <input
                type="text"
                placeholder={t('positionStrategies:searchPlaceholder', { defaultValue: 'Rechercher une stratégie...' })}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <div className="flex flex-wrap gap-2 flex-1 min-w-0">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`flex-1 min-w-[calc(50%-0.25rem)] sm:min-w-0 px-2 sm:px-3 md:px-4 py-2 text-xs sm:text-sm md:text-base rounded-lg font-medium transition-colors flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap ${
                    filterStatus === 'all'
                      ? 'bg-gray-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {t('positionStrategies:all', { defaultValue: 'Toutes' })}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    filterStatus === 'all'
                      ? 'bg-gray-500 text-white'
                      : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                  }`}>
                    {totalCount}
                  </span>
                </button>
                <button
                  onClick={() => setFilterStatus('active')}
                  className={`flex-1 min-w-[calc(50%-0.25rem)] sm:min-w-0 px-2 sm:px-3 md:px-4 py-2 text-xs sm:text-sm md:text-base rounded-lg font-medium transition-colors flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap ${
                    filterStatus === 'active'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {t('positionStrategies:active', { defaultValue: 'Actives' })}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    filterStatus === 'active'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                  }`}>
                    {activeCount}
                  </span>
                </button>
                <button
                  onClick={() => setFilterStatus('draft')}
                  className={`flex-1 min-w-[calc(50%-0.25rem)] sm:min-w-0 px-2 sm:px-3 md:px-4 py-2 text-xs sm:text-sm md:text-base rounded-lg font-medium transition-colors flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap ${
                    filterStatus === 'draft'
                      ? 'bg-yellow-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {t('positionStrategies:draft', { defaultValue: 'Brouillons' })}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    filterStatus === 'draft'
                      ? 'bg-yellow-500 text-white'
                      : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                  }`}>
                    {draftCount}
                  </span>
                </button>
                <button
                  onClick={() => setFilterStatus('archived')}
                  className={`flex-1 min-w-[calc(50%-0.25rem)] sm:min-w-0 px-2 sm:px-3 md:px-4 py-2 text-xs sm:text-sm md:text-base rounded-lg font-medium transition-colors flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap ${
                    filterStatus === 'archived'
                      ? 'bg-gray-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {t('positionStrategies:archived', { defaultValue: 'Archivées' })}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    filterStatus === 'archived'
                      ? 'bg-gray-500 text-white'
                      : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                  }`}>
                    {archivedCount}
                  </span>
                </button>
              </div>
              <button
                onClick={handleCreate}
                className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors whitespace-nowrap w-full sm:w-auto flex items-center justify-center gap-1 sm:gap-2"
              >
                <span>+</span>
                <span>{t('positionStrategies:create', { defaultValue: 'Nouvelle stratégie' })}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Message d'erreur */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
            <p className="text-sm sm:text-base text-red-800 dark:text-red-300 break-words">{error}</p>
          </div>
        )}

        {/* Liste des stratégies */}
        {isLoading && strategies.length === 0 ? (
          <div className="flex items-center justify-center h-48 sm:h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-blue-600 dark:border-blue-500 mx-auto mb-3 sm:mb-4"></div>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">{t('positionStrategies:loading', { defaultValue: 'Chargement...' })}</p>
            </div>
          </div>
        ) : filteredStrategies.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 sm:p-12 text-center">
            <p className="text-sm sm:text-base lg:text-lg text-gray-600 dark:text-gray-400">
              {t('positionStrategies:noStrategies', { defaultValue: 'Aucune stratégie trouvée' })}
            </p>
          </div>
        ) : filterStatus === 'archived' && groupedArchivedStrategies ? (
          // Affichage groupé pour les archives
          <div className="space-y-3 sm:space-y-4">
            {groupedArchivedStrategies.map((group) => {
              const isExpanded = expandedArchivedGroups.has(group.groupId);
              return (
                <div
                  key={group.groupId}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  {/* En-tête du groupe */}
                  <button
                    onClick={() => toggleArchivedGroup(group.groupId)}
                    className="w-full px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <svg
                        className={`w-5 h-5 text-gray-400 dark:text-gray-500 transition-transform flex-shrink-0 ${
                          isExpanded ? 'rotate-90' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {group.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                          {group.strategies.length} {group.strategies.length > 1 ? 'versions archivées' : 'version archivée'}
                        </p>
                      </div>
                    </div>
                  </button>
                  
                  {/* Contenu du groupe (versions) */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 dark:border-gray-700 p-4 sm:p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                        {group.strategies.map((strategy) => (
                          <div
                            key={strategy.id}
                            className="bg-gray-50 dark:bg-gray-700/50 rounded-lg shadow-sm p-4 sm:p-6 hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-600"
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex-1">
                                <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                  {strategy.title}
                                </h4>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(strategy.status)}`}>
                                    {t('positionStrategies:archived', { defaultValue: 'Archivée' })}
                                  </span>
                                  <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                                    v{strategy.version}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {strategy.description && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                                {strategy.description}
                              </p>
                            )}

                            <div className="text-xs text-gray-500 dark:text-gray-500 mb-4">
                              {t('positionStrategies:createdAt', { defaultValue: 'Créé le' })} {formatDate(strategy.created_at, preferences.date_format, false, preferences.timezone)}
                            </div>

                            {/* Menu d'actions */}
                            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-600">
                              <div className="flex items-center gap-2">
                                <Tooltip content={t('positionStrategies:view', { defaultValue: 'Voir' })} position="top">
                                  <button
                                    onClick={() => handleView(strategy)}
                                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-all duration-200"
                                  >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                  </button>
                                </Tooltip>
                                <Tooltip content={t('positionStrategies:versions', { defaultValue: 'Versions' })} position="top">
                                  <button
                                    onClick={() => handleViewVersions(strategy)}
                                    className="flex items-center gap-1.5 p-2 text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-all duration-200"
                                  >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="text-xs font-medium">{strategy.version_count}</span>
                                  </button>
                                </Tooltip>
                              </div>
                              
                              {/* Menu dropdown pour actions supplémentaires */}
                              <div className="relative" ref={(el) => { menuRefs.current[strategy.id] = el; }}>
                                <Tooltip content={t('positionStrategies:moreActions', { defaultValue: 'Plus d\'actions' })} position="top">
                                  <button
                                    ref={(el) => { menuButtonRefs.current[strategy.id] = el; }}
                                    onClick={() => handleOpenMenu(strategy.id)}
                                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-all duration-200"
                                  >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                    </svg>
                                  </button>
                                </Tooltip>
                                
                                {openMenuId === strategy.id && menuPosition && (
                                  <div 
                                    ref={menuDropdownRef}
                                    className="fixed w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-[9999]"
                                    style={{ top: `${menuPosition.top}px`, right: `${menuPosition.right}px` }}
                                  >
                                    <button
                                      onClick={() => {
                                        handleToggleArchive(strategy);
                                        setOpenMenuId(null);
                                        setMenuPosition(null);
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 flex items-center gap-2 transition-colors"
                                    >
                                      <svg className="w-4 h-4 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                      </svg>
                                      {t('positionStrategies:unarchive', { defaultValue: 'Désarchiver' })}
                                    </button>
                                    <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                                    <button
                                      onClick={() => {
                                        handleDeleteClick(strategy);
                                        setOpenMenuId(null);
                                        setMenuPosition(null);
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                      {t('positionStrategies:delete', { defaultValue: 'Supprimer' })}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          // Affichage normal pour les autres statuts
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredStrategies.map((strategy) => (
              <div
                key={strategy.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      {strategy.title}
                    </h3>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(strategy.status)}`}>
                        {strategy.status === 'active' ? t('positionStrategies:active', { defaultValue: 'Active' }) :
                         strategy.status === 'draft' ? t('positionStrategies:draft', { defaultValue: 'Brouillon' }) :
                         t('positionStrategies:archived', { defaultValue: 'Archivée' })}
                      </span>
                      {strategy.is_current && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                          v{strategy.version}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {strategy.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                    {strategy.description}
                  </p>
                )}

                <div className="text-xs text-gray-500 dark:text-gray-500 mb-4">
                  {t('positionStrategies:createdAt', { defaultValue: 'Créé le' })} {formatDate(strategy.created_at, preferences.date_format, false, preferences.timezone)}
                </div>

                {/* Menu d'actions moderne */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <Tooltip content={t('positionStrategies:view', { defaultValue: 'Voir' })} position="top">
                      <button
                        onClick={() => handleView(strategy)}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-all duration-200"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </Tooltip>
                    {strategy.is_current && (
                      <Tooltip content={t('positionStrategies:edit', { defaultValue: 'Modifier' })} position="top">
                        <button
                          onClick={() => handleEdit(strategy)}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </Tooltip>
                    )}
                    <Tooltip content={t('positionStrategies:versions', { defaultValue: 'Versions' })} position="top">
                      <button
                        onClick={() => handleViewVersions(strategy)}
                        className="flex items-center gap-1.5 p-2 text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs font-medium">{strategy.version_count}</span>
                      </button>
                    </Tooltip>
                  </div>
                  
                  {/* Menu dropdown pour actions supplémentaires */}
                  <div className="relative" ref={(el) => { menuRefs.current[strategy.id] = el; }}>
                    <Tooltip content={t('positionStrategies:moreActions', { defaultValue: 'Plus d\'actions' })} position="top">
                      <button
                        ref={(el) => { menuButtonRefs.current[strategy.id] = el; }}
                        onClick={() => handleOpenMenu(strategy.id)}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </button>
                    </Tooltip>
                    
                    {openMenuId === strategy.id && menuPosition && (
                      <div 
                        ref={menuDropdownRef}
                        className="fixed w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-[9999]"
                        style={{ top: `${menuPosition.top}px`, right: `${menuPosition.right}px` }}
                      >
                        {strategy.status === 'draft' && (
                          <button
                            onClick={() => {
                              handleActivate(strategy);
                              setOpenMenuId(null);
                              setMenuPosition(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 flex items-center gap-2 transition-colors"
                          >
                            <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {t('positionStrategies:activate', { defaultValue: 'Activer' })}
                          </button>
                        )}
                        {strategy.status !== 'draft' && (
                          <button
                            onClick={() => {
                              handleToggleArchive(strategy);
                              setOpenMenuId(null);
                              setMenuPosition(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 flex items-center gap-2 transition-colors"
                          >
                            <svg className="w-4 h-4 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              {strategy.status === 'archived' ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                              ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" />
                              )}
                            </svg>
                            {strategy.status === 'archived' 
                              ? t('positionStrategies:unarchive', { defaultValue: 'Désarchiver' })
                              : t('positionStrategies:archive', { defaultValue: 'Archiver' })}
                          </button>
                        )}
                        <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                        <button
                          onClick={() => {
                            handleDeleteClick(strategy);
                            setOpenMenuId(null);
                            setMenuPosition(null);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          {t('positionStrategies:delete', { defaultValue: 'Supprimer' })}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal de création/édition */}
        {showModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowModal(false);
                setStatusDropdownOpen(false);
              }
            }}
          >
            <div
              className="bg-white dark:bg-gray-800 w-full max-w-6xl rounded-xl shadow-2xl max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-3 sm:px-6 py-3 sm:py-5 border-b border-gray-200 dark:border-gray-700 flex items-start sm:items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-t-xl flex-shrink-0 gap-3">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-600 dark:bg-blue-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
                      {selectedStrategy 
                        ? t('positionStrategies:editStrategy', { defaultValue: 'Modifier la stratégie' })
                        : t('positionStrategies:createStrategy', { defaultValue: 'Nouvelle stratégie' })}
                    </h2>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setStatusDropdownOpen(false);
                  }}
                  className="w-8 h-8 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center transition-colors flex-shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('positionStrategies:title', { defaultValue: 'Titre' })} *
                  </label>
                  <textarea
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    rows={1}
                    className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-hidden"
                    style={{ minHeight: '42px' }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = target.scrollHeight + 'px';
                    }}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('positionStrategies:description', { defaultValue: 'Description' })}
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('positionStrategies:status', { defaultValue: 'Statut' })}
                  </label>
                  <div ref={statusDropdownRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setStatusDropdownOpen(v => !v)}
                      className="w-full inline-flex items-center justify-between rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    >
                      <span className="text-gray-900 dark:text-gray-100">
                        {formData.status === 'draft' ? t('positionStrategies:draft', { defaultValue: 'Brouillon' }) :
                         formData.status === 'active' ? t('positionStrategies:active', { defaultValue: 'Active' }) :
                         t('positionStrategies:archived', { defaultValue: 'Archivée' })}
                      </span>
                      <svg className={`h-4 w-4 text-gray-400 dark:text-gray-500 transition-transform ${statusDropdownOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {statusDropdownOpen && (
                      <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg max-h-72 overflow-auto">
                        <ul className="py-1 text-sm text-gray-700 dark:text-gray-300">
                          <li>
                            <button
                              type="button"
                              onClick={() => {
                                setFormData({ ...formData, status: 'draft' });
                                setStatusDropdownOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${formData.status === 'draft' ? 'bg-gray-50 dark:bg-gray-700' : ''}`}
                            >
                              <span className="text-gray-900 dark:text-gray-100">{t('positionStrategies:draft', { defaultValue: 'Brouillon' })}</span>
                            </button>
                          </li>
                          <li>
                            <button
                              type="button"
                              onClick={() => {
                                setFormData({ ...formData, status: 'active' });
                                setStatusDropdownOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${formData.status === 'active' ? 'bg-gray-50 dark:bg-gray-700' : ''}`}
                            >
                              <span className="text-gray-900 dark:text-gray-100">{t('positionStrategies:active', { defaultValue: 'Active' })}</span>
                            </button>
                          </li>
                          <li>
                            <button
                              type="button"
                              onClick={() => {
                                setFormData({ ...formData, status: 'archived' });
                                setStatusDropdownOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${formData.status === 'archived' ? 'bg-gray-50 dark:bg-gray-700' : ''}`}
                            >
                              <span className="text-gray-900 dark:text-gray-100">{t('positionStrategies:archived', { defaultValue: 'Archivée' })}</span>
                            </button>
                          </li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t('positionStrategies:sections', { defaultValue: 'Sections de la stratégie' })} *
                    </label>
                    <button
                      type="button"
                      onClick={() => addSection()}
                      className="px-3 py-1.5 text-sm sm:text-base bg-green-600 text-white rounded hover:bg-green-700 transition-colors whitespace-nowrap"
                    >
                      + {t('positionStrategies:addSection', { defaultValue: 'Ajouter une section' })}
                    </button>
                  </div>

                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleSectionDragStart}
                    onDragEnd={handleSectionDragEnd}
                  >
                    <SortableContext
                      items={formData.strategy_content.sections.map((_, i) => `section-${i}`)}
                      strategy={verticalListSortingStrategy}
                    >
                      {formData.strategy_content.sections.map((section, sectionIndex) => (
                        <SortableSection
                          key={`section-${sectionIndex}`}
                          id={`section-${sectionIndex}`}
                          section={section}
                          sectionIndex={sectionIndex}
                          formData={formData}
                          setFormData={setFormData}
                          removeSection={removeSection}
                          addSection={addSection}
                          addRule={addRule}
                          removeRule={removeRule}
                          handleRuleDragEnd={handleRuleDragEnd}
                          handleRuleDragStart={handleRuleDragStart}
                          activeRuleIndex={activeRuleIndex}
                          activeId={activeId}
                          sensors={sensors}
                          t={t}
                        />
                      ))}
                    </SortableContext>
                    {activeSectionIndex !== null && activeId?.startsWith('section-') && (
                      <DragOverlay>
                        <div className="mb-3 sm:mb-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800 shadow-xl opacity-95">
                          <div className="bg-gray-100 dark:bg-gray-700 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-gray-300 dark:border-gray-600">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 text-gray-400">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path d="M5 8h14M5 12h14M5 16h14" strokeLinecap="round" strokeLinejoin="round" />
                                  <path d="M3 8h2M3 12h2M3 16h2" strokeLinecap="round" strokeLinejoin="round" />
                                  <path d="M19 8h2M19 12h2M19 16h2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </div>
                              <textarea
                                value={formData.strategy_content.sections[activeSectionIndex]?.title || ''}
                                readOnly
                                rows={1}
                                className="flex-1 min-w-0 px-3 py-2 text-sm sm:text-base font-semibold border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none overflow-hidden"
                                style={{ minHeight: '42px' }}
                              />
                            </div>
                          </div>
                        </div>
                      </DragOverlay>
                    )}
                  </DndContext>
                </div>

                {selectedStrategy && selectedStrategy.status !== 'draft' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('positionStrategies:versionNotes', { defaultValue: 'Notes de version' })}
                    </label>
                    <textarea
                      value={formData.version_notes}
                      onChange={(e) => setFormData({ ...formData, version_notes: e.target.value })}
                      rows={3}
                      placeholder={t('positionStrategies:versionNotesPlaceholder', { defaultValue: 'Décrivez les changements de cette version...' })}
                      className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                    />
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-3 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 rounded-b-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 flex-shrink-0">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setStatusDropdownOpen(false);
                  }}
                  className="px-3 sm:px-4 py-2 text-sm sm:text-base text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  {t('positionStrategies:cancel', { defaultValue: 'Annuler' })}
                </button>
                <button
                  onClick={handleSave}
                  disabled={!formData.title || formData.strategy_content.sections.length === 0 || isLoading}
                  className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading 
                    ? t('positionStrategies:saving', { defaultValue: 'Enregistrement...' })
                    : t('positionStrategies:save', { defaultValue: 'Enregistrer' })}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal des versions */}
        {showVersionsModal && selectedStrategy && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowVersionsModal(false);
              }
            }}
          >
            <div
              className="bg-white dark:bg-gray-800 w-full max-w-3xl rounded-xl shadow-2xl max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-3 sm:px-6 py-3 sm:py-5 border-b border-gray-200 dark:border-gray-700 flex items-start sm:items-center justify-between bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-t-xl flex-shrink-0 gap-3">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-purple-600 dark:bg-purple-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
                      {t('positionStrategies:versionHistory', { defaultValue: 'Historique des versions' })}
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate mt-1">
                      {selectedStrategy.title}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowVersionsModal(false)}
                  className="w-8 h-8 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center transition-colors flex-shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
                {versions.length === 0 ? (
                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 text-center py-6 sm:py-8">
                    {t('positionStrategies:noVersions', { defaultValue: 'Aucune version disponible' })}
                  </p>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {versions.map((version) => (
                      <div
                        key={version.id}
                        className={`p-3 sm:p-4 border rounded-lg ${
                          version.is_current
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-100">
                                {t('positionStrategies:version', { defaultValue: 'Version' })} {version.version}
                              </span>
                              {version.is_current && (
                                <span className="px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded">
                                  {t('positionStrategies:current', { defaultValue: 'Actuelle' })}
                                </span>
                              )}
                              <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(version.status)}`}>
                                {version.status === 'active' ? t('positionStrategies:active', { defaultValue: 'Active' }) :
                                 version.status === 'draft' ? t('positionStrategies:draft', { defaultValue: 'Brouillon' }) :
                                 t('positionStrategies:archived', { defaultValue: 'Archivée' })}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                              {formatDate(version.created_at, preferences.date_format, false, preferences.timezone)}
                            </p>
                          </div>
                          {!version.is_current && (
                            <button
                              onClick={() => handleRestoreVersion(version.id)}
                              className="px-3 py-1.5 text-xs sm:text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors whitespace-nowrap flex-shrink-0"
                            >
                              {t('positionStrategies:restore', { defaultValue: 'Restaurer' })}
                            </button>
                          )}
                        </div>
                        {version.version_notes && (
                          <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 mt-2 break-words">
                            {version.version_notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal de visualisation */}
        {showViewModal && selectedStrategy && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleCloseViewModal();
              }
            }}
          >
            <div
              className="bg-white dark:bg-gray-800 w-full max-w-6xl rounded-xl shadow-2xl max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-3 sm:px-6 py-3 sm:py-5 border-b border-gray-200 dark:border-gray-700 flex items-start sm:items-center justify-between bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-t-xl flex-shrink-0 gap-3">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-purple-600 dark:bg-purple-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    {(() => {
                      // Ne pas afficher les changements si la version est active
                      const showChanges = selectedStrategy.status !== 'active';
                      const changes = showChanges ? getVersionChanges(selectedStrategy, previousVersion) : null;
                      const titleChanged = changes?.titleChanged;
                      const descriptionChanged = changes?.descriptionChanged;
                      
                      return (
                        <>
                          <div className="flex items-center gap-2">
                            <h2 className={`text-lg sm:text-xl font-bold truncate ${titleChanged ? 'text-purple-900 dark:text-purple-100' : 'text-gray-900 dark:text-gray-100'}`}>
                              {selectedStrategy.title}
                            </h2>
                            {titleChanged && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200 rounded flex-shrink-0">
                                {t('positionStrategies:modified', { defaultValue: 'Modifié' })}
                              </span>
                            )}
                          </div>
                          {selectedStrategy.description && (
                            <div className="flex items-start gap-2 mt-1">
                              <p className={`text-xs sm:text-sm truncate flex-1 ${descriptionChanged ? 'text-indigo-900 dark:text-indigo-100' : 'text-gray-600 dark:text-gray-400'}`}>
                                {selectedStrategy.description}
                              </p>
                              {descriptionChanged && (
                                <span className="px-2 py-0.5 text-xs font-medium bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200 rounded flex-shrink-0">
                                  {t('positionStrategies:modified', { defaultValue: 'Modifié' })}
                                </span>
                              )}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
                <button
                  onClick={handleCloseViewModal}
                  className="w-8 h-8 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center transition-colors flex-shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Contenu scrollable */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
                {/* Bandeau de comparaison avec version précédente (uniquement pour les versions archivées) */}
                {previousVersion && selectedStrategy.status !== 'active' && (() => {
                  const changes = getVersionChanges(selectedStrategy, previousVersion);
                  const hasChanges = changes && (
                    changes.sectionsAdded.length > 0 ||
                    changes.sectionsRemoved.length > 0 ||
                    changes.sectionsModified.length > 0 ||
                    changes.rulesAdded.length > 0 ||
                    changes.rulesRemoved.length > 0 ||
                    changes.rulesModified.length > 0 ||
                    changes.versionNotesChanged ||
                    changes.titleChanged ||
                    changes.descriptionChanged
                  );
                  
                  if (hasChanges) {
                    return (
                      <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="flex items-start gap-2 sm:gap-3">
                          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="flex-1">
                            <h4 className="text-sm sm:text-base font-semibold text-blue-900 dark:text-blue-100 mb-2">
                              {t('positionStrategies:changesFromPrevious', { defaultValue: 'Changements par rapport à la version précédente (v' + previousVersion.version + ')' })}
                            </h4>
                            <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
                              {changes!.sectionsAdded.length > 0 && (
                                <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
                                  {changes!.sectionsAdded.length} {t('positionStrategies:sectionsAdded', { defaultValue: 'section(s) ajoutée(s)' })}
                                </span>
                              )}
                              {changes!.sectionsRemoved.length > 0 && (
                                <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded">
                                  {changes!.sectionsRemoved.length} {t('positionStrategies:sectionsRemoved', { defaultValue: 'section(s) supprimée(s)' })}
                                </span>
                              )}
                              {changes!.sectionsModified.length > 0 && (
                                <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded">
                                  {changes!.sectionsModified.length} {t('positionStrategies:sectionsModified', { defaultValue: 'section(s) modifiée(s)' })}
                                </span>
                              )}
                              {changes!.rulesAdded.length > 0 && (
                                <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
                                  {changes!.rulesAdded.length} {t('positionStrategies:rulesAdded', { defaultValue: 'règle(s) ajoutée(s)' })}
                                </span>
                              )}
                              {changes!.rulesRemoved.length > 0 && (
                                <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded">
                                  {changes!.rulesRemoved.length} {t('positionStrategies:rulesRemoved', { defaultValue: 'règle(s) supprimée(s)' })}
                                </span>
                              )}
                              {changes!.rulesModified.length > 0 && (
                                <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded">
                                  {changes!.rulesModified.length} {t('positionStrategies:rulesModified', { defaultValue: 'règle(s) modifiée(s)' })}
                                </span>
                              )}
                              {changes!.versionNotesChanged && (
                                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">
                                  {t('positionStrategies:versionNotesChanged', { defaultValue: 'Notes de version modifiées' })}
                                </span>
                              )}
                              {changes!.titleChanged && (
                                <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded">
                                  {t('positionStrategies:titleChanged', { defaultValue: 'Titre modifié' })}
                                </span>
                              )}
                              {changes!.descriptionChanged && (
                                <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 rounded">
                                  {t('positionStrategies:descriptionChanged', { defaultValue: 'Description modifiée' })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
                
                {/* Informations générales */}
                <div className="mb-4 sm:mb-6 pb-4 sm:pb-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm">
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {t('positionStrategies:status', { defaultValue: 'Statut' })}:
                      </span>
                      <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${getStatusColor(selectedStrategy.status)}`}>
                        {selectedStrategy.status === 'active' ? t('positionStrategies:active', { defaultValue: 'Active' }) :
                         selectedStrategy.status === 'draft' ? t('positionStrategies:draft', { defaultValue: 'Brouillon' }) :
                         t('positionStrategies:archived', { defaultValue: 'Archivée' })}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {t('positionStrategies:version', { defaultValue: 'Version' })}:
                      </span>
                      <span className="ml-2 text-gray-600 dark:text-gray-400">v{selectedStrategy.version}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {t('positionStrategies:createdAt', { defaultValue: 'Créé le' })}:
                      </span>
                      <span className="ml-2 text-gray-600 dark:text-gray-400 break-words">
                        {formatDate(selectedStrategy.created_at, preferences.date_format, false, preferences.timezone)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Statistiques de suivi */}
                {(() => {
                  const percentage = calculatePercentage(selectedStrategy, checkedRules);
                  return (
                    <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {t('positionStrategies:compliance', { defaultValue: 'Respect de la stratégie' })}
                        </h3>
                        <span className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {percentage}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 sm:h-3">
                        <div
                          className={`h-2 sm:h-3 rounded-full transition-all duration-300 ${
                            percentage >= 80 ? 'bg-green-500' :
                            percentage >= 50 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* Sections et règles */}
                <div className="space-y-4 sm:space-y-6">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {t('positionStrategies:sections', { defaultValue: 'Sections de la stratégie' })}
                  </h3>
                  
                  {selectedStrategy.strategy_content?.sections && selectedStrategy.strategy_content.sections.length > 0 ? (
                    selectedStrategy.strategy_content.sections.map((section, sectionIndex) => {
                      const sectionRules = section.rules || [];
                      const sectionChecked = sectionRules.reduce((acc, _, ruleIndex) => {
                        const ruleKey = `${sectionIndex}_${ruleIndex}`;
                        if (checkedRules[ruleKey]) acc++;
                        return acc;
                      }, 0);
                      const sectionPercentage = sectionRules.length > 0 
                        ? Math.round((sectionChecked / sectionRules.length) * 100) 
                        : 0;
                      
                      // Vérifier les changements pour cette section (uniquement si la version n'est pas active)
                      const showChanges = selectedStrategy.status !== 'active';
                      const changes = showChanges ? getVersionChanges(selectedStrategy, previousVersion) : null;
                      const sectionChangeType = getChangeType('section', sectionIndex, changes);
                      const sectionBgColor = sectionChangeType === 'added' 
                        ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                        : sectionChangeType === 'removed'
                        ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                        : sectionChangeType === 'modified'
                        ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800'
                        : 'border-gray-200 dark:border-gray-700';
                      
                      return (
                        <div key={sectionIndex} className={`border-2 rounded-lg overflow-hidden ${sectionBgColor} ${sectionChangeType === 'removed' ? 'opacity-60' : ''} shadow-sm`}>
                          {/* En-tête de section */}
                          <div className={`px-4 py-3 sm:px-5 sm:py-4 bg-gradient-to-r ${
                            sectionChangeType === 'added' 
                              ? 'from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-900/10 border-b-2 border-green-200 dark:border-green-800'
                              : sectionChangeType === 'removed'
                              ? 'from-red-100 to-red-50 dark:from-red-900/30 dark:to-red-900/10 border-b-2 border-red-200 dark:border-red-800'
                              : sectionChangeType === 'modified'
                              ? 'from-yellow-100 to-yellow-50 dark:from-yellow-900/30 dark:to-yellow-900/10 border-b-2 border-yellow-200 dark:border-yellow-800'
                              : 'from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-800 border-b-2 border-gray-200 dark:border-gray-600'
                          }`}>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {sectionChangeType && (
                                  <span className={`px-2 py-0.5 text-xs font-medium rounded flex-shrink-0 ${
                                    sectionChangeType === 'added' 
                                      ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
                                      : sectionChangeType === 'removed'
                                      ? 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200'
                                      : 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200'
                                  }`}>
                                    {sectionChangeType === 'added' 
                                      ? t('positionStrategies:added', { defaultValue: 'Ajouté' })
                                      : sectionChangeType === 'removed'
                                      ? t('positionStrategies:removed', { defaultValue: 'Supprimé' })
                                      : t('positionStrategies:modified', { defaultValue: 'Modifié' })}
                                  </span>
                                )}
                                <h4 className={`font-semibold text-base sm:text-lg break-words ${sectionChangeType === 'removed' ? 'line-through' : ''} ${
                                  sectionChangeType === 'added' 
                                    ? 'text-green-900 dark:text-green-100'
                                    : sectionChangeType === 'removed'
                                    ? 'text-red-900 dark:text-red-100'
                                    : sectionChangeType === 'modified'
                                    ? 'text-yellow-900 dark:text-yellow-100'
                                    : 'text-gray-900 dark:text-gray-100'
                                }`}>
                                  {section.title || t('positionStrategies:sectionWithoutTitle', { defaultValue: 'Section sans titre' })}
                                </h4>
                              </div>
                              <span className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap bg-white/50 dark:bg-gray-800/50 px-2 py-1 rounded">
                                {sectionChecked}/{sectionRules.length} ({sectionPercentage}%)
                              </span>
                            </div>
                          </div>
                          
                          {/* Contenu des règles */}
                          {sectionRules.length > 0 ? (
                            <div className="p-3 sm:p-4 bg-white dark:bg-gray-800">
                              <ul className="space-y-3">
                              {sectionRules.map((rule, ruleIndex) => {
                                // Gérer les règles qui peuvent être des chaînes ou des objets
                                let ruleText: string;
                                if (typeof rule === 'string') {
                                  ruleText = rule;
                                } else if (rule && typeof rule === 'object') {
                                  ruleText = (rule as any)?.text || (rule as any)?.id || JSON.stringify(rule);
                                } else {
                                  ruleText = String(rule || '');
                                }
                                const ruleKey = `${sectionIndex}_${ruleIndex}`;
                                const isChecked = checkedRules[ruleKey] || false;
                                
                                // Vérifier les changements pour cette règle (uniquement si la version n'est pas active)
                                const showChanges = selectedStrategy.status !== 'active';
                                const changes = showChanges ? getVersionChanges(selectedStrategy, previousVersion) : null;
                                const ruleChangeType = getChangeType('rule', sectionIndex, changes, ruleIndex);
                                const ruleBgColor = ruleChangeType === 'added' 
                                  ? 'bg-green-50 dark:bg-green-900/10'
                                  : ruleChangeType === 'removed'
                                  ? 'bg-red-50 dark:bg-red-900/10'
                                  : ruleChangeType === 'modified'
                                  ? 'bg-yellow-50 dark:bg-yellow-900/10'
                                  : '';
                                
                                return ruleText && (
                                  <li key={ruleIndex} className={`flex items-start gap-3 text-sm sm:text-base p-3 rounded-lg border ${ruleBgColor} ${ruleChangeType === 'removed' ? 'opacity-60' : ''} ${
                                    ruleChangeType === 'added' 
                                      ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10'
                                      : ruleChangeType === 'removed'
                                      ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10'
                                      : ruleChangeType === 'modified'
                                      ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10'
                                      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50'
                                  }`}>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => toggleRule(sectionIndex, ruleIndex)}
                                      className="mt-0.5 w-5 h-5 sm:w-5 sm:h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:focus:ring-blue-600 cursor-pointer flex-shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start gap-2">
                                        {ruleChangeType && (
                                          <span className={`px-2 py-0.5 text-xs font-medium rounded flex-shrink-0 mt-0.5 ${
                                            ruleChangeType === 'added' 
                                              ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
                                              : ruleChangeType === 'removed'
                                              ? 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200'
                                              : 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200'
                                          }`}>
                                            {ruleChangeType === 'added' ? '+' : ruleChangeType === 'removed' ? '-' : '~'}
                                          </span>
                                        )}
                                        <span className={`flex-1 break-words leading-relaxed ${isChecked ? 'line-through text-gray-500 dark:text-gray-500' : ''} ${
                                          ruleChangeType === 'added' 
                                            ? 'text-green-900 dark:text-green-100 font-medium'
                                            : ruleChangeType === 'removed'
                                            ? 'text-red-900 dark:text-red-100 line-through'
                                            : ruleChangeType === 'modified'
                                            ? 'text-yellow-900 dark:text-yellow-100 font-medium'
                                            : 'text-gray-700 dark:text-gray-300'
                                        }`}>
                                          {ruleText}
                                        </span>
                                      </div>
                                    </div>
                                  </li>
                                );
                              })}
                              </ul>
                            </div>
                          ) : (
                            <div className="p-3 sm:p-4 bg-white dark:bg-gray-800">
                              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 italic text-center py-2">
                                {t('positionStrategies:noRules', { defaultValue: 'Aucune règle définie' })}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 italic">
                      {t('positionStrategies:noSections', { defaultValue: 'Aucune section définie' })}
                    </p>
                  )}
                </div>

                {/* Notes de version si présentes */}
                {selectedStrategy.version_notes && (() => {
                  // Ne pas afficher les changements si la version est active
                  const showChanges = selectedStrategy.status !== 'active';
                  const changes = showChanges ? getVersionChanges(selectedStrategy, previousVersion) : null;
                  const notesChanged = changes?.versionNotesChanged;
                  
                  return (
                    <div className={`mt-4 sm:mt-6 pt-4 sm:pt-6 border-t ${notesChanged ? 'border-blue-300 dark:border-blue-700' : 'border-gray-200 dark:border-gray-700'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-100">
                          {t('positionStrategies:versionNotes', { defaultValue: 'Notes de version' })}
                        </h4>
                        {notesChanged && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded">
                            {t('positionStrategies:modified', { defaultValue: 'Modifié' })}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs sm:text-sm whitespace-pre-wrap break-words ${notesChanged ? 'text-blue-900 dark:text-blue-100 bg-blue-50 dark:bg-blue-900/10 p-3 rounded' : 'text-gray-700 dark:text-gray-300'}`}>
                        {selectedStrategy.version_notes}
                      </p>
                    </div>
                  );
                })()}
              </div>

              {/* Footer */}
              <div className="px-3 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 rounded-b-xl flex items-center justify-end flex-shrink-0">
                <button
                  onClick={handleCloseViewModal}
                  className="px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 font-medium transition-colors"
                >
                  {t('positionStrategies:close', { defaultValue: 'Fermer' })}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de suppression */}
        <DeleteConfirmModal
          isOpen={strategyToDelete !== null}
          onClose={() => setStrategyToDelete(null)}
          onConfirm={handleDelete}
          title={t('positionStrategies:confirmDeleteTitle', { defaultValue: 'Supprimer la stratégie' })}
          itemName={strategyToDelete?.title}
          isLoading={isDeleting}
          confirmButtonText={t('positionStrategies:delete', { defaultValue: 'Supprimer' })}
          cancelButtonText={t('positionStrategies:cancel', { defaultValue: 'Annuler' })}
        />
      </div>
    </div>
  );
};

export default PositionStrategiesPage;

