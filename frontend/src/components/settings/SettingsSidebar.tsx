import React from 'react';

interface SettingsTab {
  id: 'profile' | 'security' | 'trading' | 'display' | 'data';
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

interface SettingsSidebarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  tabs: SettingsTab[];
}

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  activeTab,
  onTabChange,
  tabs,
}) => {
  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-72 flex-shrink-0 px-6 py-4">
        <div className="rounded-2xl border border-gray-200/70 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg shadow-blue-100/40 dark:shadow-black/40 overflow-hidden">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-none
                  text-sm font-medium transition-all duration-200
                  ${
                    activeTab === tab.id
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-l-4 border-blue-600 dark:border-blue-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 border-l-4 border-transparent'
                  }
                `}
              >
                <div className={
                  `w-5 h-5 flex-shrink-0 ${activeTab === tab.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`
                }>
                  {tab.icon}
                </div>
                <span className="flex-1 text-left">{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Mobile Bottom Tabs */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-40 safe-area-bottom">
        <nav className="flex justify-around items-center px-2 py-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex flex-col items-center gap-1 px-3 py-2 rounded-lg
                text-xs font-medium transition-all duration-200 relative
                ${
                  activeTab === tab.id
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400'
                }
              `}
            >
              <div className={`
                w-6 h-6 flex items-center justify-center
                ${activeTab === tab.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}
              `}>
                {tab.icon}
              </div>
              <span className="truncate max-w-[60px]">{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full"></span>
              )}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-blue-600 dark:bg-blue-400 rounded-t-full"></div>
              )}
            </button>
          ))}
        </nav>
      </div>
    </>
  );
};
