import React from 'react';

interface SettingsLayoutProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  header?: React.ReactNode;
}

export const SettingsLayout: React.FC<SettingsLayoutProps> = ({
  sidebar,
  children,
  header,
}) => {
  return (
    <div className="h-full flex flex-col -my-6 2xl:pt-8">
      {/* Header avec messages/notifications */}
      {header && <div className="flex-shrink-0">{header}</div>}

      {/* Contenu principal avec sidebar */}
      <div className="flex-1 flex overflow-hidden lg:gap-8">
        {/* Sidebar */}
        <div className="flex-shrink-0 hidden lg:block">
          {sidebar}
        </div>

        {/* Contenu scrollable */}
        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 pb-28 lg:pb-8">
            {children}
          </div>
        </div>
      </div>

      {/* Mobile sidebar (bottom tabs) */}
      <div className="lg:hidden flex-shrink-0">
        {sidebar}
      </div>
    </div>
  );
};
