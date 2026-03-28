import React, { useState, useEffect } from 'react';

interface Tab {
  id: string;
  label: string | React.ReactNode;
  icon?: React.ReactNode;
  content: React.ReactNode;
  hideOnMobile?: boolean;
}

interface TabsFilterProps {
  tabs: Tab[];
  defaultTab?: string;
  storageKey?: string;
}

export const TabsFilter: React.FC<TabsFilterProps> = ({ 
  tabs, 
  defaultTab, 
  storageKey = 'tabs_filter_active' 
}) => {
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved && tabs.some(t => t.id === saved)) {
          return saved;
        }
      } catch {
        // Ignore errors
      }
    }
    return defaultTab || tabs[0]?.id || '';
  });

  // Gérer le changement de taille d'écran : si l'onglet actif est masqué sur mobile, basculer sur le premier onglet visible
  useEffect(() => {
    const handleResize = () => {
      const activeTabData = tabs.find(t => t.id === activeTab);
      if (activeTabData?.hideOnMobile && window.innerWidth < 640) {
        // Si l'onglet actif est masqué sur mobile et qu'on est en mode mobile, basculer sur le premier onglet visible
        const firstVisibleTab = tabs.find(t => !t.hideOnMobile);
        if (firstVisibleTab) {
          setActiveTab(firstVisibleTab.id);
        }
      }
    };

    handleResize(); // Vérifier au montage
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeTab, tabs]);

  useEffect(() => {
    if (storageKey && activeTab) {
      try {
        localStorage.setItem(storageKey, activeTab);
      } catch {
        // Ignore errors
      }
    }
  }, [activeTab, storageKey]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
  };

  const activeTabData = tabs.find(t => t.id === activeTab);
  const activeTabContent = activeTabData?.content;
  const isActiveTabHiddenOnMobile = activeTabData?.hideOnMobile || false;

  return (
    <div className="w-full">
      {/* Tabs Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-1.5">
        <nav className="flex -mb-px space-x-6" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`
                  group inline-flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm
                  transition-all duration-200
                  ${tab.hideOnMobile ? 'hidden sm:inline-flex' : ''}
                  ${isActive
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600'
                  }
                `}
                aria-current={isActive ? 'page' : undefined}
              >
                {tab.icon && (
                  <span className={`
                    transition-colors duration-200
                    ${isActive 
                      ? 'text-blue-500 dark:text-blue-400' 
                      : 'text-gray-400 group-hover:text-gray-500 dark:text-gray-500 dark:group-hover:text-gray-400'
                    }
                  `}>
                    {tab.icon}
                  </span>
                )}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tabs Content */}
      <div className={isActiveTabHiddenOnMobile ? 'hidden sm:block' : ''}>
        <div
          className="animate-fadeIn"
          key={activeTab}
        >
          {activeTabContent}
        </div>
      </div>
    </div>
  );
};
